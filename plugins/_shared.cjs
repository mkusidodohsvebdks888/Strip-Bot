'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {existsSync}=require('node:fs'),{spawn}=require('node:child_process');
function fail(message,status=400){return Object.assign(new Error(message),{status});}
function absolute(value,label){
  if(typeof value!=='string'||!path.isAbsolute(value)||value.length>2048)throw fail(label+'必须是绝对路径。');
  return path.resolve(value);
}
function binary(env,known,defaultName){return process.env[env]||known.find(existsSync)||defaultName;}
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
module.exports={fs,path,fail,absolute,binary,run};
