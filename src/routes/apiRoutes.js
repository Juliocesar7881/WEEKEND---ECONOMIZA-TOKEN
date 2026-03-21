/**
 * 🏛️ ARQUITETURA: Rotas da API (Express Router)
 * 
 * DECISÃO TÉCNICA: Centraliza todas as rotas expostas pelo proxy.
 * A rota principal é /v1/chat/completions (padrão OpenAI), mas
 * IDEs como Cursor e VS Code também fazem GET /v1/models para
 * listar modelos disponíveis. Precisamos responder corretamente.
 * 
 * NOTA: A IDE configura "baseURL": "http://localhost:3000/v1"
 * e espera que /v1/chat/completions e /v1/models existam.
 */

const express = require('express');
const ModelRouter = require('../models/ModelRouter');

/**
 * Cria e retorna o router Express com todas as rotas do proxy.
 * Recebe a instância do ProxyController como dependência (injeção).
 */
function createApiRoutes(proxyController) {
    const router = express.Router();

    /**
     * POST /v1/chat/completions
     * Rota principal — intercepta todas as chamadas da IDE.
     * Formato de entrada: padrão OpenAI (usado por todas as IDEs).
     */
    router.post('/v1/chat/completions', (req, res) => {
        proxyController.handleChatCompletion(req, res);
    });

    /**
     * GET /v1/models
     * IDEs fazem esta chamada para listar modelos disponíveis.
     * Retornamos uma lista de modelos populares de todos os provedores.
     * Isso permite que o usuário selecione qualquer modelo na IDE.
     */
    router.get('/v1/models', (req, res) => {
        const models = ModelRouter.getAdvertisedModels();

        // Formato de resposta padrão OpenAI /v1/models
        const response = {
            object: 'list',
            data: models.map(m => ({
                id: m.id,
                object: 'model',
                created: 1700000000,
                owned_by: m.provider,
                permission: [],
                root: m.id,
                parent: null
            }))
        };

        res.json(response);
    });

    /**
     * GET /health
     * Health check simples — útil para verificar se o proxy está rodando.
     */
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            proxy: proxyController.isActive ? 'active' : 'inactive',
            uptime: process.uptime(),
            version: '1.0.0-mvp'
        });
    });

    return router;
}

module.exports = createApiRoutes;
