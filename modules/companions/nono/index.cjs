'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {randomBytes,timingSafeEqual}=require('node:crypto');
const {httpError}=require('../../core/providers/index.cjs');
const run=promisify(execFile);

async function findPython(){
  const candidates=[['py',['-3']],['python',[]],...[310,311,312,313,314].map(v=>[path.join(process.env.LOCALAPPDATA || '', 'Programs','Python','Python'+v,'python.exe'),[]])];
  for(const [command,args] of candidates){try{await run(command,[...args,'-c','import sys,tkinter; assert sys.version_info >= (3,9)'],{windowsHide:true,timeout:5000});return {command,args};}catch{}}
  throw httpError(503,'未找到带 Tcl/Tk 的 Python 3.9+，请先安装 Python 并勾选 Tcl/Tk。');
}
async function findDesktopRuntime(pluginDir){
  if(process.versions.electron)return {command:process.execPath,args:['--nono-pet']};
  for(const command of [path.join(__dirname,'..','..','..','desktop-app','node_modules','electron','dist','electron.exe'),path.join(__dirname,'..','..','..','.runtime','electron-runtime','electron.exe')]){
    try{await fs.access(command);return {command,args:[path.join(pluginDir,'desktop.cjs')]};}catch{}
  }
  throw httpError(503,'未找到 Strip Bot 桌面运行时，请使用桌面版启动插件。');
}
function createNonoPlugin({root,pluginDir=process.versions.electron?path.join(process.resourcesPath,'nono-desktop'):path.join(__dirname,'..','..','..','plugins','nono-desktop'),chat,platform=process.platform,runtime=findDesktopRuntime,spawnImpl=spawn}){
  let child=null,token='',state='stopped',error='',origin='',queue=Promise.resolve(),busy=false,closed=false,startupTimer;
  const requests=new Set();
  const settings=path.join(root,'.runtime','nono-plugin.json');
  let enabled=false;
  const status=()=>({id:'nono-desktop',enabled,running:!!child,state,error,supported:platform==='win32'});
  const save=async()=>{await fs.mkdir(path.dirname(settings),{recursive:true});await fs.writeFile(settings,JSON.stringify({enabled}));};
  function stop(){clearTimeout(startupTimer);token='';for(const controller of requests)controller.abort();requests.clear();busy=false;const previous=child;child=null;state='stopped';if(previous)previous.kill();}
  async function start(){
    if(child)return status();
    if(platform!=='win32')throw httpError(400,'此桌面宠物插件只支持 Windows。');
    if(!origin)throw httpError(503,'Strip Bot 服务尚未就绪。');
    await fs.access(path.join(pluginDir,'desktop.cjs'));
    const selected=await runtime(pluginDir);if(closed)throw httpError(503,'Strip Bot 正在关闭。');
    token=randomBytes(32).toString('hex');error='';state='starting';
    const environment=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/(api.?key|token|secret|password|credential)/i.test(name)));
    const current=spawnImpl(selected.command,selected.args,{cwd:pluginDir,windowsHide:true,stdio:'ignore',env:{...environment,NONO_STRIPBOT_URL:origin,NONO_STRIPBOT_TOKEN:token}});
    child=current;
    startupTimer=setTimeout(()=>{if(child===current && state==='starting'){stop();error='3D 宠物未能启动，请检查显卡 WebGL 2 支持和插件文件。';}},20000);startupTimer.unref?.();
    current.once('error',()=>{if(child===current){stop();error='3D 桌面宠物启动失败，请检查桌面运行时和插件文件。';}});
    current.once('exit',()=>{if(child===current){const starting=state==='starting';stop();if(starting)error='3D 宠物启动中断，请检查桌面运行时和显卡支持。';}});
    return status();
  }
  const serialized=fn=>{const pending=queue.then(fn);queue=pending.catch(()=>{});return pending;};
  return {
    status,
    async initialize(base){origin=base;try{enabled=JSON.parse(await fs.readFile(settings,'utf8')).enabled===true;}catch{}if(enabled&&!closed)try{await start();}catch(e){error=e.message;state='stopped';}},
    setEnabled(value){return serialized(async()=>{if(typeof value!=='boolean')throw httpError(400,'启停参数无效。');if(value){try{await start();enabled=true;await save();}catch(e){stop();enabled=false;error=e.message;throw e;}}else{enabled=false;stop();error='';await save();}return status();});},
    authenticate(value){const given=Buffer.from(String(value || ''));const expected=Buffer.from('Bearer '+token);if(!token || given.length!==expected.length || !timingSafeEqual(given,expected))throw httpError(401,'桌面宠物连接已失效，请在设置中重新启用。');},
    ready(){clearTimeout(startupTimer);state='running';return {ok:true};},
    async chat(messages,signal){
      if(busy)throw httpError(409,'糯糯正在回复，请稍候。');
      const controller=new AbortController();busy=controller;requests.add(controller);
      const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      const timer=setTimeout(abort,90000);
      try{return await chat(messages,controller.signal);}finally{clearTimeout(timer);requests.delete(controller);signal?.removeEventListener('abort',abort);if(busy===controller)busy=false;}
    },
    close(){closed=true;stop();}
  };
}
module.exports={createNonoPlugin,findPython,findDesktopRuntime};
