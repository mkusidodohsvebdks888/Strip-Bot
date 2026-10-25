'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {fail}=require('../_shared.cjs');

function executable({platform=process.platform,env=process.env}={}){
  if(platform!=='win32')return null;
  const value=env.DEEPSEEK_HARNESS_PET_BIN||
    path.join(env.LOCALAPPDATA||path.join(env.USERPROFILE||'C:/Users/Public','AppData','Local'),'DeepSeekHarnessPet','DeepSeekHarnessPet.exe');
  const paths=platform==='win32'?path.win32:path;
  if(!paths.isAbsolute(value)||paths.extname(value).toLowerCase()!=='.exe')return null;
  return paths.resolve(value);
}
async function status({platform=process.platform,env=process.env}={}){
  const command=executable({platform,env});
  const installed=!!(command&&(await fs.stat(command).catch(()=>null))?.isFile());
  return {dependency:'DeepSeek Harness Pet (Windows)',command:command||'Windows only',
    installed,supported:platform==='win32',
    description:installed?'检测到本机已安装的 DeepSeek Harness Pet。':'仅提供本地启动入口；请先自行安装并验证可信的桌宠 EXE，插件不会自动下载任何程序。'};
}
async function execute({action}={}){
  if(action!=='launch')throw fail('桌宠仅支持启动操作。');
  const state=await status();
  if(!state.supported)throw fail('此桌宠只支持 Windows。',400);
  if(!state.installed)throw fail('未找到已安装的 DeepSeek Harness Pet。请先手动安装。',503);
  return new Promise((resolve,reject)=>{
    let finished=false;
    function finish(error,value){if(finished)return;finished=true;error?reject(fail('桌宠启动失败：'+error.message,503)):resolve(value);}
    const proc=spawn(state.command,[],{cwd:path.dirname(state.command),detached:true,stdio:'ignore',windowsHide:true,shell:false});
    proc.once('error',error=>finish(error));
    proc.once('spawn',()=>{proc.unref();finish(null,{ok:true,message:'已请求启动 DeepSeek Harness 桌宠。',output:state.command});});
  });
}
module.exports={status,execute,executable};
