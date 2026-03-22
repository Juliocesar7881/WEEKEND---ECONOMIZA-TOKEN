/**
 * 🏛️ ARQUITETURA: Rotas da API (Express Router)
 * 
 * DECISÃO TÉCNICA: Expõe TODAS as rotas que IDEs esperam de um provedor OpenAI-compatible.
 * 
 * COMPATIBILIDADE COPILOT: O GitHub Copilot via BYOK (VS Code v1.99+) e a extensão
 * "OAI Compatible Provider for Copilot" fazem chamadas para:
 *   - POST /v1/chat/completions (chat/agentes)
 *   - POST /v1/completions (autocompletar inline legado)
 *   - GET /v1/models (listar modelos disponíveis)
 * 
 * Todas estas rotas são implementadas aqui para compatibilidade total.
 */

const express = require('express');
const ModelRouter = require('../models/ModelRouter');

/**
 * Cria e retorna o router Express com todas as rotas do proxy.
 */
function createApiRoutes(proxyController) {
    const router = express.Router();

    // ═══════════════════════════════════════════════════════
    // CORS — Necessário para extensões que rodam via web worker
    // ═══════════════════════════════════════════════════════
    router.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version, x-request-id');
        
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });

    // ═══════════════════════════════════════════════════════
    // POST /v1/chat/completions — Rota principal (usado por TODAS as IDEs)
    // Copilot Chat, Cursor, Continue, Cline, Antigravity, etc
    // ═══════════════════════════════════════════════════════
    router.post('/v1/chat/completions', (req, res) => {
        proxyController.handleChatCompletion(req, res);
    });

    // ═══════════════════════════════════════════════════════
    // POST /v1/completions — Autocompletar inline (legado mas Copilot usa)
    // Algumas extensões fazem POST aqui para completar código inline
    // Convertemos para o mesmo handler de chat (internamente é a mesma coisa)
    // ═══════════════════════════════════════════════════════
    router.post('/v1/completions', (req, res) => {
        // Converte formato /completions → /chat/completions para unificar
        if (req.body.prompt && !req.body.messages) {
            req.body.messages = [{ role: 'user', content: req.body.prompt }];
            delete req.body.prompt;
        }
        proxyController.handleChatCompletion(req, res);
    });

    // ═══════════════════════════════════════════════════════
    // GET /v1/models — Lista de modelos (Copilot, Cursor, etc pedem isso)
    // ═══════════════════════════════════════════════════════
    router.get('/v1/models', (req, res) => {
        const models = ModelRouter.getAdvertisedModels();
        const now = Math.floor(Date.now() / 1000);

        res.json({
            object: 'list',
            data: models.map(m => ({
                id: m.id,
                object: 'model',
                created: now,
                owned_by: m.provider,
                permission: [{
                    id: `modelperm-${m.id}`,
                    object: 'model_permission',
                    created: now,
                    allow_create_engine: false,
                    allow_sampling: true,
                    allow_logprobs: true,
                    allow_search_indices: false,
                    allow_view: true,
                    allow_fine_tuning: false,
                    organization: '*',
                    group: null,
                    is_blocking: false
                }],
                root: m.id,
                parent: null
            }))
        });
    });

    // ═══════════════════════════════════════════════════════
    // GET /v1/models/:model — Detalhes de um modelo específico
    // Algumas IDEs pedem info de um modelo específico antes de usar
    // ═══════════════════════════════════════════════════════
    router.get('/v1/models/:model', (req, res) => {
        const modelId = req.params.model;
        const { provider } = ModelRouter.resolveProvider(modelId);
        const now = Math.floor(Date.now() / 1000);

        res.json({
            id: modelId,
            object: 'model',
            created: now,
            owned_by: provider,
            permission: [{
                id: `modelperm-${modelId}`,
                object: 'model_permission',
                created: now,
                allow_sampling: true,
                allow_logprobs: true,
                allow_view: true,
                organization: '*',
                is_blocking: false
            }],
            root: modelId,
            parent: null
        });
    });

    // ═══════════════════════════════════════════════════════
    // POST /v1/embeddings — Embeddings (algumas ferramentas pedem)
    // Repassamos direto para a OpenAI (formato padrão)
    // ═══════════════════════════════════════════════════════
    router.post('/v1/embeddings', async (req, res) => {
        const apiKey = req.headers['authorization']?.replace('Bearer ', '') || '';
        try {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req.body)
            });
            const data = await response.json();
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: { message: error.message, type: 'proxy_error' } });
        }
    });

    // ═══════════════════════════════════════════════════════
    // GET /health — Status do proxy
    // ═══════════════════════════════════════════════════════
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            proxy: proxyController.isActive ? 'active' : 'inactive',
            uptime: process.uptime(),
            version: '1.0.0-mvp',
            supportedModels: ModelRouter.getAdvertisedModels().length,
            stats: proxyController.stats
        });
    });

    return router;
}

module.exports = createApiRoutes;
