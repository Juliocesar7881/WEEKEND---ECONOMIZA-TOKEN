#!/usr/bin/env node
// =============================================
// TokenTracker Agent - Proxy Local
// Instala no PC do funcionário
// Intercepta chamadas de IA e reporta ao servidor
// =============================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { execSync } = require('child_process');

// ---- Load config ----
const CONFIG_PATH = path.join(__dirname, 'config.json');

let config;
let isConfigured = false;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  isConfigured = true;
} catch (e) {
  config = {};
  isConfigured = false;
}

const PROXY_PORT = config.proxyPort || 3210;
const SERVER_URL = config.serverUrl || 'http://localhost:3000';
// Only set these if configured
let EMPLOYEE_ID = config.employeeId || (config.employeeName ? config.employeeName.toLowerCase().replace(/\s+/g, '.') : 'unknown');
let EMPLOYEE_NAME = config.employeeName || 'Unknown';
let PC_ID = config.pcId || require('os').hostname();
let DEPARTMENT = config.department || '';
let ROLE = config.role || '';

// ---- Load logo as base64 ----
let LOGO_BASE64 = '';
try {
  const logoPath = path.join(__dirname, 'logo.png');
  if (fs.existsSync(logoPath)) {
    LOGO_BASE64 = fs.readFileSync(logoPath).toString('base64');
  }
} catch {}

// ---- AI API routing ----
// The agent detects which AI the request is for based on the URL path
const AI_ROUTES = {
  // Anthropic / Claude
  '/v1/messages': {
    target: 'https://api.anthropic.com',
    service: 'anthropic',
    extractTokens: extractAnthropicTokens,
  },
  '/v1/complete': {
    target: 'https://api.anthropic.com',
    service: 'anthropic',
    extractTokens: extractAnthropicTokens,
  },
  // OpenAI / ChatGPT / Cursor (OpenAI-compatible)
  '/v1/chat/completions': {
    target: 'https://api.openai.com',
    service: 'openai',
    extractTokens: extractOpenAITokens,
  },
  '/v1/completions': {
    target: 'https://api.openai.com',
    service: 'openai',
    extractTokens: extractOpenAITokens,
  },
  '/v1/embeddings': {
    target: 'https://api.openai.com',
    service: 'openai',
    extractTokens: extractOpenAITokens,
  },
  // Google / Gemini / Antigravity
  '/v1beta/models': {
    target: 'https://generativelanguage.googleapis.com',
    service: 'google',
    extractTokens: extractGoogleTokens,
  },
};

// ---- Token extraction from responses ----
function extractAnthropicTokens(body) {
  try {
    const data = JSON.parse(body);
    return {
      model: data.model || '',
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0,
    };
  } catch { return { model: '', input: 0, output: 0 }; }
}

function extractOpenAITokens(body) {
  try {
    const data = JSON.parse(body);
    return {
      model: data.model || '',
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0,
    };
  } catch { return { model: '', input: 0, output: 0 }; }
}

function extractGoogleTokens(body) {
  try {
    const data = JSON.parse(body);
    const meta = data.usageMetadata || {};
    return {
      model: data.modelVersion || '',
      input: meta.promptTokenCount || 0,
      output: meta.candidatesTokenCount || 0,
    };
  } catch { return { model: '', input: 0, output: 0 }; }
}

// ---- Find matching route ----
function findRoute(urlPath) {
  // Check exact matches first
  for (const [pattern, route] of Object.entries(AI_ROUTES)) {
    if (urlPath.startsWith(pattern)) {
      return route;
    }
  }
  // Google Gemini has model-specific paths
  if (urlPath.includes('/models/') && (urlPath.includes(':generateContent') || urlPath.includes(':streamGenerateContent'))) {
    return {
      target: 'https://generativelanguage.googleapis.com',
      service: 'google',
      extractTokens: extractGoogleTokens,
    };
  }
  return null;
}

// ---- Report usage to central server ----
function reportUsage(service, model, tokensInput, tokensOutput) {
  const payload = JSON.stringify({
    employeeId: EMPLOYEE_ID,
    employeeName: EMPLOYEE_NAME,
    pcId: PC_ID,
    department: DEPARTMENT,
    role: ROLE,
    service,
    model,
    tokensInput,
    tokensOutput,
  });

  const url = new URL('/api/usage', SERVER_URL);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    timeout: 5000,
  };

  const transport = url.protocol === 'https:' ? https : http;
  const req = transport.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        const data = JSON.parse(body);
        console.log(`  📊 Reportado: ${service} | ${model || '?'} | ${tokensInput + tokensOutput} tokens | $${data.cost?.toFixed(4) || '?'}`);
      } else {
        console.error(`  ⚠️  Falha ao reportar: ${res.statusCode}`);
      }
    });
  });
  req.on('error', (err) => {
    console.error(`  ⚠️  Servidor indisponível: ${err.message}`);
  });
  req.write(payload);
  req.end();
}

