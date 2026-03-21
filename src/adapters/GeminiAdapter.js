/**
 * 🏛️ ARQUITETURA: Padrão Adapter — Google Gemini
 * 
 * DECISÃO TÉCNICA: O Gemini usa uma API REST completamente diferente da OpenAI:
 *   - Endpoint: /v1beta/models/{model}:generateContent
 *   - Roles: 'user' e 'model' (não 'assistant')
 *   - System prompt: campo 'systemInstruction' separado
 *   - Content: array de 'parts' com { text: "..." }
 *   - Streaming: usa endpoint :streamGenerateContent com SSE
 * 
 * ZERO-CONFIG: A API key é extraída do header Authorization da IDE.
 * O Gemini usa key como query param, então convertemos automaticamente.
 * O modelo é preservado da requisição (ex: "gemini-2.0-flash").
 * 
 * TRANSPARÊNCIA: A IDE manda JSON OpenAI → traduzimos para Gemini REST →
 * revertemos a resposta para OpenAI. A IDE pensa que falou com a OpenAI.
 */

class GeminiAdapter {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    /**
     * Converte payload OpenAI → Gemini e envia.
     */
    async sendRequest(openAIPayload) {
        const model = openAIPayload.model || 'gemini-1.5-pro';
        const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;
        const geminiPayload = this._convertPayload(openAIPayload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geminiPayload)
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Erro Gemini API (${response.status}): ${err}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(`Gemini API Error: ${data.error.message}`);
            }

            return this._adaptResponseToOpenAI(data, model);
        } catch (error) {
            console.error('❌ [GeminiAdapter] Erro:', error.message);
            throw error;
        }
    }

    /**
     * STREAMING (SSE): Converte o stream do Gemini para formato SSE OpenAI.
     * 
     * O Gemini usa o endpoint :streamGenerateContent com alt=sse.
     * Cada chunk tem formato { candidates: [{ content: { parts: [{ text }] } }] }
     * Convertemos para { choices: [{ delta: { content: "..." } }] }
     */
    async sendRequestStream(openAIPayload, res) {
        const model = openAIPayload.model || 'gemini-1.5-pro';
        const url = `${this.baseUrl}/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
        const geminiPayload = this._convertPayload(openAIPayload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geminiPayload)
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Erro Gemini Stream (${response.status}): ${err}`);
            }

            // Headers SSE para a IDE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const completionId = `chatcmpl-tg-${Date.now()}`;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr || jsonStr === '[DONE]') continue;

                    try {
                        const geminiChunk = JSON.parse(jsonStr);
                        const text = geminiChunk.candidates?.[0]?.content?.parts?.[0]?.text;
                        
                        if (text) {
                            const openAIChunk = {
                                id: completionId,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: model,
                                choices: [{
                                    index: 0,
                                    delta: { content: text },
                                    finish_reason: null
                                }]
                            };
                            res.write(`data: ${JSON.stringify(openAIChunk)}\n\n`);
                        }

                        // Verifica se é o último chunk
                        const finishReason = geminiChunk.candidates?.[0]?.finishReason;
                        if (finishReason && finishReason !== 'STOP') {
                            // Continua — STOP será tratado no final
                        }
                    } catch (e) {
                        // Ignora chunks malformados
                    }
                }
            }

            // Envia chunk final com finish_reason e [DONE]
            const finalChunk = {
                id: completionId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: 'stop'
                }]
            };
            res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } catch (error) {
            console.error('❌ [GeminiAdapter] Erro no stream:', error.message);
            throw error;
        }
    }

    /**
     * Converte payload OpenAI → formato Gemini REST.
     * 
     * MAPEAMENTO DE ROLES:
     *   OpenAI 'system' → Gemini 'systemInstruction'
     *   OpenAI 'assistant' → Gemini 'model'
     *   OpenAI 'user' → Gemini 'user'
     */
    _convertPayload(openAIPayload) {
        const systemMessages = openAIPayload.messages.filter(m => m.role === 'system');
        const systemPrompt = systemMessages.map(m => m.content).join('\n');

        const contents = openAIPayload.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
            }));

        const payload = { contents };

        if (systemPrompt.trim()) {
            payload.systemInstruction = {
                parts: [{ text: systemPrompt }]
            };
        }

        // Configurações de geração (temperatura, max_tokens, etc)
        if (openAIPayload.temperature !== undefined || openAIPayload.max_tokens) {
            payload.generationConfig = {};
            if (openAIPayload.temperature !== undefined) {
                payload.generationConfig.temperature = openAIPayload.temperature;
            }
            if (openAIPayload.max_tokens) {
                payload.generationConfig.maxOutputTokens = openAIPayload.max_tokens;
            }
        }

        return payload;
    }

    /**
     * Converte resposta Gemini → formato OpenAI.
     * 
     * MAPEAMENTO:
     *   Gemini candidates[0].content.parts[0].text → OpenAI choices[0].message.content
     *   Gemini usageMetadata → OpenAI usage
     */
    _adaptResponseToOpenAI(geminiResponse, model) {
        const textResponse = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
            id: `chatcmpl-tg-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: textResponse
                },
                finish_reason: 'stop'
            }],
            usage: {
                prompt_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
                completion_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
                total_tokens: geminiResponse.usageMetadata?.totalTokenCount || 0
            }
        };
    }
}

module.exports = GeminiAdapter;
