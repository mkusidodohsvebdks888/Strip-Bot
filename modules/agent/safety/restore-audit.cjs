'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
async function appendRestoreAudit({root,taskID,sessionID,filePath,outcome,reason}){
  const directory=path.join(root,'.runtime');
  await fs.mkdir(directory,{recursive:true});
  const entry={id:randomUUID(),at:new Date().toISOString(),taskID,sessionID,filePath,outcome,reason:String(reason||'').slice(0,300)};
  await fs.appendFile(path.join(directory,'restore-audit.jsonl'),JSON.stringify(entry)+'\n',{encoding:'utf8',mode:0o600});
  return entry;
}
async function readRestoreAudit({root,taskID,limit=50}){
  const filename=path.join(root,'.runtime','restore-audit.jsonl');
  let text;
  try{text=await fs.readFile(filename,'utf8');}catch(error){if(error.code==='ENOENT')return {items:[]};throw error;}
  const lines=text.split(/\r?\n/).filter(Boolean).slice(-1000);
  const items=lines.map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(item=>item&&(!taskID||item.taskID===taskID)).slice(-Math.min(100,Math.max(1,limit))).reverse();
  return {items};
}
module.exports={appendRestoreAudit,readRestoreAudit};
