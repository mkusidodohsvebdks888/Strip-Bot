'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomBytes}=require('node:crypto');
const digest=b=>createHash('sha256').update(b).digest('hex');
const valid=/^tsk_[a-f0-9]{20}$/;
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function restoreSnapshotFile({root,workspace,taskID,filePath,expectedHash,confirmed}){
  if(confirmed!==true)throw fail(400,'恢复操作需要明确确认');
  if(!valid.test(taskID))throw fail(400,'任务编号无效');
  if(typeof filePath!=='string'||!filePath||filePath.includes('\0')||path.isAbsolute(filePath)||path.win32.isAbsolute(filePath))throw fail(400,'文件路径无效');
  if(expectedHash!==null && !/^[a-f0-9]{64}$/.test(expectedHash))throw fail(400,'必须提供差异查询返回的当前文件哈希');
  const cwd=await fs.realpath(workspace);
  const rel=path.normalize(filePath);
  if(rel==='.'||rel==='..'||rel.startsWith('..'+path.sep)||rel.split(path.sep).includes('.runtime'))throw fail(403,'路径超出工作区');
  const target=path.resolve(cwd,rel);
  const filename=path.join(root,'.runtime','task-snapshots',taskID+'.json');
  const info=await fs.lstat(filename);
  if(!info.isFile()||info.size>12*1024*1024)throw fail(413,'快照文件无效');
  const record=JSON.parse(await fs.readFile(filename,'utf8'));
  if(record.version!==1||record.taskID!==taskID||record.workspace!==cwd||!Array.isArray(record.files))throw fail(409,'快照与工作区不匹配');
  const entry=record.files.find(f=>f.path===filePath);
  if(!entry)throw fail(404,'快照中不存在该文件');
  const parent=await fs.realpath(path.dirname(target)).catch(()=>null);
  if(!parent||parent!==cwd&&!parent.startsWith(cwd+path.sep))throw fail(403,'父目录不安全或已不存在');
  let current=null;
  try{
    const stat=await fs.lstat(target);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)throw fail(409,'文件类型或大小不支持恢复');
    current=await fs.readFile(target);
  }catch(error){if(error.code!=='ENOENT')throw error;}
  const actual=current===null?null:digest(current);
  if(actual!==expectedHash)throw fail(409,'文件已发生变化，请重新查看差异后再确认');
  if(entry.missing){
    // Do not remove files automatically. Deletion needs a separate explicit workflow.
    throw fail(409,'快照中的文件原本不存在，禁止自动删除当前文件');
  }
  if(typeof entry.content!=='string'||!/^[a-f0-9]{64}$/.test(entry.hash))throw fail(409,'快照内容不完整');
  const bytes=Buffer.from(entry.content,'base64');
  if(bytes.length>1024*1024||digest(bytes)!==entry.hash)throw fail(409,'快照完整性校验失败');
  const temp=target+'.stripbot-restore-'+randomBytes(6).toString('hex');
  try{
    await fs.writeFile(temp,bytes,{flag:'wx',mode:0o600});
    // Re-check to reduce accidental overwrite after initial confirmation.
    const latest=await fs.readFile(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if((latest===null?null:digest(latest))!==expectedHash)throw fail(409,'恢复前文件再次变化');
    await fs.rename(temp,target);
  }finally{await fs.rm(temp,{force:true}).catch(()=>{});}
  return {ok:true,taskID,path:filePath,restoredHash:entry.hash};
}
module.exports={restoreSnapshotFile};
