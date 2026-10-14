'use strict';
const { app, BrowserWindow, Menu, dialog, shell, ipcMain, nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {findWorkspace, startLocalService} = require('./runtime/local-service.cjs');
const {registerStorageMigration} = require('./runtime/storage-migration.cjs');
const resources = fs.existsSync(path.join(__dirname,'backend','gateway.cjs')) ? __dirname : path.resolve(__dirname,'..');
const workspace = findWorkspace(resources);
let BASE_URL;
function trace(stage) {
  try { if (process.env.STRIPBOT_VERIFY_FILE) fs.appendFileSync(`${process.env.STRIPBOT_VERIFY_FILE}.startup.log`, `${stage}\n`); } catch {}
}
trace('main-loaded');
let window;
let service;
app.setName('Strip Bot');
// An explicit acceptance run uses its own profile, leaving the active app alone.
if (process.env.STRIPBOT_VERIFY_PROFILE) app.setPath('userData',path.resolve(process.env.STRIPBOT_VERIFY_PROFILE));
app.setAppUserModelId('local.stripbot.desktop');
nativeTheme.themeSource = 'dark';
if (!app.requestSingleInstanceLock()) { trace('another-instance'); app.quit(); }
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(start).catch(error => { trace(`startup-error: ${error.message}`); dialog.showErrorBox('Strip Bot 启动失败', error.message); app.quit(); });
}
async function start() {
  trace('app-ready');
  Menu.setApplicationMenu(null);
  service = await startLocalService({resources,workspace,port:Number(process.env.STRIPBOT_PORT || 3060),agentExecutable:app.isPackaged ? path.join(process.resourcesPath,'opencode.exe'):undefined});
  BASE_URL = service.baseUrl;
  registerStorageMigration(ipcMain,BASE_URL,workspace);
  window = new BrowserWindow({
    title: 'Strip Bot', width: 1200, height: 850, minWidth: 420, minHeight: 560,
    show: false, backgroundColor: '#0a0a0b', autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0a0a0b', symbolColor: '#cfcfd2', height: 34 },
    icon: path.join(resources, 'public', 'strip-bot.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, partition: 'persist:stripbot', preload:path.join(__dirname,'preload.cjs') },
  });
  trace('window-created');
  window.webContents.setWindowOpenHandler(({url}) => {
    if (url === 'https://github.com/saoudi-h/solar-icons') void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`${BASE_URL}/`)) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.on('page-title-updated', event => { event.preventDefault(); window.setTitle('Strip Bot'); });
  window.once('ready-to-show', () => window.show());
  await window.loadURL(BASE_URL);
  trace('window-loaded');
  // Only explicit acceptance runs produce this local evidence file.
  if (process.env.STRIPBOT_VERIFY_FILE) {
    try {
    fs.writeFileSync(`${process.env.STRIPBOT_VERIFY_FILE}.json`, JSON.stringify({title:window.getTitle(), loadedURL:window.webContents.getURL(), packaged:app.isPackaged, rendererNodeIntegration:window.webContents.getLastWebPreferences().nodeIntegration, contextIsolation:window.webContents.getLastWebPreferences().contextIsolation, sandbox:window.webContents.getLastWebPreferences().sandbox}));
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      const image = await window.webContents.capturePage();
      fs.writeFileSync(process.env.STRIPBOT_VERIFY_FILE, image.toPNG());
    } catch (error) { trace(`capture-error: ${error.message}`); }
    } catch (error) { trace(`verification-error: ${error.message}`); }
  }
}
app.on('window-all-closed', () => { trace('window-all-closed'); app.quit(); });
app.on('before-quit', () => { void service?.close(); });
