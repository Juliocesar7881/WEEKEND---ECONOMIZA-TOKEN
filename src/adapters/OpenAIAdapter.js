/**
 * 🏛️ ARQUITETURA: Padrão Adapter — OpenAI (Passthrough Nativo)
 * 
 * DECISÃO TÉCNICA: Como a IDE já envia no formato OpenAI, este adapter
 * é essencialmente um passthrough — repassa o payload otimizado para a
 * API real da OpenAI e devolve a resposta sem transformação.
 * 
 * ZERO-CONFIG: A API key é extraída do header Authorization que a própria
 * IDE enviou. O modelo é preservado exatamente como a IDE pediu.
 * 
 * STREAMING: Suporta SSE (Server-Sent Events) para autocompletar em
 * tempo real — crítico para a experiência do desenvolvedor na IDE.
 */

class OpenAIAdapter {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    }

    /**
     * Envia a requisição para a API da OpenAI.
     * O payload já chega otimizado (tokens reduzidos pelo TokenOptimizerModel).
     * O modelo é preservado exatamente como a IDE pediu (não forçamos mais gpt-4o).
     */
    async sendRequest(optimizedPayload) {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(optimizedPayload)
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Erro OpenAI API (${response.status}): ${err}`);
            }

            // Formato já é 100% compatível com a IDE — zero transformação necessária
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ [OpenAIAdapter] Erro:', error.message);
            throw error;
        }
    }

    /**
     * STREAMING (SSE): Repassa o stream da OpenAI diretamente para a IDE.
     * Como ambos usam o mesmo formato SSE, é um pipe direto.
     * 
     * DESEMPENHO: O stream é repassado chunk a chunk sem buffering,
     * garantindo que o autocompletar da IDE receba tokens em tempo real.
     */
    async sendRequestStream(optimizedPayload, res) {
        try {
            // Força stream: true no payload enviado à OpenAI
            const streamPayload = { ...optimizedPayload, stream: true };

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(streamPayload)
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Erro OpenAI Stream (${response.status}): ${err}`);
            }

            // Headers SSE para a IDE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Pipe direto do stream da OpenAI → IDE (zero transformação)
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                res.write(chunk);
            }

            res.end();
        } catch (error) {
            console.error('❌ [OpenAIAdapter] Erro no stream:', error.message);
            throw error;
        }
    }
}

module.exports = OpenAIAdapter;
