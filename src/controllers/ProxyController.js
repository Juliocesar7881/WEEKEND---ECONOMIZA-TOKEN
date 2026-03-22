/**
 * 🏛️ ARQUITETURA: MVC — Controller (Orquestrador Central)
 * 
 * DECISÃO TÉCNICA: O ProxyController é o cérebro do TokenGuard.
 * Ele intercepta TODA requisição da IDE, e automaticamente:
 *   1. Extrai a API key do header Authorization (enviado pela IDE)
 *   2. Detecta o provedor pela model name via ModelRouter
 *   3. Otimiza o payload (reduz tokens via regex)
 *   4. Verifica cache semântico (SQLite)
 *   5. Roteia para o Adapter correto
 *   6. Devolve a resposta no formato OpenAI (IDE não percebe nada)
 * 
 * ZERO-CONFIG: Nenhuma configuração manual necessária. A IDE envia
 * o modelo e a chave, e o proxy faz o resto automaticamente.
 * 
 * DESEMPENHO: Todo o fluxo é assíncrono e non-blocking.
 * O cache evita chamadas desnecessárias à API, zerando latência.
 */

const TokenOptimizerModel = require('../models/TokenOptimizerModel');
const ModelRouter = require('../models/ModelRouter');
const AnthropicAdapter = require('../adapters/AnthropicAdapter');
const OpenAIAdapter = require('../adapters/OpenAIAdapter');
const GeminiAdapter = require('../adapters/GeminiAdapter');
const CacheModel = require('../models/CacheModel');

class ProxyController {
    constructor() {
        this.isActive = true; // Botão de Ligar/Desligar do Proxy

        // Métricas da Sessão Atual (exibidas no Dashboard)
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            savedTokens: 0,
            moneySaved: 0.00
        };

        // Log de requisições ao vivo (últimas N para exibição no Dashboard)
        this.requestLog = [];
        this.maxLogEntries = 50;

