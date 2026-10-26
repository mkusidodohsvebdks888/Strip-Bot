'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
function createMarketplace({root}){
 const registryPath=path.join(__dirname,'../marketplace/registry.json');
 const installedPath=path.join(root,'.runtime','marketplace-installed.json');
 async function registry(){return JSON.parse(await fs.readFile(registryPath,'utf8'));}
 async function installed(){try{const value=JSON.parse(await fs.readFile(installedPath,'utf8'));return Array.isArray(value)?value:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 async function write(items){await fs.mkdir(path.dirname(installedPath),{recursive:true});await fs.writeFile(installedPath,JSON.stringify(items,null,2),{mode:0o600});}
 async function install({id,kind}){const catalog=await registry();const entries=kind==='plugin'?catalog.plugins:kind==='mcp'?catalog.mcpServers:[];if(!entries.some(entry=>entry.id===id))throw Object.assign(new Error('市场条目不存在'),{status:404});const items=await installed();if(!items.includes(id))items.push(id);await write(items);return {items};}
 async function uninstall({id}){const items=(await installed()).filter(item=>item!==id);await write(items);return {items};}
 return {registry,installed,install,uninstall};
}
module.exports={createMarketplace};
