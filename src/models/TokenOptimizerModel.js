/**
 * 🏛️ ARQUITETURA: MVC - Model
 * DECISÃO TÉCNICA: Este Model foca exclusivamenta na lógica de negócios de otimização de texto.
 * Como o maior gargalo financeiro de LLMs são os tokens de contexto (código enviado pelas IDEs),
 * aplicamos limpeza baseada em Regex para remover espaços redundantes, quebras de linhas vazias e 
 * comentários desnecessários, preservando a semântica do código para o LLM.
 */
const { encode } = require('gpt-tokenizer');

class TokenOptimizerModel {
    /**
     * Otimiza o payload inteiro da requisição (percorre todas as mensagens) 
     * e retorna a contagem de tokens economizados.
     */
    static optimizeAndCount(payload) {
        if (!payload || !payload.messages) return { optimizedPayload: payload, tokensSaved: 0, originalTokens: 0 };

        let originalTokenCount = 0;
        let optimizedTokenCount = 0;

        const optimizedMessages = payload.messages.map(message => {
            if (message.role === 'user' && typeof message.content === 'string') {
                // Conta tokens originais
                const originalLength = encode(message.content).length;
                originalTokenCount += originalLength;

                // Comprime
                const compressedContent = this.compressCode(message.content);
                
                // Conta tokens otimizados
                const compressedLength = encode(compressedContent).length;
                optimizedTokenCount += compressedLength;

                return {
                    ...message,
                    content: compressedContent
                };
            }
            return message;
        });

        const tokensSaved = originalTokenCount - optimizedTokenCount;

        return {
            optimizedPayload: {
                ...payload,
                messages: optimizedMessages
            },
            tokensSaved: tokensSaved > 0 ? tokensSaved : 0,
            originalTokens: originalTokenCount
        };
    }

    /**
     * Aplica regras de compressão de código via Regex
     * Foco do MVP: Reduzir tamanho mantendo a lógica (Javascript/Python/Geral)
     */
    static compressCode(codeString) {
        let compressed = codeString;

        // 1. Remover múltiplos espaços em branco ou tabs por um único espaço
        compressed = compressed.replace(/[ \t]{2,}/g, ' ');

        // 2. Remover múltiplas quebras de linha sequenciais por uma única
        compressed = compressed.replace(/\n\s*\n/g, '\n');

        // 3. Remover comentários de linha única (// comentário)
        // Cuidado com URLs (http://), então usamos lookbehind ou regra simples
        // Regex simplificado para o MVP (pode ser expandido dependendo da linguagem)
        compressed = compressed.replace(/(?<![:])\/\/.*/g, '');

        // 4. Remover comentários de bloco (/* comentário */)
        compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, '');

        // 5. Trim final
        return compressed.trim();
    }
}

module.exports = TokenOptimizerModel;
