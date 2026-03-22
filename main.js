/**
 * 🚀 TokenGuard MVP — Ponto de Entrada
 * 
 * ARQUITETURA: Inicializa três sistemas em sequência:
 *   1. SQLite (Cache local para economia de tokens)
 *   2. Express (Servidor proxy no localhost:3000)
 *   3. Electron (Dashboard + System Tray para monitoramento)
 * 
 * ZERO-CONFIG: Sem chaves, sem seleção de modelo. A IDE configura
 * o baseURL para localhost:3000/v1 e o proxy faz tudo automaticamente.
 * 
 * COPILOT: Compatível com GitHub Copilot via BYOK (VS Code v1.99+)
 * e extensão "OAI Compatible Provider for Copilot".
 * 
 * SYSTEM TRAY: Minimiza para bandeja com ícone de status.
 */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const express = require('express');
const path = require('path');
const ProxyController = require('./src/controllers/ProxyController');
const createApiRoutes = require('./src/routes/apiRoutes');
const CacheModel = require('./src/models/CacheModel');

// Porta do proxy
const PROXY_PORT = 3000;

// Express App
const server = express();
server.use(express.json({ limit: '50mb' }));

// Proxy Controller (zero-config)
const proxyController = new ProxyController();

// Registra rotas
server.use(createApiRoutes(proxyController));

// Electron
let mainWindow;
let tray;

// Callbacks: encaminha métricas e logs para o Dashboard
proxyController.onStatsUpdated = (stats) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-stats', stats);
    }
};
proxyController.onRequestLogged = (entry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('request-logged', entry);
    }
};

/**
 * Cria ícone para o System Tray (gerado via nativeImage para funcionar sem arquivo externo)
 */
function createTrayIcon() {
    // Ícone 16x16 verde simples usando data URL
    const icon = nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAyElEQVR42mNkYPj/n4EKgJGBgYEZm4SRkRFYDUwNFwBZAFaHzQBkA3AagM0FyAagOxvDAJwGEHIBsgHYXIBuAIYL0A3A5gIMA8D+h7uAgYHBBIjFoWI/GBgYXjMwMHxgYGA4x8DA8BesAGQAyHAQ/Q2I54D4GxCfAtIgcfC44P8/OGYi5AKYASD/I5tFyJswA5gwfcqAlwFEuYCAAXhdgGIAbidBXQAOUSb8BuA0BdMFMBeg24nNBVhDAt0FWEMCp3QaAADLEWARnbMuKAAAAABJRU5ErkJggg=='
    );
    return icon;
}

app.whenReady().then(() => {
    // 1. Cache SQLite
    CacheModel.init();

    // 2. Servidor Proxy Express
    server.listen(PROXY_PORT, () => {
        console.log(`🚀 TokenGuard Proxy rodando em http://localhost:${PROXY_PORT}`);
        console.log(`📡 Configure sua IDE: baseURL = http://localhost:${PROXY_PORT}/v1`);
        console.log('🔑 API key extraída automaticamente do header Authorization');
        console.log('🤖 Suporta: GPT-5.4, Claude 4.6, Gemini 2.5, DeepSeek V3, Grok 3, Llama 4...');
    });

    // 3. Dashboard Electron
    mainWindow = new BrowserWindow({
        width: 1050,
        height: 720,
        minWidth: 900,
        minHeight: 600,
        autoHideMenuBar: true,
        backgroundColor: '#060918',
        titleBarStyle: 'default',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'src/views/index.html'));

    // Minimiza para tray em vez de fechar
    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // 4. System Tray
    try {
        tray = new Tray(createTrayIcon());
        tray.setToolTip('TokenGuard — Proxy Ativo');
        
        const contextMenu = Menu.buildFromTemplate([
            { 
                label: '📊 Abrir Dashboard', 
                click: () => { mainWindow.show(); mainWindow.focus(); }
            },
            { type: 'separator' },
            {
                label: '🟢 Proxy Ativo',
                type: 'checkbox',
                checked: true,
                click: (menuItem) => {
                    proxyController.toggleProxy(menuItem.checked);
                    tray.setToolTip(`TokenGuard — Proxy ${menuItem.checked ? 'Ativo' : 'Inativo'}`);
                }
            },
            { type: 'separator' },
            { 
                label: '❌ Encerrar TokenGuard', 
                click: () => { app.isQuiting = true; app.quit(); }
            }
        ]);
        
        tray.setContextMenu(contextMenu);
        tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
    } catch (err) {
        console.warn('⚠️ System Tray não disponível:', err.message);
    }
});

// IPC Events
ipcMain.on('toggle-proxy', (event, isActive) => {
    proxyController.toggleProxy(isActive);
});

ipcMain.on('clear-cache', () => {
    CacheModel.clear().then(() => {
        console.log('🗑️ Cache limpo com sucesso');
    }).catch(console.error);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    app.isQuiting = true;
});
