'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const https=require('node:https');
const http=require('node:http');
function createMarketplace({root}){
 const registryPath=path.join(__dirname,'../marketplace/registry.json');
 const installedPath=path.join(root,'.runtime','marketplace-installed.json');
 const packagesDir=path.join(root,'.runtime','marketplace-packages');
 let queue=Promise.resolve();
 async function registry(){return JSON.parse(await fs.readFile(registryPath,'utf8'));}
 async function installed(){try{const value=JSON.parse(await fs.readFile(installedPath,'utf8'));return Array.isArray(value)?value:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 async function write(items){await fs.mkdir(path.dirname(installedPath),{recursive:true});const tmp=installedPath+'.tmp';await fs.writeFile(tmp,JSON.stringify(items,null,2),{mode:0o600});await fs.rename(tmp,installedPath);}
 function transaction(task){const result=queue.then(task);queue=result.catch(()=>{});return result;}
 function entryFor(catalog,id,kind){return (kind==='plugin'?catalog.plugins:kind==='mcp'?catalog.mcpServers:[]).find(entry=>entry.id===id);}
 async function install({id,kind}){return transaction(async()=>{const catalog=await registry();if(!entryFor(catalog,id,kind))throw Object.assign(new Error('市场条目不存在'),{status:404});const items=await installed();if(!items.includes(id))items.push(id);await write(items);return {items};});}
 async function uninstall({id}){return transaction(async()=>{const items=(await installed()).filter(item=>item!==id);await write(items);return {items};});}
 async function updates(){const catalog=await registry();const items=await installed();return {items:items.map(id=>{const entry=[...catalog.plugins,...catalog.mcpServers].find(item=>item.id===id);return {id,version:entry?.version||null,available:!!entry};})};}
 async function download({id,confirmed}){
  if(confirmed!==true)throw Object.assign(new Error('下载前需要用户确认'),{status:400});
  const catalog=await registry();const entry=catalog.plugins.find(item=>item.id===id);
  if(!entry||!entry.packageUrl||!entry.sha256)throw Object.assign(new Error('插件没有可验证的发布包'),{status:400});
  const url=new URL(entry.packageUrl);
  if(url.protocol!=='https:'||url.hostname!=='github.com'||!/^\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/releases\/download\//.test(url.pathname))throw Object.assign(new Error('仅允许 GitHub Releases 下载'),{status:400});
  if(!/^[a-f0-9]{64}$/i.test(entry.sha256))throw Object.assign(new Error('SHA-256 校验值无效'),{status:400});
  // Download intentionally staged for offline verification: no extraction, execution or dependency installation.
  return {id,status:'requires_verified_download',url:entry.packageUrl,sha256:entry.sha256,message:'请通过受信任的下载器校验 SHA-256 后安装；当前不会执行未知插件。'};
 }
 return {registry,installed,install,uninstall,updates,download};
}
module.exports={createMarketplace};
