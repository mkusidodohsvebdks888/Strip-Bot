'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {createHash}=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const run=promisify(execFile);
const MAX_OUTPUT=1024*1024;

// Read-only Git preflight. Never resets, cleans, stages or alters user files.
async function gitPreflight(workspace,{timeoutMs=5000}={}){
  const cwd=await fs.realpath(workspace);
  const git=async args=>{
    const {stdout}=await run('git',['-c','core.quotepath=false',...args],{cwd,timeout:timeoutMs,maxBuffer:MAX_OUTPUT,windowsHide:true});
    return stdout.trimEnd();
  };
  let root;
  try{root=await git(['rev-parse','--show-toplevel']);}
  catch{return {git:false,workspace:cwd,reason:'not_git_repository'};}
  const [head,status]=await Promise.all([
    git(['rev-parse','--verify','HEAD']).catch(()=>null),
    git(['status','--porcelain=v1','-z','--untracked-files=normal'])
  ]);
  const entries=status.split('\0').filter(Boolean);
  const modified=entries.filter(e=>!e.startsWith('??')).length;
  const untracked=entries.filter(e=>e.startsWith('??')).length;
  return {git:true,workspace:cwd,root,head,dirty:entries.length>0,modified,untracked,
    // Hash allows detecting a changed worktree without persisting private paths.
    statusFingerprint:createHash('sha256').update(status).digest('hex'),
    capturedAt:new Date().toISOString()};
}
module.exports={gitPreflight};
