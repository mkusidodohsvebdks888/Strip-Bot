'use strict';
// StripBot Q-style dsh-pet adapter. No DSH host is required for standalone mode.
// Keep plugin ID for backward-compatible saved enable/disable preferences.
const fs=require('node:fs/promises');
const {existsSync}=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const {fail}=require('../_shared.cjs');
let active=null;

function findExternal(baseDir,relative){
  let current=path.resolve(baseDir);
  for(let depth=0;depth<12;depth++){
    const candidate=path.join(current,relative);
    if(existsSync(candidate))return candidate;
    const parent=path.dirname(current);
    if(parent===current)break;
    current=parent;
  }
  return null;
}

function resolveScript({env=process.env,baseDir=__dirname}={}){
  // Explicit local built script for installed Electron apps; never take a path from HTTP.
  if(env.DSH_PET_STANDALONE_PATH){
    if(!path.isAbsolute(env.DSH_PET_STANDALONE_PATH))return null;
    if(path.basename(env.DSH_PET_STANDALONE_PATH)!=='standalone.js')return null;
    return path.resolve(env.DSH_PET_STANDALONE_PATH);
  }
  // Root project source clone / pinned dsh-pet submodule.
  if(process.resourcesPath){const bundled=path.join(process.resourcesPath,'dsh-pet','lib','standalone.js');if(existsSync(bundled))return bundled;}
  const relative=path.join('桌宠','DeepSeek-Q版-dsh-pet','dsh-pet','lib','standalone.js');
  return findExternal(baseDir,relative)||path.resolve(baseDir,'..','..',relative);
}
function running(){
  return !!active&&!active.killed&&active.exitCode===null&&active.signalCode===null;
}
async function status({env=process.env,baseDir=__dirname,platform=process.platform}={}){
  const script=resolveScript({env,baseDir});
  const installed=!!(script&&(await fs.stat(script).catch(()=>null))?.isFile());
  const command=script||'DSH_PET_STANDALONE_PATH 未配置';
  return {
    dependency:'dsh-pet standalone / Node.js >= 22.12',
    command,installed,supported:['win32','linux','darwin'].includes(platform),running:running(),
    description:installed
      ? 'Q 版蓝发鲸鱼娘已就绪，可在 StripBot 中确认启动；独立模式不直接读取 StripBot AI 会话状态。'
      : '请先初始化固定版本的 Q 版桌宠源码并构建，或通过 DSH_PET_STANDALONE_PATH 指向已构建的 standalone.js。'
  };
}
async function launch({env=process.env,baseDir=__dirname,spawnImpl=spawn}={}){
  if(running())return {ok:true,alreadyRunning:true,message:'Q 版桌宠已在运行。'};
  const local=await status({env,baseDir});
  if(!local.supported)throw fail('当前平台不支持该桌宠。');
  if(!local.installed)throw fail('尚未构建 Q 版桌宠。请参照 plugins/deepseek-harness-pet/README.md 的安装步骤。',503);
  const bundledNode=process.resourcesPath&&path.join(process.resourcesPath,'node','node.exe');
  const runtime=env.DSH_PET_NODE_BIN||(bundledNode&&existsSync(bundledNode)?bundledNode:'node');
  if(runtime.includes('\n')||runtime.includes('\r'))throw fail('Node.js 启动程序路径无效。');
  const childEnv={...env};
  // Reuse the locally installed Electron runtime instead of downloading one on launch.
  if(!childEnv.DSH_PET_ELECTRON_PATH){
    if(process.resourcesPath&&existsSync(path.join(process.resourcesPath,'dsh-pet','runtime','electron-helper','main.js')))childEnv.DSH_PET_ELECTRON_PATH=process.execPath;
    const electron=findExternal(path.dirname(local.command),path.join('desktop-app','node_modules','electron','dist',process.platform==='win32'?'electron.exe':'electron'));
    if(electron)childEnv.DSH_PET_ELECTRON_PATH=electron;
  }
  delete childEnv.ELECTRON_RUN_AS_NODE;
  return new Promise((resolve,reject)=>{
    let settled=false;
    const child=spawnImpl(runtime,[local.command,'--port','3100'],{
      cwd:path.dirname(local.command),shell:false,windowsHide:true,
      detached:false,stdio:'ignore',env:childEnv
    });
    const success=()=>{
      if(settled)return;
      settled=true;
      active=child;
      resolve({ok:true,message:'已请求启动 Q 版 DeepSeek 桌宠（独立模式）。',output:local.command});
    };
    child.once('error',error=>{
      if(!settled){settled=true;reject(fail('无法启动 Q 版桌宠：'+error.message,503));}
      if(active===child)active=null;
    });
    child.once('exit',()=>{if(active===child)active=null;});
    child.once('spawn',success);
  });
}
async function stop(){
  if(!running())return {ok:true,message:'Q 版桌宠没有由 StripBot 启动的运行进程。'};
  const child=active;
  const runtimeFile=path.join(process.env.DSH_HOME||path.join(os.homedir(),'.dsh'),'dsh-pet','standalone-runtime.json');
  const state=await fs.readFile(runtimeFile,'utf8').then(JSON.parse).catch(()=>null);
  if(state&&state.pid===child.pid&&state.port===3100){
    // Windows SIGTERM kills Node immediately, leaving the transparent helper window orphaned.
    // Let the standalone service dispose its helper before exiting instead.
    const exited=new Promise(resolve=>child.once('exit',resolve));
    const response=await fetch('http://127.0.0.1:3100/shutdown',{
      method:'POST',headers:{'x-dsh-pet-token':state.token},signal:AbortSignal.timeout(5000)
    });
    if(!response.ok)throw fail('桌宠关闭失败，请重试。',503);
    let timer;
    try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail('等待桌宠关闭超时，请重试。',503)),5000);})]);}
    finally{clearTimeout(timer);}
  }else child.kill('SIGTERM');
  return {ok:true,message:'已请求关闭由 StripBot 启动的 Q 版桌宠。'};
}
async function execute({action}={}){
  if(action==='launch')return launch();
  if(action==='stop')return stop();
  throw fail('Q 版桌宠仅支持启动或停止操作。');
}
module.exports={status,execute,resolveScript,launch,stop};
