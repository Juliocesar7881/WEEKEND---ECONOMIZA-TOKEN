/**
 * 🚀 TokenGuard MVP — Ponto de Entrada
 * 
 * ARQUITETURA: Inicializa três sistemas em sequência:
 *   1. SQLite (Cache local para economia de tokens)
 *   2. Express (Servidor proxy no localhost:3000)
 *   3. Electron (Dashboard para monitoramento)
 * 
 * ZERO-CONFIG: Não há mais configuração de chaves ou seleção de modelo.
 * O proxy detecta tudo automaticamente a partir da requisição da IDE.
 * 
 * COMO FUNCIONA:
 *   - A IDE aponta para http://localhost:3000/v1
 *   - A IDE envia a API key no header Authorization
 *   - O proxy detecta o provedor pelo nome do modelo
 *   - O TokenGuard otimiza, cacheia e repassa transparentemente
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const express = require('express');
const path = require('path');
const ProxyController = require('./src/controllers/ProxyController');
const createApiRoutes = require('./src/routes/apiRoutes');
const CacheModel = require('./src/models/CacheModel');

// Porta do proxy (pode ser alterado se 3000 estiver ocupado)
const PROXY_PORT = 3000;

// Express App
const server = express();
server.use(express.json({ limit: '50mb' })); // IDEs mandam payloads pesados de código

// Proxy Controller (zero-config — sem chaves, sem seleção manual)
const proxyController = new ProxyController();

// Registra rotas via apiRoutes centralizado
server.use(createApiRoutes(proxyController));

// Inicialização do Electron
let mainWindow;

// Callback: encaminha métricas do proxy para o Dashboard em tempo real
proxyController.onStatsUpdated = (stats) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-stats', stats);
    }
};

// Callback: encaminha log de requisições para o Dashboard
proxyController.onRequestLogged = (entry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('request-logged', entry);
    }
};

app.whenReady().then(() => {
    // 1. Inicializar Cache SQLite Local
    CacheModel.init();

    // 2. Iniciar Servidor Proxy Express
    server.listen(PROXY_PORT, () => {
        console.log(`🚀 TokenGuard Proxy rodando em http://localhost:${PROXY_PORT}`);
        console.log(`📡 Configure sua IDE: "baseURL": "http://localhost:${PROXY_PORT}/v1"`);
        console.log('🔑 A API key é extraída automaticamente do header Authorization da IDE');
    });

    // 3. Iniciar Dashboard Electron
    mainWindow = new BrowserWindow({
        width: 950,
        height: 700,
        autoHideMenuBar: true,
        backgroundColor: '#0f172a',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'src/views/index.html'));
});

// IPC: Toggle do Proxy (Ligar/Desligar via Dashboard)
ipcMain.on('toggle-proxy', (event, isActive) => {
    proxyController.toggleProxy(isActive);
});

// IPC: Limpar cache via Dashboard
ipcMain.on('clear-cache', () => {
    CacheModel.clear().then(() => {
        console.log('🗑️ Cache limpo com sucesso');
    }).catch(console.error);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