// ---- Status page HTML ----
function getStatusPageHTML() {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const secs = Math.floor(uptime % 60);
  const uptimeStr = `${hours}h ${mins}m ${secs}s`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TokenTracker Agent - Status</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 600px;
      width: 90%;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 16px;
      padding: 40px;
      backdrop-filter: blur(10px);
      box-shadow: 0 25px 50px rgba(0,0,0,0.4);
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .header .icon {
      font-size: 48px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      background: linear-gradient(135deg, #818cf8, #6366f1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #4ade80;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 12px;
    }
    .status-badge .dot {
      width: 8px; height: 8px;
      background: #4ade80;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .info-grid {
      display: grid;
      gap: 12px;
      margin-bottom: 28px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(15, 23, 42, 0.6);
      border-radius: 10px;
      border: 1px solid rgba(99, 102, 241, 0.1);
    }
    .info-item .label {
      color: #94a3b8;
      font-size: 13px;
    }
    .info-item .value {
      font-weight: 600;
      font-size: 14px;
      color: #c7d2fe;
    }
    .endpoints {
      background: rgba(15, 23, 42, 0.6);
      border-radius: 10px;
      border: 1px solid rgba(99, 102, 241, 0.1);
      padding: 16px;
    }
    .endpoints h3 {
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .endpoint {
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 12px;
      color: #818cf8;
      padding: 4px 0;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: #64748b;
    }
    .footer a {
      color: #818cf8;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${LOGO_BASE64 ? `<img src="data:image/png;base64,${LOGO_BASE64}" alt="Norte.AI" style="width:72px;height:72px;margin-bottom:12px;">` : '<div class="icon">🔵</div>'}
      <h1>Norte.AI Agent</h1>
      <div class="status-badge"><span class="dot"></span> Proxy Ativo</div>
    </div>
    <div class="info-grid">
      <div class="info-item">
        <span class="label">Usuário</span>
        <span class="value">${EMPLOYEE_NAME}</span>
      </div>
      <div class="info-item">
        <span class="label">PC</span>
        <span class="value">${PC_ID}</span>
      </div>
      <div class="info-item">
        <span class="label">Cargo</span>
        <span class="value">${ROLE || '—'}</span>
      </div>
      <div class="info-item">
        <span class="label">Servidor</span>
        <span class="value">${SERVER_URL}</span>
      </div>
      <div class="info-item">
        <span class="label">Porta do Proxy</span>
        <span class="value">${PROXY_PORT}</span>
      </div>
      <div class="info-item">
        <span class="label">Uptime</span>
        <span class="value">${uptimeStr}</span>
      </div>
    </div>
    <div class="endpoints">
      <h3>Endpoints Suportados</h3>
      <div class="endpoint">POST /v1/chat/completions (OpenAI / Cursor)</div>
      <div class="endpoint">POST /v1/messages (Anthropic / Claude)</div>
      <div class="endpoint">POST /v1/completions (OpenAI)</div>
      <div class="endpoint">POST /v1/embeddings (OpenAI)</div>
      <div class="endpoint">POST /v1beta/models/* (Google / Gemini)</div>
    </div>
    <div class="footer">
      <p>Configure suas IAs para usar <strong>http://localhost:${PROXY_PORT}</strong></p>
      <p style="margin-top:8px;">Dashboard: <a href="${SERVER_URL}" target="_blank">${SERVER_URL}</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ---- Setup page HTML ----
function getSetupPageHTML() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Setup - Norte.AI Agent</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    form { background: #1e293b; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 100%; max-width: 400px; }
    h2 { margin: 0 0 24px; text-align: center; color: #818cf8; }
    label { display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; }
    input { width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: white; outline: none; box-sizing: border-box; }
    input:focus { border-color: #6366f1; }
    button { width: 100%; padding: 12px; background: #6366f1; border: none; border-radius: 6px; color: white; font-weight: bold; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <form action="/setup" method="POST">
    <h2>Configurar Agent</h2>
    <label>Nome Completo</label>
    <input type="text" name="employeeName" placeholder="Ex: João da Silva" required>
    
    <label>Cargo</label>
    <input type="text" name="role" placeholder="Ex: Desenvolvedor Senior" required>
    
    <label>URL do Servidor Dashboard</label>
    <input type="url" name="serverUrl" placeholder="Ex: http://192.168.0.10:3000" required value="http://localhost:3000">
    
    <button type="submit">Salvar e Iniciar</button>
  </form>
</body>
</html>`;
}

// ---- Proxy Server ----
const server = http.createServer((clientReq, clientRes) => {
  // ---- Setup Mode ----
  if (!isConfigured) {
    if (clientReq.method === 'GET') {
      clientRes.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      clientRes.end(getSetupPageHTML());
      return;
    } else if (clientReq.method === 'POST' && clientReq.url === '/setup') {
      let body = '';
      clientReq.on('data', chunk => body += chunk);
      clientReq.on('end', () => {
        const formData = new URLSearchParams(body);
        const newConfig = {
          employeeName: formData.get('employeeName') || '',
          role: formData.get('role') || '',
          serverUrl: formData.get('serverUrl') || 'http://localhost:3000',
          proxyPort: 3210,
          pcId: require('os').hostname()
        };
        newConfig.employeeId = newConfig.employeeName.toLowerCase().replace(/\s+/g, '.');
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
        
        // Update live variables
        config = newConfig;
        EMPLOYEE_ID = config.employeeId;
        EMPLOYEE_NAME = config.employeeName;
        ROLE = config.role;
        PC_ID = config.pcId;
        isConfigured = true;

        clientRes.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        clientRes.end(`
          <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: white;">
            <h2>✅ Configurado com sucesso!</h2>
            <p>O Agent agora está ativo. Você pode fechar esta aba.</p>
            <script>setTimeout(() => window.location.href = '/', 2000)</script>
          </div>
        `);
      });
      return;
    }
  }

  // ---- Status page (root) ----
  if (clientReq.method === 'GET' && (clientReq.url === '/' || clientReq.url === '/index.html')) {
    clientRes.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    clientRes.end(getStatusPageHTML());
    return;
  }

  // ---- Health check ----
  if (clientReq.method === 'GET' && clientReq.url === '/health') {
    clientRes.writeHead(200, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), employee: EMPLOYEE_ID }));
    return;
  }

  // ---- OpenAI-compatible /v1/models (for IDE compatibility) ----
  if (clientReq.method === 'GET' && (clientReq.url === '/v1/models' || clientReq.url === '/v1/models/')) {
    clientRes.writeHead(200, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({
      object: 'list',
      data: [
        { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
        { id: 'gpt-4.1', object: 'model', owned_by: 'openai' },
        { id: 'gpt-5.4', object: 'model', owned_by: 'openai' },
        { id: 'claude-sonnet-4-20250514', object: 'model', owned_by: 'anthropic' },
        { id: 'claude-opus-4-20250514', object: 'model', owned_by: 'anthropic' },
        { id: 'gemini-2.5-pro', object: 'model', owned_by: 'google' },
      ]
    }));
    return;
  }

  const route = findRoute(clientReq.url);

  if (!route) {
    // For GET requests to unknown paths, show a friendly redirect
    if (clientReq.method === 'GET') {
      clientRes.writeHead(302, { 'Location': '/' });
      clientRes.end();
    } else {
      clientRes.writeHead(404, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: `Rota não reconhecida: ${clientReq.url}. Use endpoints compatíveis com OpenAI, Anthropic ou Google AI.` }));
    }
    return;
  }

  // Collect request body
  let requestBody = '';
  clientReq.on('data', chunk => requestBody += chunk);
  clientReq.on('end', () => {
    const targetUrl = new URL(clientReq.url, route.target);
    const isHttps = targetUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    // Copy headers, remove host
    const headers = { ...clientReq.headers };
    headers.host = targetUrl.hostname;
    delete headers['content-length'];
    if (requestBody) {
      headers['content-length'] = Buffer.byteLength(requestBody);
    }

    // Detect service more precisely from request
    let detectedService = route.service;
    try {
      const reqData = JSON.parse(requestBody);
      if (reqData.model) {
        if (reqData.model.includes('claude')) detectedService = 'anthropic';
        else if (reqData.model.includes('gpt') || reqData.model.includes('o1') || reqData.model.includes('o3') || reqData.model.includes('o4')) detectedService = 'openai';
        else if (reqData.model.includes('gemini')) detectedService = 'google';
        else if (reqData.model.includes('cursor')) detectedService = 'cursor';
      }
    } catch {}

    const proxyOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: clientReq.method,
      headers,
      timeout: 120000,
    };

    console.log(`  → ${clientReq.method} ${route.service} ${clientReq.url}`);

    const proxyReq = transport.request(proxyOptions, (proxyRes) => {
      let responseBody = '';
      const isStreaming = proxyRes.headers['content-type']?.includes('text/event-stream');

      // Forward status + headers
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);

      if (isStreaming) {
        // For streaming responses, pipe through and estimate tokens after
        proxyRes.pipe(clientRes);

        proxyRes.on('data', chunk => responseBody += chunk);
        proxyRes.on('end', () => {
          // For streaming, try to extract from last [DONE] message or estimate
          const lines = responseBody.split('\n').filter(l => l.startsWith('data: '));
          let totalOutput = 0;
          let model = '';
          for (const line of lines) {
            try {
              const data = JSON.parse(line.replace('data: ', ''));
              if (data.usage) {
                totalOutput = data.usage.completion_tokens || data.usage.output_tokens || 0;
                model = data.model || model;
              }
              if (data.model) model = data.model;
            } catch {}
          }
          // Estimate input tokens from request body
          const inputEstimate = Math.ceil((requestBody.length) / 4);
          const outputEstimate = totalOutput || Math.ceil(responseBody.length / 4);
          reportUsage(detectedService, model, inputEstimate, outputEstimate);
        });
      } else {
        // Non-streaming: collect full response then extract
        proxyRes.on('data', chunk => {
          responseBody += chunk;
          clientRes.write(chunk);
        });
        proxyRes.on('end', () => {
          clientRes.end();
          const tokens = route.extractTokens(responseBody);
          reportUsage(detectedService, tokens.model, tokens.input, tokens.output);
        });
      }
    });

    proxyReq.on('error', (err) => {
      console.error(`  ❌ Erro ao conectar com ${route.target}: ${err.message}`);
      clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: `Não foi possível conectar com ${route.service}: ${err.message}` }));
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      clientRes.writeHead(504, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: 'Timeout ao conectar com a API' }));
    });

    if (requestBody) {
      proxyReq.write(requestBody);
    }
    proxyReq.end();
  });
});

function startServer() {
  server.listen(PROXY_PORT, '127.0.0.1', () => {
    console.log('');
    console.log('  ========================================');
    console.log('       Norte.AI - TokenTracker Agent');
    console.log('  ========================================');
    if (!isConfigured) {
      console.log(`  🔗 Acesse para configurar: http://localhost:${PROXY_PORT}`);
      console.log('');
      try {
        if (process.platform === 'win32') {
          execSync(`start http://localhost:${PROXY_PORT}`);
        } else if (process.platform === 'darwin') {
          execSync(`open http://localhost:${PROXY_PORT}`);
        } else {
          execSync(`xdg-open http://localhost:${PROXY_PORT}`);
        }
      } catch (e) {}
    } else {
      console.log(`  Proxy:    http://localhost:${PROXY_PORT}`);
      console.log(`  Servidor: ${SERVER_URL}`);
      console.log(`  Usuario:  ${EMPLOYEE_NAME}`);
      console.log(`  PC:       ${PC_ID}`);
      console.log('  ----------------------------------------');
      console.log('  Configure suas ferramentas de IA para');
      console.log(`  usar: http://localhost:${PROXY_PORT}`);
      console.log('  ========================================');
      console.log('');
      console.log('  Aguardando requisicoes...');
      console.log('');
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`  [!] Porta ${PROXY_PORT} ja esta em uso.`);
      console.log('  [!] Tentando fechar processo anterior...');
      try {
        // Find and kill the process using the port
        const result = execSync(`netstat -ano | findstr :${PROXY_PORT} | findstr LISTENING`, { encoding: 'utf-8', timeout: 5000 });
        const lines = result.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            console.log(`  [!] Finalizando PID ${pid}...`);
            try { execSync(`taskkill /F /PID ${pid}`, { timeout: 5000 }); } catch {}
          }
        }
        // Wait a moment then retry
        setTimeout(() => {
          console.log('  [!] Reiniciando na porta ' + PROXY_PORT + '...');
          server.close();
          const retryServer = http.createServer(server.listeners('request')[0]);
          retryServer.listen(PROXY_PORT, '127.0.0.1', () => {
            console.log(`  [OK] Agent rodando em http://localhost:${PROXY_PORT}`);
            console.log('');
          });
          retryServer.on('error', (retryErr) => {
            console.error(`  [ERRO] Nao foi possivel iniciar na porta ${PROXY_PORT}: ${retryErr.message}`);
            console.error('  Feche o processo que esta usando a porta e tente novamente.');
            process.exit(1);
          });
        }, 1500);
      } catch (killErr) {
        console.error(`  [ERRO] Nao foi possivel liberar a porta ${PROXY_PORT}.`);
        console.error('  Feche manualmente o processo que esta usando a porta e tente novamente.');
        process.exit(1);
      }
    } else {
      console.error(`  [ERRO] ${err.message}`);
      process.exit(1);
    }
  });
}

startServer();
