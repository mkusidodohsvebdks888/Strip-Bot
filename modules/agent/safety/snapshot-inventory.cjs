'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const TASK=/^tsk_[a-f0-9]{20}\.json$/;
async function listSnapshots({root}){
  const directory=path.join(root,'.runtime','task-snapshots');
  let names;
  try{names=await fs.readdir(directory);}catch(e){if(e.code==='ENOENT')return {items:[],totalBytes:0};throw e;}
  const items=[];
  for(const name of names.filter(n=>TASK.test(n)).slice(0,500)){
    const file=path.join(directory,name);
    const info=await fs.lstat(file);
    if(!info.isFile()||info.isSymbolicLink())continue;
    items.push({taskID:name.slice(0,-5),bytes:info.size,createdAt:info.birthtimeMs});
  }
  items.sort((a,b)=>b.createdAt-a.createdAt);
  return {items,totalBytes:items.reduce((sum,item)=>sum+item.bytes,0),limited: names.length>500};
}
async function removeSnapshot({root,taskID}){
  if(!/^tsk_[a-f0-9]{20}$/.test(taskID))throw Object.assign(new Error('任务编号无效'),{status:400});
  const filename=path.join(root,'.runtime','task-snapshots',taskID+'.json');
  const info=await fs.lstat(filename);
  if(!info.isFile()||info.isSymbolicLink())throw Object.assign(new Error('快照类型无效'),{status:409});
  await fs.unlink(filename);
  return {ok:true,taskID,deleted:true};
}
module.exports={listSnapshots,removeSnapshot};
