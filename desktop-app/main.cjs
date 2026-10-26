'use strict';
if(process.argv.includes('--nono-pet')){
  require(require('node:path').join(process.resourcesPath,'nono-desktop','desktop.cjs'));
}else if(process.argv.includes(require('node:path').join(process.resourcesPath,'dsh-pet','runtime','electron-helper','main.js'))){
  require(require('node:path').join(process.resourcesPath,'dsh-pet','runtime','electron-helper','main.js'));
}else{
const { app, BrowserWindow, Menu, dialog, shell, ipcMain, nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {findWorkspace, startLocalService} = require('./runtime/local-service.cjs');
const {getAppearance}=require('./runtime/window-appearance.cjs');
const STRIP_TITLEBAR_HEIGHT=48;
const {registerStorageMigration} = require('./runtime/storage-migration.cjs');
const resources = fs.existsSync(path.join(__dirname,'backend','gateway.cjs')) ? __dirname : path.resolve(__dirname,'..');
const discoveredWorkspace = findWorkspace(resources);
const workspace = app.isPackaged && !process.env.STRIPBOT_WORKSPACE_ROOT ? null : discoveredWorkspace;
let dataRoot;
let BASE_URL;
function trace(stage) {
  try { if (process.env.STRIPBOT_VERIFY_FILE) fs.appendFileSync(`${process.env.STRIPBOT_VERIFY_FILE}.startup.log`, `${stage}\n`); } catch {}
}
trace('main-loaded');
let window;
let service;
let updates;
app.setName('Strip Bot');
// An explicit acceptance run uses its own profile, leaving the active app alone.
if (process.env.STRIPBOT_VERIFY_PROFILE) app.setPath('userData',path.resolve(process.env.STRIPBOT_VERIFY_PROFILE));
dataRoot = app.getPath('userData');
app.setAppUserModelId('local.stripbot.desktop');
nativeTheme.themeSource = 'light';
if (!app.requestSingleInstanceLock()) { trace('another-instance'); app.quit(); }
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(start).catch(error => { trace(`startup-error: ${error.message}`); dialog.showErrorBox('Strip Bot 启动失败', error.message); app.quit(); });
}
async function start() {
  trace('app-ready');
  Menu.setApplicationMenu(null);
  service = await startLocalService({resources,workspace,dataRoot,port:Number(process.env.STRIPBOT_PORT || 3060),agentExecutable:app.isPackaged ? path.join(process.resourcesPath,'codex','bin','codex.exe'):undefined});
  BASE_URL = service.baseUrl;
  registerStorageMigration(ipcMain,BASE_URL,workspace);
  ipcMain.on('stripbot:appearance',(event,appearance)=>{
    if(!window || window.isDestroyed() || event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame)return;
    const palette=getAppearance(appearance);if(!palette)return;
    nativeTheme.themeSource=palette.theme;
    window.setBackgroundColor(palette.backgroundColor);
    window.setTitleBarOverlay({color:palette.color,symbolColor:palette.symbolColor,height:STRIP_TITLEBAR_HEIGHT});
  });
  window = new BrowserWindow({
    title: 'Strip Bot', width: 1200, height: 850, minWidth: 420, minHeight: 700,
    show: false, backgroundColor: '#faf9f6', autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#faf9f6', symbolColor: '#4a4139', height: STRIP_TITLEBAR_HEIGHT },
    icon: path.join(resources, 'public', 'strip-bot.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, partition: 'persist:stripbot', preload:path.join(__dirname,'preload.cjs') },
  });
  trace('window-created');
  window.webContents.setWindowOpenHandler(({url}) => {
    const allowExternal = (()=>{try{const target=new URL(url);if(target.protocol==='https:' && target.hostname==='auth.openai.com' && !target.username && !target.password)return true;if(target.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(target.hostname) && ['6185','6099'].includes(target.port) && (target.pathname==='/' || target.pathname.startsWith('/webui')))return true;return url === 'https://github.com/saoudi-h/solar-icons';}catch{return false;}})();
    if (allowExternal) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`${BASE_URL}/`)) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.on('page-title-updated', event => { event.preventDefault(); window.setTitle('Strip Bot'); });
  window.once('ready-to-show', () => window.show());
  const updateSupport=app.isPackaged&&fs.existsSync(path.join(process.resourcesPath,'app-update.yml'));
  updates=require('./runtime/updates.cjs').createUpdates({app,ipcMain,getWindow:()=>window,baseUrl:BASE_URL,supported:updateSupport,
    updater:updateSupport?require('electron-updater').autoUpdater:null,
    beforeInstall:async()=>{await require(path.join(resources,'plugins','deepseek-harness-pet','index.cjs')).stop();}});
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
app.on('before-quit', () => { updates?.dispose(); void service?.close(); });
}