        // Callback para atualizar a UI do Electron em tempo real
        this.onStatsUpdated = null;
        this.onRequestLogged = null;
    }

    /**
     * Notifica a UI do Electron com as métricas atualizadas.
     */
    _notifyUI() {
        if (this.onStatsUpdated) {
            this.onStatsUpdated(this.stats);
        }
    }

    /**
     * Registra uma requisição no log ao vivo e notifica a UI.
     */
    _logRequest(entry) {
        this.requestLog.unshift(entry); // Mais recente primeiro
        if (this.requestLog.length > this.maxLogEntries) {
            this.requestLog.pop();
        }
        if (this.onRequestLogged) {
            this.onRequestLogged(entry);
        }
    }

    /**
     * Alterna o estado do Proxy (Ligado/Desligado via toggle da UI)
     */
    toggleProxy(state) {
        this.isActive = state;
        console.log(`🔌 Proxy ${state ? 'ATIVADO' : 'DESATIVADO'}`);
    }

    /**
     * Extrai a API key do header Authorization enviado pela IDE.
     * 
     * SEGURANÇA: A chave NUNCA é armazenada pelo TokenGuard.
     * Ela vive apenas na memória durante o processamento da requisição.
     * Quem gerencia a chave é a própria IDE do desenvolvedor.
     * 
     * Formatos aceitos:
     *   - "Bearer sk-ant-api03-..." (Anthropic via extensões)
     *   - "Bearer sk-..." (OpenAI)
     *   - "Bearer AIzaSy..." (Gemini)
     *   - "sk-..." (sem prefixo Bearer — algumas extensões omitem)
     */
    _extractApiKey(req) {
        const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
        
        if (authHeader.startsWith('Bearer ')) {
            return authHeader.slice(7).trim();
        }
        
        // Fallback: header x-api-key (usado por algumas ferramentas)
        if (req.headers['x-api-key']) {
            return req.headers['x-api-key'];
        }

        // Fallback: a própria string se não tiver prefixo
        if (authHeader.trim()) {
            return authHeader.trim();
        }

        return null;
    }

    /**
     * Handler principal — rota POST /v1/chat/completions (padrão OpenAI).
     * 
     * FLUXO ZERO-CONFIG:
     *   IDE envia → TokenGuard intercepta → detecta modelo → detecta provedor
     *   → otimiza payload → checa cache → roteia para Adapter → devolve resposta
     */
    async handleChatCompletion(req, res) {
        const startTime = Date.now();

        // Se o proxy estiver desligado, repassa sem processar
        if (!this.isActive) {
            return res.status(503).json({
                error: {
                    message: 'TokenGuard Proxy está desativado. Ative-o no Dashboard.',
                    type: 'proxy_disabled'
                }
            });
        }

        const originalPayload = req.body;
        const isStreaming = originalPayload.stream === true;

        try {
            this.stats.totalRequests++;

            // 1. EXTRAIR API KEY do header (zero-config — a IDE já envia)
            const apiKey = this._extractApiKey(req);
            if (!apiKey) {
                return res.status(401).json({
                    error: {
                        message: 'API key não encontrada no header Authorization. Configure sua IDE com a chave do provedor.',
                        type: 'authentication_error'
                    }
                });
            }

            // 2. DETECTAR PROVEDOR pelo nome do modelo (zero-config — ModelRouter resolve)
            const modelName = originalPayload.model;
            const { provider, model } = ModelRouter.resolveProvider(modelName);

            // 3. OTIMIZAR PAYLOAD (redução de tokens via regex — economia real)
            const { optimizedPayload, tokensSaved, originalTokens } = TokenOptimizerModel.optimizeAndCount(originalPayload);

            if (tokensSaved > 0) {
                this.stats.savedTokens += tokensSaved;
                this.stats.moneySaved += (tokensSaved / 1000) * 0.005;
                this._notifyUI();
            }

            // 4. CACHE SEMÂNTICO — verifica se já temos essa resposta (não cacheia streams)
            if (!isStreaming) {
                const cachedResponse = await CacheModel.get(optimizedPayload);
                if (cachedResponse) {
                    this.stats.cacheHits++;
                    const totalCacheSavings = originalTokens + 200;
                    this.stats.savedTokens += totalCacheSavings;
                    this.stats.moneySaved += (totalCacheSavings / 1000) * 0.005;
                    this._notifyUI();

                    this._logRequest({
                        timestamp: new Date().toISOString(),
                        model: modelName,
                        provider: provider,
                        tokensSaved: totalCacheSavings,
                        cached: true,
                        latencyMs: Date.now() - startTime
                    });

                    return res.json(cachedResponse);
                }
            }

            // 5. INSTANCIAR ADAPTER correto (padrão Strategy via ModelRouter)
            const adapter = this._createAdapter(provider, apiKey);

            // 6. ENVIAR REQUISIÇÃO (stream ou normal)
            if (isStreaming) {
                // Streaming: o adapter faz pipe direto para a response da IDE
                this._logRequest({
                    timestamp: new Date().toISOString(),
                    model: modelName,
                    provider: provider,
                    tokensSaved: tokensSaved,
                    cached: false,
                    streaming: true,
                    latencyMs: Date.now() - startTime
                });

                return await adapter.sendRequestStream(optimizedPayload, res);
            }

            // Requisição normal (non-streaming)
            const responseData = await adapter.sendRequest(optimizedPayload);

            // 7. SALVAR NO CACHE (background — não atrasa a resposta)
            CacheModel.save(optimizedPayload, responseData).catch(err => {
                console.error('⚠️ Falha ao salvar cache (non-blocking):', err.message);
            });

            this._logRequest({
                timestamp: new Date().toISOString(),
                model: modelName,
                provider: provider,
                tokensSaved: tokensSaved,
                cached: false,
                latencyMs: Date.now() - startTime
            });

            this._notifyUI();

            // 8. DEVOLVER RESPOSTA no formato OpenAI (IDE não percebe nada)
            return res.json(responseData);

        } catch (error) {
            console.error('❌ [ProxyController] Erro:', error.message);

            // Se o streaming já começou, não podemos enviar JSON de erro
            if (res.headersSent) {
                res.end();
                return;
            }

            return res.status(500).json({
                error: {
                    message: `Falha no TokenGuard Proxy: ${error.message}`,
                    type: 'proxy_error'
                }
            });
        }
    }

    /**
     * Factory method — cria o adapter correto baseado no provedor detectado.
     * 
     * EXTENSIBILIDADE: Para adicionar um novo provedor (Ex: Mistral),
     * basta criar MistralAdapter.js e adicionar um case aqui + padrão no ModelRouter.
     */
    _createAdapter(provider, apiKey) {
        switch (provider) {
            case 'anthropic':
                return new AnthropicAdapter(apiKey);
            case 'gemini':
                return new GeminiAdapter(apiKey);
            case 'openai':
            default:
                // Fallback para OpenAI (cobre também provedores compatíveis como Groq, Together, etc)
                return new OpenAIAdapter(apiKey);
        }
    }
}

module.exports = ProxyController;
