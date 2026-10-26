'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {createHash}=require('node:crypto');
const exec=promisify(execFile);
const hash=data=>createHash('sha256').update(data).digest('hex');
async function snapshot({workspace,root,taskID}){
  if(!/^tsk_[a-f0-9]{20}$/.test(taskID))throw new Error('Invalid task ID');
  const cwd=await fs.realpath(workspace);
  const git=async args=>(await exec('git',args,{cwd,timeout:8000,maxBuffer:2*1024*1024,windowsHide:true})).stdout.trim();
  let gitRoot;
  try{gitRoot=await git(['rev-parse','--show-toplevel']);}catch{return {available:false,reason:'not_git_repository'};}
  if(path.resolve(gitRoot)!==cwd)return {available:false,reason:'workspace_not_repository_root'};
  const status=await git(['status','--porcelain=v1','--untracked-files=normal']);
  const lines=status.split(/\r?\n/).filter(Boolean);
  if(lines.length>100)return {available:false,reason:'too_many_changed_files'};
  const files=[];let bytes=0;
  for(const line of lines){
    const relative=line.slice(3);
    if(!relative||relative.includes(' -> '))return {available:false,reason:'unsupported_rename'};
    const absolute=path.resolve(cwd,relative);
    const rel=path.relative(cwd,absolute);
    if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))return {available:false,reason:'unsafe_path'};
    let stat;
    try{stat=await fs.lstat(absolute);}catch(e){if(e.code==='ENOENT'){files.push({path:relative,missing:true});continue;}throw e;}
    if(!stat.isFile()||stat.isSymbolicLink())return {available:false,reason:'unsupported_file'};
    if(stat.size>1024*1024||bytes+stat.size>8*1024*1024)return {available:false,reason:'size_limit'};
    const data=await fs.readFile(absolute);bytes+=data.length;
    files.push({path:relative,hash:hash(data),content:data.toString('base64')});
  }
  const directory=path.join(root,'.runtime','task-snapshots');
  await fs.mkdir(directory,{recursive:true});
  await fs.writeFile(path.join(directory,taskID+'.json'),JSON.stringify({version:1,taskID,workspace:cwd,files,createdAt:Date.now()}),{flag:'wx',mode:0o600});
  return {available:true,taskID,fileCount:files.length,bytes,restorable:false};
}
module.exports={snapshot};
