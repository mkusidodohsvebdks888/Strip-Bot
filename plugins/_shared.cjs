'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {existsSync}=require('node:fs'),{spawn,execFileSync}=require('node:child_process');
function fail(message,status=400){return Object.assign(new Error(message),{status});}
function absolute(value,label){
  if(typeof value!=='string'||!path.isAbsolute(value)||value.length>2048)throw fail(label+'必须是绝对路径。');
  return path.resolve(value);
}
function binary(env,known,defaultName){
  if(process.env[env])return process.env[env];
  const names=process.platform==='win32'?[defaultName+'.exe',defaultName+'.com',defaultName]:[defaultName];
  const candidates=[...known,...(process.env.PATH||'').split(path.delimiter).filter(Boolean).flatMap(dir=>names.map(name=>path.join(dir.replace(/^"|"$/g,''),name)))];
  return candidates.find(existsSync)||defaultName;
}
const registryCache=new Map();
function registryPath(key,value,suffix){
  if(process.platform!=='win32')return null;
  const cacheKey=key+'|'+value+'|'+suffix;
  if(registryCache.has(cacheKey))return registryCache.get(cacheKey);
  let result=null;
  try{
    const output=execFileSync('reg.exe',['query',key,'/v',value],{encoding:'utf8',windowsHide:true,timeout:3000,stdio:['ignore','pipe','ignore']});
    const match=output.match(/REG_(?:EXPAND_)?SZ\s+(.+)/);
    if(match)result=path.join(match[1].trim(),suffix);
  }catch{}
  // A missing installation may become available later without restarting Strip Bot.
  if(result&&existsSync(result))registryCache.set(cacheKey,result);
  return result;
}
function installed(command){return path.isAbsolute(command)&&existsSync(command);}
function run(command,args){
  return new Promise((resolve,reject)=>{
    let closed=false,log='';
    const child=spawn(command,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const timer=setTimeout(()=>{child.kill();finish(fail('插件执行超时。',504));},120000);
    function finish(error){if(closed)return;closed=true;clearTimeout(timer);error?reject(error):resolve(log);}
    const collect=x=>{log=(log+x.toString()).slice(-1800);};
    child.stdout.on('data',collect);child.stderr.on('data',collect);
    child.on('error',e=>finish(fail('无法启动依赖程序：'+e.message,503)));
    child.on('close',code=>finish(code===0?null:fail('程序执行失败 ('+code+')：'+log,502)));
  });
}
module.exports={fs,path,fail,absolute,binary,run,registryPath,installed};
