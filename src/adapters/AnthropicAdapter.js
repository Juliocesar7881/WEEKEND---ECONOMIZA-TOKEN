/**
 * 🏛️ ARQUITETURA: Padrão Adapter — Anthropic (Claude)
 * 
 * DECISÃO TÉCNICA: Este adapter é o exemplo mais claro do valor do padrão Adapter.
 * A API do Claude tem diferenças significativas em relação à OpenAI:
 *   - O system prompt é um campo separado (não vem nas messages)
 *   - O header de autenticação é 'x-api-key' (não 'Authorization: Bearer')
 *   - A resposta usa 'content[0].text' (não 'choices[0].message.content')
 *   - O streaming usa eventos próprios ('content_block_delta' em vez de 'choices')
 * 
 * ZERO-CONFIG: A API key é extraída do header Authorization da requisição
 * original. O modelo é preservado da requisição (ex: "claude-3-5-sonnet-20241022").
 * 
 * TRANSPARÊNCIA: A IDE (VS Code, Cursor) envia JSON no formato OpenAI →
 * nós traduzimos para Anthropic → e revertemos a resposta para OpenAI.
 * A IDE nunca sabe que falou com o Claude.
 */

class AnthropicAdapter {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.anthropic.com/v1/messages';
    }

    /**
     * Converte o payload OpenAI → formato Anthropic e envia.
     * 
     * DIFERENÇA CRÍTICA: O Claude trata o system prompt como campo separado.
     * No formato OpenAI: { messages: [{ role: "system", content: "..." }] }
     * No formato Claude: { system: "...", messages: [...sem system...] }
     */
    async sendRequest(openAIPayload) {
        const anthropicPayload = this._convertPayload(openAIPayload);

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify(anthropicPayload)
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Erro Anthropic API (${response.status}): ${err}`);
            }

            const data = await response.json();

            // 🔄 Reverte resposta do Claude → formato OpenAI para a IDE
            return this._adaptResponseToOpenAI(data);
        } catch (error) {
            console.error('❌ [AnthropicAdapter] Erro:', error.message);
            throw error;
        }
    }

    /**
     * STREAMING (SSE): Converte o stream do Claude para o formato SSE da OpenAI.
     * 
     * DIFERENÇA: O Claude usa eventos como 'content_block_delta' com delta.text,
     * enquanto a OpenAI usa 'data: { choices: [{ delta: { content: "..." } }] }'.
     * Convertemos em tempo real, chunk a chunk.
     */
    async sendRequestStream(openAIPayload, res) {
        const anthropicPayload = this._convertPayload(openAIPayload);
        anthropicPayload.stream = true;

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify(anthropicPayload)
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Erro Anthropic Stream (${response.status}): ${err}`);
            }

            // Headers SSE para a IDE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            // ID fictício para manter consistência com formato OpenAI
            const completionId = `chatcmpl-tg-${Date.now()}`;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                // Mantém a última linha incompleta no buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') {
                        res.write('data: [DONE]\n\n');
                        continue;
                    }

                    try {
                        const event = JSON.parse(jsonStr);
                        // Converte evento Anthropic → formato SSE OpenAI
                        const openAIChunk = this._convertStreamEvent(event, completionId);
                        if (openAIChunk) {
                            res.write(`data: ${JSON.stringify(openAIChunk)}\n\n`);
                        }
                    } catch (e) {
                        // Ignora linhas que não são JSON válido (eventos de controle)
                    }
                }
            }

            // Sinaliza fim do stream no formato OpenAI
            res.write('data: [DONE]\n\n');
            res.end();
        } catch (error) {
            console.error('❌ [AnthropicAdapter] Erro no stream:', error.message);
            throw error;
        }
    }

    /**
     * Converte um evento do stream Anthropic para o formato OpenAI SSE.
     * O Claude emite eventos como 'content_block_delta' com { delta: { text: "..." } }
     * A OpenAI espera { choices: [{ delta: { content: "..." } }] }
     */
    _convertStreamEvent(event, completionId) {
        if (event.type === 'content_block_delta' && event.delta?.text) {
            return {
                id: completionId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: event.model || 'claude',
                choices: [{
                    index: 0,
                    delta: { content: event.delta.text },
                    finish_reason: null
                }]
            };
        }

        if (event.type === 'message_stop') {
            return {
                id: completionId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: event.model || 'claude',
                choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: 'stop'
                }]
            };
        }

        return null; // Eventos como 'message_start', 'content_block_start' são ignorados
    }

    /**
     * Converte payload OpenAI → Anthropic.
     * Extrai system prompt, remapeia roles, e ajusta campos.
     */
    _convertPayload(openAIPayload) {
        // Extrai mensagens de sistema (Claude trata separadamente)
        const systemMessages = openAIPayload.messages.filter(m => m.role === 'system');
        const systemPrompt = systemMessages.map(m => m.content).join('\n');

        // Remapeia roles: OpenAI 'function'/'tool' → 'user' no Claude
        const chatMessages = openAIPayload.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            }));

        const payload = {
            model: openAIPayload.model || 'claude-3-5-sonnet-20241022',
            max_tokens: openAIPayload.max_tokens || 4096,
            messages: chatMessages
        };

        // Só inclui system se houver conteúdo real
        if (systemPrompt.trim()) {
            payload.system = systemPrompt;
        }

        return payload;
    }

    /**
     * Converte resposta Anthropic → formato OpenAI (para não quebrar a IDE).
     * 
     * MAPEAMENTO:
     *   Claude content[0].text → OpenAI choices[0].message.content
     *   Claude usage.input_tokens → OpenAI usage.prompt_tokens
     *   Claude usage.output_tokens → OpenAI usage.completion_tokens
     */
    _adaptResponseToOpenAI(anthropicResponse) {
        if (!anthropicResponse.content || !anthropicResponse.content[0]) {
            throw new Error('Resposta inválida da Anthropic: sem conteúdo');
        }

        return {
            id: `chatcmpl-${anthropicResponse.id || Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: anthropicResponse.model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: anthropicResponse.content[0].text
                },
                finish_reason: anthropicResponse.stop_reason === 'end_turn' ? 'stop' : (anthropicResponse.stop_reason || 'stop')
            }],
            usage: {
                prompt_tokens: anthropicResponse.usage?.input_tokens || 0,
                completion_tokens: anthropicResponse.usage?.output_tokens || 0,
                total_tokens: (anthropicResponse.usage?.input_tokens || 0) + (anthropicResponse.usage?.output_tokens || 0)
            }
        };
    }
}

module.exports = AnthropicAdapter;
