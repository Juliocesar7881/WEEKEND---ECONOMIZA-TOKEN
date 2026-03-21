<p align="center">
  <h1 align="center">🛡️ TokenGuard</h1>
  <p align="center"><strong>Proxy Universal Zero-Config — Economize Tokens de LLMs Automaticamente</strong></p>
  <p align="center">Intercepta chamadas de IDEs → Comprime Tokens → Cache Semântico → Repassa para qualquer IA</p>
  <p align="center">
    <img src="https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js" />
    <img src="https://img.shields.io/badge/Electron-Desktop-47848F?style=flat-square&logo=electron" />
    <img src="https://img.shields.io/badge/SQLite-Cache-003B57?style=flat-square&logo=sqlite" />
    <img src="https://img.shields.io/badge/35+-Modelos-8B5CF6?style=flat-square" />
  </p>
</p>

---

## 🎯 O Problema

Desenvolvedores gastam **milhares de dólares por mês** em tokens de IA via autocompletar e chat nas IDEs. Cada requisição envia código cheio de comentários desnecessários, espaços redundantes e blocos vazios. Requisições idênticas são reenviadas sem cache.

## 💡 A Solução: TokenGuard

O TokenGuard é um **proxy desktop local** que roda no `localhost:3000` e se posiciona entre a IDE e a API do LLM — **100% transparente, zero-config**:

```
IDE (Copilot/Cursor/Antigravity) → TokenGuard (localhost:3000) → API Real (OpenAI/Claude/Gemini/...)
```

### O que ele faz automaticamente:
- 🔀 **Auto-Detecção** — Detecta o provedor pelo nome do modelo (35+ modelos suportados)
- ✂️ **Compressão de Tokens** — Remove comentários, espaços e formatação redundante via Regex
- 💾 **Cache Semântico** — SQLite local guarda respostas idênticas (economia de 100%)
- 🔄 **Adaptadores** — Traduz formato OpenAI ↔ Claude/Gemini transparentemente
- ⚡ **Streaming SSE** — Autocompletar em tempo real sem latência adicional
- 📊 **Dashboard Premium** — Gráfico temporal, log ao vivo, métricas em tempo real
- 🔒 **System Tray** — Minimiza para bandeja, sempre rodando

---

## 🔌 Compatibilidade com IDEs

### ✅ GitHub Copilot (VS Code)

**Método 1: BYOK (VS Code v1.99+)**
1. Abra Copilot Chat → Model Picker
2. Clique **"Manage Models..."**
3. **Add Provider** → OpenAI Compatible
4. Base URL: `http://localhost:3000/v1`
5. API Key: sua key real do provedor

**Método 2: Extensão "OAI Compatible Provider for Copilot"**
1. Instale a extensão do Marketplace
2. Settings → `oaicopilot.baseUrl`: `http://localhost:3000/v1`
3. Selecione modelos no model picker do Copilot

### ✅ Cursor
```
Settings → Models → Override API Base URL: http://localhost:3000/v1
```

### ✅ Antigravity
```
Configure o provedor: Base URL = http://localhost:3000/v1
```

### ✅ Continue / Cline
```json
{ "provider": "openai", "apiBase": "http://localhost:3000/v1", "model": "claude-sonnet-4.6" }
```

---

## 🧠 35+ Modelos Suportados (2026)

| Provedor | Modelos | Status |
|----------|---------|--------|
| **OpenAI** | GPT-5.4, GPT-5, GPT-4.1, GPT-4o, o4-mini, o3, o1 | ✅ Auto-Detectado |
| **Anthropic** | Claude Opus 4.6, Sonnet 4.6, Haiku 4.6, Claude 3.5 | ✅ Auto-Detectado |
| **Google** | Gemini 2.5 Pro/Flash, 2.0, 1.5 Pro | ✅ Auto-Detectado |
| **DeepSeek** | V3, R2, Chat, Coder | ✅ Auto-Detectado |
| **Mistral** | Large, Codestral, Small | ✅ Auto-Detectado |
| **xAI** | Grok 3, Grok 2 | ✅ Auto-Detectado |
| **Meta** | Llama 4 Maverick/Scout, Llama 3.3 | ✅ Auto-Detectado |
| **Qualquer outro** | Via API compatível OpenAI (Groq, Together, OpenRouter) | ✅ Fallback |

---

## 🚀 Instalação

```bash
git clone https://github.com/Juliocesar7881/WEEKEND---ECONOMIZA-TOKEN.git
cd WEEKEND---ECONOMIZA-TOKEN
npm install
npm start
```

### Build do Executável (.exe)
```bash
npm run build
# Gera o installer em /release/
```

---

## 📐 Arquitetura (MVC + Adapter Pattern)

```
TokenGuard/
├── main.js                          # Entry point (Electron + Express + Tray)
├── src/
│   ├── controllers/
│   │   └── ProxyController.js       # Orquestrador zero-config
│   ├── adapters/
│   │   ├── OpenAIAdapter.js         # Passthrough + SSE streaming
│   │   ├── AnthropicAdapter.js      # OpenAI ↔ Claude + SSE streaming
│   │   └── GeminiAdapter.js         # OpenAI ↔ Gemini + SSE streaming
│   ├── models/
│   │   ├── ModelRouter.js           # Auto-detecção de 35+ modelos
│   │   ├── CacheModel.js            # Cache semântico SQLite
│   │   └── TokenOptimizerModel.js   # Compressão de tokens via Regex
│   ├── routes/
│   │   └── apiRoutes.js             # Rotas OpenAI-compatible (Copilot-ready)
│   └── views/
│       └── index.html               # Dashboard premium (Chart.js + glassmorphism)
└── package.json
```

---

## 🛡️ Segurança

- **API keys nunca são armazenadas** — extraídas em tempo real do header, descartadas após uso
- **100% local** — nenhum dado sai do seu computador (exceto para a API do LLM)
- **Sem telemetria** — zero tracking, zero analytics externas
- **CORS habilitado** — funciona com extensões web-based

---

## 📄 Licença

MIT — Feito com 💚 para o Hackathon Weekend
