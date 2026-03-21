/**
 * 🏛️ ARQUITETURA: Model — Roteador Inteligente de Modelos
 * 
 * DECISÃO TÉCNICA: Este módulo é o coração do sistema "Zero-Config".
 * Ele analisa o nome do modelo que a IDE enviou no body da requisição
 * (ex: "claude-3-5-sonnet-20241022") e resolve automaticamente qual
 * provedor de IA deve ser usado, sem nenhuma configuração manual do usuário.
 * 
 * PADRÃO: Strategy + Registry — mantém um mapa de prefixos para provedores,
 * permitindo adicionar novos provedores sem alterar código existente.
 * 
 * BENEFÍCIO PARA O HACKATHON: O desenvolvedor configura a IDE apontando
 * para localhost:3000, e o proxy detecta TUDO sozinho via este módulo.
 */

// Mapa de prefixos/padrões de nomes de modelos → provedor
const MODEL_PATTERNS = [
    // OpenAI — modelos GPT, o1, o3, o4, dall-e, whisper, tts, etc
    { regex: /^(gpt-|o1-|o3-|o4-|dall-e|whisper|tts|text-|davinci|babbage|curie|ada)/i, provider: 'openai' },

    // Anthropic — modelos Claude
    { regex: /^claude/i, provider: 'anthropic' },

    // Google — modelos Gemini
    { regex: /^gemini/i, provider: 'gemini' },

    // DeepSeek — modelos deepseek
    { regex: /^deepseek/i, provider: 'deepseek' },

    // Mistral — modelos mistral, mixtral, codestral
    { regex: /^(mistral|mixtral|codestral|pixtral)/i, provider: 'mistral' },

    // Cohere — modelos command
    { regex: /^command/i, provider: 'cohere' },

    // Meta Llama (via Groq, Together, etc — se passado direto)
    { regex: /^(llama|meta-llama)/i, provider: 'openai' }, // Geralmente acessados via API compatível OpenAI
];

class ModelRouter {
    /**
     * Resolve o provedor correto a partir do nome do modelo.
     * 
     * @param {string} modelName — Nome do modelo vindo do body da requisição (ex: "claude-3-5-sonnet-20241022")
     * @returns {{ provider: string, model: string }} — Provedor detectado e modelo original
     * 
     * FALLBACK INTELIGENTE: Se não reconhecer o modelo, assume OpenAI,
     * pois a maioria dos provedores alternativos (Groq, Together, OpenRouter)
     * usam a mesma API da OpenAI como padrão.
     */
    static resolveProvider(modelName) {
        if (!modelName || typeof modelName !== 'string') {
            console.warn('⚠️ [ModelRouter] Nenhum modelo especificado, usando fallback OpenAI');
            return { provider: 'openai', model: 'gpt-4o' };
        }

        const normalized = modelName.trim().toLowerCase();

        for (const pattern of MODEL_PATTERNS) {
            if (pattern.regex.test(normalized)) {
                console.log(`🔀 [ModelRouter] Modelo "${modelName}" → Provedor: ${pattern.provider.toUpperCase()}`);
                return { provider: pattern.provider, model: modelName };
            }
        }

        // Fallback: assume compatibilidade OpenAI (cobre OpenRouter, Groq, Together, etc)
        console.log(`🔀 [ModelRouter] Modelo "${modelName}" não reconhecido → Fallback: OpenAI`);
        return { provider: 'openai', model: modelName };
    }

    /**
     * Retorna lista de todos os provedores suportados (usado pela rota /v1/models)
     */
    static getSupportedProviders() {
        return ['openai', 'anthropic', 'gemini', 'deepseek', 'mistral', 'cohere'];
    }

    /**
     * Retorna modelos populares para a rota GET /v1/models
     * (IDEs como Cursor e VS Code fazem GET /v1/models para listar opções)
     */
    static getAdvertisedModels() {
        return [
            // OpenAI
            { id: 'gpt-4o', provider: 'openai' },
            { id: 'gpt-4o-mini', provider: 'openai' },
            { id: 'gpt-4-turbo', provider: 'openai' },
            { id: 'o3-mini', provider: 'openai' },
            // Anthropic
            { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
            { id: 'claude-3-5-haiku-20241022', provider: 'anthropic' },
            { id: 'claude-3-opus-20240229', provider: 'anthropic' },
            // Google
            { id: 'gemini-2.0-flash', provider: 'gemini' },
            { id: 'gemini-1.5-pro', provider: 'gemini' },
            { id: 'gemini-1.5-flash', provider: 'gemini' },
            // DeepSeek
            { id: 'deepseek-chat', provider: 'deepseek' },
            { id: 'deepseek-coder', provider: 'deepseek' },
        ];
    }
}

module.exports = ModelRouter;
