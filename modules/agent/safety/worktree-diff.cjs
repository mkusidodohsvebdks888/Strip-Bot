'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const hash=data=>createHash('sha256').update(data).digest('hex');
const TASK=/^tsk_[a-f0-9]{20}$/;
async function compareSnapshot({root,workspace,taskID}){
  if(!TASK.test(taskID))throw new Error('Invalid task ID');
  const cwd=await fs.realpath(workspace);
  const file=path.join(root,'.runtime','task-snapshots',taskID+'.json');
  const stat=await fs.stat(file);
  if(stat.size>12*1024*1024)throw new Error('Snapshot exceeds size limit');
  const record=JSON.parse(await fs.readFile(file,'utf8'));
  if(record.version!==1||record.taskID!==taskID||record.workspace!==cwd||!Array.isArray(record.files)||record.files.length>100)throw new Error('Snapshot metadata mismatch');
  const changes=[];
  for(const entry of record.files){
    if(!entry||typeof entry.path!=='string'||!entry.path||path.isAbsolute(entry.path)||path.win32.isAbsolute(entry.path))throw new Error('Invalid snapshot path');
    const target=path.resolve(cwd,entry.path);
    const relative=path.relative(cwd,target);
    if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||relative===''||relative.split(path.sep).includes('.runtime'))throw new Error('Unsafe snapshot path');
    let current;
    try{
      const info=await fs.lstat(target);
      if(!info.isFile()||info.isSymbolicLink()){changes.push({path:entry.path,status:'unsupported'});continue;}
      if(info.size>1024*1024){changes.push({path:entry.path,status:'too_large'});continue;}
      current=await fs.readFile(target);
    }catch(error){
      if(error.code!=='ENOENT')throw error;
      current=null;
    }
    const before=entry.missing?null:entry.hash;
    const after=current===null?null:hash(current);
    if(before!==after)changes.push({path:entry.path,status:before===null?'created':after===null?'deleted':'modified',beforeHash:before,afterHash:after});
  }
  return {taskID,workspace:cwd,checked:record.files.length,changes,limitedToSnapshotFiles:true};
}
module.exports={compareSnapshot};
