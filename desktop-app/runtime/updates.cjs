'use strict';
const CHANNELS={status:'stripbot:update-status',check:'stripbot:update-check',download:'stripbot:update-download',install:'stripbot:update-install'};
function createUpdates({app,ipcMain,updater,getWindow,baseUrl,supported,beforeInstall=async()=>{}}){
  let state={status:supported?'idle':'unsupported',version:app.getVersion(),nextVersion:'',progress:0,message:supported?'启动后自动检查更新。':'请使用正式安装版启用自动更新。'};
  let closed=false;
  function snapshot(){return {...state};}
  function set(patch){state={...state,...patch};const win=getWindow();if(!closed&&win&&!win.isDestroyed())win.webContents.send(CHANNELS.status,snapshot());}
  function authorize(event){const win=getWindow();if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||new URL(event.sender.getURL()).origin!==baseUrl)throw Error('更新请求来源无效。');}
  function ready(){if(!supported)throw Error('请先安装正式版本。');}
  async function check(){
    ready();if(['checking','downloading','downloaded'].includes(state.status))return snapshot();
    set({status:'checking',message:'正在检查新版本…'});
    try{await updater.checkForUpdates();}catch{set({status:'error',message:'检查更新失败，请检查网络后重试。'});}
    return snapshot();
  }
  async function download(){
    ready();if(state.status==='downloading')return snapshot();
    if(state.status!=='available')throw Error('请先检查可用更新。');
    set({status:'downloading',progress:0,message:'正在下载更新…'});
    try{await updater.downloadUpdate();}catch{set({status:'error',message:'下载更新失败，请重新检查后重试。'});}
    return snapshot();
  }
  async function install(){
    ready();if(state.status!=='downloaded')throw Error('更新尚未下载完成。');
    await beforeInstall();
    setImmediate(()=>updater.quitAndInstall(false,true));
    return snapshot();
  }
  const events={
    'update-available':info=>set({status:'available',nextVersion:String(info.version),message:'发现新版本，可下载更新。'}),
    'update-not-available':()=>set({status:'current',message:'当前已是最新版本。'}),
    'download-progress':info=>set({progress:Math.max(0,Math.min(100,Number(info.percent)||0))}),
    'update-downloaded':info=>set({status:'downloaded',nextVersion:String(info.version),progress:100,message:'更新已下载，重启后安装。'}),
    'error':()=>set({status:'error',message:'更新服务暂时不可用，请稍后重试。'})
  };
  if(supported){updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;for(const [event,fn]of Object.entries(events))updater.on(event,fn);}
  for(const [action,channel]of Object.entries(CHANNELS))ipcMain.handle(channel,async event=>{authorize(event);return action==='status'?snapshot():action==='check'?check():action==='download'?download():install();});
  const startup=supported?setTimeout(()=>void check().catch(()=>{}),30000):null;
  const interval=supported?setInterval(()=>{if(['idle','current','error'].includes(state.status))void check().catch(()=>{});},6*60*60*1000):null;
  startup?.unref();interval?.unref();
  return {snapshot,check,download,install,dispose(){closed=true;clearTimeout(startup);clearInterval(interval);for(const channel of Object.values(CHANNELS))ipcMain.removeHandler(channel);if(supported)for(const [event,fn]of Object.entries(events))updater.removeListener(event,fn);}};
}
module.exports={createUpdates,CHANNELS};
