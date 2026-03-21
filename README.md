<p align="center">
  <h1 align="center">🛡️ TokenGuard</h1>
  <p align="center"><strong>Proxy Universal Zero-Config para Economizar Tokens de LLMs</strong></p>
  <p align="center">Intercepta chamadas de IDEs → Otimiza Tokens → Cache Semântico → Repassa para qualquer IA</p>
</p>

---

## 🎯 O Problema

Desenvolvedores gastam **milhares de dólares por mês** em tokens de IA via autocompletar, chat e agentes nas IDEs. Cada requisição envia código cheio de:
- Comentários desnecessários (`// TODO`, `// fix later`)
- Espaços e tabs redundantes
- Blocos vazios e formatação excessiva

Além disso, requisições **idênticas** são enviadas repetidamente sem nenhum cache.

## 💡 A Solução: TokenGuard

O TokenGuard é um **proxy local** que roda no `localhost` e se posiciona entre a IDE e a API do LLM:

```
IDE (VS Code/Cursor) → TokenGuard (localhost:3000) → API Real (OpenAI/Claude/Gemini)
```

### O que ele faz automaticamente:
1. **🔀 Auto-Detecção** — Detecta o provedor pelo nome do modelo (zero-config)
2. **✂️ Otimização de Tokens** — Remove comentários, espaços e código morto via Regex
3. **💾 Cache Semântico** — SQLite local guarda respostas idênticas (economia de 100%)
4. **🔄 Adaptadores** — Traduz formato OpenAI ↔ Claude/Gemini transparentemente
5. **⚡ Streaming SSE** — Autocompletar em tempo real sem latência adicional

### Zero-Config: A IDE nem percebe
A IDE acha que está falando com a OpenAI. O TokenGuard intercepta, otimiza, e roteia para qualquer provedor automaticamente.

---

## ⚙️ Stack Tecnológica

| Componente | Tecnologia |
|------------|-----------|
| Backend/Proxy | Node.js + Express |
| Desktop | Electron |
| Cache | SQLite |
| Tokenização | gpt-tokenizer |
| Arquitetura | MVC + Adapter Pattern |

## 📐 Arquitetura

```
TokenGuard/
├── main.js                          # Entry point (Electron + Express + SQLite)
├── src/
│   ├── controllers/
│   │   └── ProxyController.js       # Orquestrador central (intercepta, otimiza, roteia)
│   ├── adapters/
│   │   ├── OpenAIAdapter.js         # Passthrough nativo + streaming
│   │   ├── AnthropicAdapter.js      # OpenAI ↔ Claude (tradução completa)
│   │   └── GeminiAdapter.js         # OpenAI ↔ Gemini REST (tradução completa)
│   ├── models/
│   │   ├── ModelRouter.js           # Auto-detecção de provedor por modelo
│   │   ├── CacheModel.js            # Cache semântico SQLite
│   │   └── TokenOptimizerModel.js   # Compressão de tokens via Regex
│   ├── routes/
│   │   └── apiRoutes.js             # Rotas Express centralizadas
│   └── views/
│       └── index.html               # Dashboard Electron (métricas ao vivo)
└── package.json
```

## 🚀 Como Usar

### 1. Instalar
```bash
git clone https://github.com/Juliocesar7881/WEEKEND---ECONOMIZA-TOKEN.git
cd WEEKEND---ECONOMIZA-TOKEN
npm install
npm start
```

### 2. Configurar a IDE
No `settings.json` da sua IDE:
```json
{
  "openai.baseURL": "http://localhost:3000/v1"
}
```

Use sua API key real do provedor desejado. O TokenGuard detecta tudo pelo nome do modelo.

### 3. Pronto!
O Dashboard mostra em tempo real:
- Tokens economizados
- Economia em USD
- Cache hit rate
- Log de todas as requisições

---

## 🧠 Provedores Suportados

| Provedor | Modelos | Auto-Detectado |
|----------|---------|----------------|
| OpenAI | gpt-4o, gpt-4-turbo, o1, o3 | ✅ |
| Anthropic | claude-3-5-sonnet, claude-3-opus | ✅ |
| Google | gemini-2.0-flash, gemini-1.5-pro | ✅ |
| DeepSeek | deepseek-chat, deepseek-coder | ✅ |
| Mistral | mistral-large, codestral | ✅ |
| Qualquer outro | Fallback via API compatível OpenAI | ✅ |

---

## 📊 Como Economiza Tokens

### 1. Compressão via Regex
```javascript
// ANTES (enviado pela IDE):
"// Função principal do sistema\nfunction hello()  {\n\n\n  // retorna true\n  return  true;\n\n}"

// DEPOIS (enviado pelo TokenGuard):
"function hello() {\n return true;\n}"

// Economia: 9 tokens por requisição
```

### 2. Cache Semântico (SQLite)
Requisições idênticas retornam do cache local em **< 1ms** sem chamar a API.
Em cache hit, economia é de **100% dos tokens** (input + output).

---

## 🛡️ Segurança

- **API keys nunca são armazenadas** — extraídas do header em tempo de execução
- **100% local** — nenhum dado sai do computador do desenvolvedor (exceto para a API do LLM)
- **Sem telemetria** — zero tracking, zero analytics externas

---

## 📄 Licença

MIT — Feito com 💚 para o Hackathon Weekend
