/**
 * 🏛️ ARQUITETURA: Model — Roteador Inteligente de Modelos
 * 
 * DECISÃO TÉCNICA: Este módulo é o coração do sistema "Zero-Config".
 * Ele analisa o nome do modelo que a IDE enviou no body da requisição
 * e resolve automaticamente qual provedor de IA deve ser usado.
 * 
 * COMPATIBILIDADE 2026: Suporta todos os modelos atuais incluindo
 * GPT-5.x, Claude Opus/Sonnet 4.x, Gemini 2.x, DeepSeek V3, etc.
 * 
 * PADRÃO: Strategy + Registry — mantém um mapa de prefixos para provedores,
 * permitindo adicionar novos provedores sem alterar código existente.
 * 
 * COPILOT: Funciona com GitHub Copilot via BYOK (Bring Your Own Key)
 * no VS Code v1.99+ ou via extensão "OAI Compatible Provider for Copilot".
 */

// Mapa de prefixos/padrões de nomes de modelos → provedor
const MODEL_PATTERNS = [
    // ═══════════════════════════════════════════════════════
    // OpenAI — GPT-5.x, GPT-4.x, o1, o3, o4, dall-e, whisper, etc
    // ═══════════════════════════════════════════════════════
    { regex: /^(gpt-|o1|o3|o4|dall-e|whisper|tts|text-|davinci|babbage|curie|ada|chatgpt)/i, provider: 'openai' },

    // ═══════════════════════════════════════════════════════
    // Anthropic — Claude Opus 4.x, Sonnet 4.x, Haiku 4.x, etc
    // ═══════════════════════════════════════════════════════
    { regex: /^claude/i, provider: 'anthropic' },

    // ═══════════════════════════════════════════════════════
    // Google — Gemini 2.x, 3.x, Ultra, Flash, Pro
    // ═══════════════════════════════════════════════════════
    { regex: /^gemini/i, provider: 'gemini' },

    // ═══════════════════════════════════════════════════════
    // DeepSeek — V3, Coder, Reasoner
    // ═══════════════════════════════════════════════════════
    { regex: /^deepseek/i, provider: 'deepseek' },

    // ═══════════════════════════════════════════════════════
    // Mistral / Mixtral / Codestral / Pixtral
    // ═══════════════════════════════════════════════════════
    { regex: /^(mistral|mixtral|codestral|pixtral|ministral)/i, provider: 'mistral' },

    // ═══════════════════════════════════════════════════════
    // Cohere — Command R+, Aya, etc
    // ═══════════════════════════════════════════════════════
    { regex: /^(command|aya)/i, provider: 'cohere' },

    // ═══════════════════════════════════════════════════════
    // xAI — Grok
    // ═══════════════════════════════════════════════════════
    { regex: /^grok/i, provider: 'openai' }, // xAI usa API compatível OpenAI

    // ═══════════════════════════════════════════════════════
    // Meta — Llama (via Groq, Together, OpenRouter, etc)
    // ═══════════════════════════════════════════════════════
    { regex: /^(llama|meta-llama)/i, provider: 'openai' },

    // ═══════════════════════════════════════════════════════
    // Qwen (Alibaba) — via API compatível OpenAI
    // ═══════════════════════════════════════════════════════
    { regex: /^(qwen|qwq)/i, provider: 'openai' },
];

