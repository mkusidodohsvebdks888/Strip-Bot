'use strict';
const {restoreSnapshotFile}=require('./worktree-restore.cjs');
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function batchRestore({root,workspace,taskID,files,confirmed,onResult}){
  if(confirmed!==true)throw fail(400,'批量恢复需要明确确认');
  if(!Array.isArray(files)||files.length<1||files.length>30)throw fail(400,'每次允许恢复 1 到 30 个文件');
  const names=new Set();
  for(const file of files){
    if(!file||typeof file.filePath!=='string'||names.has(file.filePath))throw fail(400,'文件列表无效或包含重复路径');
    names.add(file.filePath);
  }
  const results=[];
  for(const file of files){
    try{
      const value=await restoreSnapshotFile({root,workspace,taskID,filePath:file.filePath,expectedHash:file.expectedHash,confirmed:true});
      results.push({filePath:file.filePath,ok:true,restoredHash:value.restoredHash});
      if(onResult)await onResult({filePath:file.filePath,outcome:'restored'});
    }catch(error){
      results.push({filePath:file.filePath,ok:false,error:String(error.message||error).slice(0,300)});
      if(onResult)await onResult({filePath:file.filePath,outcome:'failed',reason:error.message});
    }
  }
  return {taskID,requested:files.length,restored:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results,atomic:false};
}
module.exports={batchRestore};
