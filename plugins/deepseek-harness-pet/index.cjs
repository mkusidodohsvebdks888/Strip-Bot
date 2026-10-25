'use strict';
// StripBot Q-style dsh-pet adapter. No DSH host is required for standalone mode.
// Keep plugin ID for backward-compatible saved enable/disable preferences.
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {fail}=require('../_shared.cjs');
let active=null;

function resolveScript({env=process.env,baseDir=__dirname}={}){
  // Explicit local built script for installed Electron apps; never take a path from HTTP.
  if(env.DSH_PET_STANDALONE_PATH){
    if(!path.isAbsolute(env.DSH_PET_STANDALONE_PATH))return null;
    if(path.basename(env.DSH_PET_STANDALONE_PATH)!=='standalone.js')return null;
    return path.resolve(env.DSH_PET_STANDALONE_PATH);
  }
  // Root project source clone / pinned dsh-pet submodule.
  return path.resolve(baseDir,'..','..','桌宠','DeepSeek-Q版-dsh-pet','dsh-pet','lib','standalone.js');
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
  const runtime=env.DSH_PET_NODE_BIN||'node';
  if(runtime.includes('\n')||runtime.includes('\r'))throw fail('Node.js 启动程序路径无效。');
  return new Promise((resolve,reject)=>{
    let settled=false;
    const child=spawnImpl(runtime,[local.command,'--port','3100'],{
      cwd:path.dirname(local.command),shell:false,windowsHide:true,
      detached:false,stdio:'ignore',env:{...env}
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
  child.kill('SIGTERM');
  return {ok:true,message:'已请求关闭由 StripBot 启动的 Q 版桌宠。'};
}
async function execute({action}={}){
  if(action==='launch')return launch();
  if(action==='stop')return stop();
  throw fail('Q 版桌宠仅支持启动或停止操作。');
}
module.exports={status,execute,resolveScript,launch,stop};