class ModelRouter {
    /**
     * Resolve o provedor correto a partir do nome do modelo.
     * 
     * FALLBACK INTELIGENTE: Se não reconhecer o modelo, assume OpenAI,
     * pois a maioria dos provedores (Groq, Together, OpenRouter, Fireworks)
     * usam a mesma API da OpenAI como padrão.
     */
    static resolveProvider(modelName) {
        if (!modelName || typeof modelName !== 'string') {
            console.warn('⚠️ [ModelRouter] Nenhum modelo especificado, usando fallback OpenAI');
            return { provider: 'openai', model: 'gpt-5.4' };
        }

        const normalized = modelName.trim().toLowerCase();

        for (const pattern of MODEL_PATTERNS) {
            if (pattern.regex.test(normalized)) {
                console.log(`🔀 [ModelRouter] Modelo "${modelName}" → Provedor: ${pattern.provider.toUpperCase()}`);
                return { provider: pattern.provider, model: modelName };
            }
        }

        // Fallback: assume compatibilidade OpenAI
        console.log(`🔀 [ModelRouter] Modelo "${modelName}" não reconhecido → Fallback: OpenAI`);
        return { provider: 'openai', model: modelName };
    }

    /**
     * Retorna lista de todos os provedores suportados
     */
    static getSupportedProviders() {
        return ['openai', 'anthropic', 'gemini', 'deepseek', 'mistral', 'cohere', 'xai', 'meta'];
    }

    /**
     * Retorna modelos populares para a rota GET /v1/models
     * (IDEs como Cursor, VS Code Copilot e Antigravity fazem GET /v1/models)
     * 
     * ATUALIZADO PARA 2026 — Modelos mais recentes de cada provedor
     */
    static getAdvertisedModels() {
        return [
            // ═══ OpenAI ═══
            { id: 'gpt-5.4', provider: 'openai' },
            { id: 'gpt-5.4-mini', provider: 'openai' },
            { id: 'gpt-5', provider: 'openai' },
            { id: 'gpt-4.1', provider: 'openai' },
            { id: 'gpt-4.1-mini', provider: 'openai' },
            { id: 'gpt-4.1-nano', provider: 'openai' },
            { id: 'gpt-4o', provider: 'openai' },
            { id: 'gpt-4o-mini', provider: 'openai' },
            { id: 'o4-mini', provider: 'openai' },
            { id: 'o3', provider: 'openai' },
            { id: 'o3-mini', provider: 'openai' },
            { id: 'o1', provider: 'openai' },

            // ═══ Anthropic (Claude) ═══
            { id: 'claude-opus-4.6', provider: 'anthropic' },
            { id: 'claude-sonnet-4.6', provider: 'anthropic' },
            { id: 'claude-haiku-4.6', provider: 'anthropic' },
            { id: 'claude-opus-4', provider: 'anthropic' },
            { id: 'claude-sonnet-4', provider: 'anthropic' },
            { id: 'claude-3.5-sonnet', provider: 'anthropic' },
            { id: 'claude-3.5-haiku', provider: 'anthropic' },
            { id: 'claude-3-opus', provider: 'anthropic' },

            // ═══ Google (Gemini) ═══
            { id: 'gemini-2.5-pro', provider: 'gemini' },
            { id: 'gemini-2.5-flash', provider: 'gemini' },
            { id: 'gemini-2.0-flash', provider: 'gemini' },
            { id: 'gemini-2.0-pro', provider: 'gemini' },
            { id: 'gemini-1.5-pro', provider: 'gemini' },

            // ═══ DeepSeek ═══
            { id: 'deepseek-v3', provider: 'deepseek' },
            { id: 'deepseek-r2', provider: 'deepseek' },
            { id: 'deepseek-chat', provider: 'deepseek' },
            { id: 'deepseek-coder', provider: 'deepseek' },

            // ═══ Mistral ═══
            { id: 'mistral-large-latest', provider: 'mistral' },
            { id: 'codestral-latest', provider: 'mistral' },
            { id: 'mistral-small-latest', provider: 'mistral' },

            // ═══ xAI (Grok) ═══
            { id: 'grok-3', provider: 'openai' },
            { id: 'grok-2', provider: 'openai' },

            // ═══ Meta (Llama) ═══
            { id: 'llama-4-maverick', provider: 'openai' },
            { id: 'llama-4-scout', provider: 'openai' },
            { id: 'llama-3.3-70b', provider: 'openai' },
        ];
    }
}

module.exports = ModelRouter;
