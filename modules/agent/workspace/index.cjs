'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {StringDecoder}=require('node:string_decoder');
const {httpError} = require('../../core/providers/index.cjs');

const MAX_PROMPT_CHARS = 240000;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_DOWNLOAD_BYTES = 16 * 1024 * 1024;
const MAX_COMMAND_OUTPUT_BYTES = 128 * 1024;
const MAX_COMMAND_MS = 30000;

function inside(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

function safeRelative(requested) {
  if (typeof requested !== 'string' || !requested.trim() || requested.length > 2048 || requested.includes('\0') || path.isAbsolute(requested) || path.win32.isAbsolute(requested)) throw httpError(400,'无效的工作区文件路径。');
  const parts = requested.replace(/\\/g,'/').split('/');
  if (parts.some(part => part === '..' || part.toLowerCase()==='.runtime') || requested.includes(':')) throw httpError(403,'禁止读取工作区以外或运行时目录内的文件。');
  return requested;
}

async function readChangedFile(workspace, requested, changes) {
  const name = safeRelative(requested);
  const base=await fs.realpath(workspace);
  const target=path.resolve(base,name);
  const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
  if (!Array.isArray(changes) || !changes.some(change => {
    const changedPath=change?.path || change?.file || change?.filePath;
    return typeof changedPath === 'string' && same(path.resolve(base,changedPath),target);
  })) throw httpError(403,'只能下载此会话确实修改过的文件。');
  if (!inside(base,target))throw httpError(403,'文件不在当前项目目录内。');
  let entry;
  try { entry=await fs.lstat(target); }
  catch {throw httpError(404,'文件已被删除，无法下载；可以导出补丁记录。');}
  if (!entry.isFile() || entry.isSymbolicLink())throw httpError(403,'不允许下载符号链接或非普通文件。');
  const real=await fs.realpath(target);
  if (!inside(base,real))throw httpError(403,'文件不在当前项目目录内。');
  if(entry.size>MAX_DOWNLOAD_BYTES)throw httpError(413,'单个输出文件不能超过 16 MB。');
  const bytes=await fs.readFile(real);
  if(bytes.length>MAX_DOWNLOAD_BYTES)throw httpError(413,'单个输出文件不能超过 16 MB。');
  return {filename:path.basename(real),bytes};
}

async function runManualCommand({workspace, command, confirmed, timeoutMs=MAX_COMMAND_MS}) {
  if (confirmed !== true)throw httpError(400,'请在执行前明确确认这条本地命令。');
  if (typeof command!=='string' || !command.trim() || command.length>4096 || command.includes('\0'))throw httpError(400,'请输入不超过 4096 字符的终端命令。');
  if (!Number.isInteger(timeoutMs) || timeoutMs<1000 || timeoutMs>MAX_COMMAND_MS)throw httpError(400,'命令超时时间必须在 1 至 30 秒之间。');
  const start=Date.now();
  const isWin=process.platform==='win32';
  const executable=isWin ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';
  const args=isWin ? ['/d','/s','/c',`"${command}"`] : ['-c',command];
  return await new Promise(resolve=>{
    const child=spawn(executable,args,{cwd:workspace,windowsHide:true,windowsVerbatimArguments:isWin,stdio:['ignore','pipe','pipe'],detached:!isWin,env:process.env});
    let stdout='',stderr='',stdoutSize=0,stderrSize=0,truncated=false,timedOut=false,done=false,stopping=false;
    const decoders={stdout:new StringDecoder('utf8'),stderr:new StringDecoder('utf8')};
    function stop(){
      if(stopping || !child.pid)return;stopping=true;
      if(isWin){
        const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
        killer.once('error',()=>child.kill('SIGKILL'));
        killer.once('exit',code=>{if(code!==0)child.kill('SIGKILL');});
      }
      else {try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}}
    }
    function collect(kind,chunk){
      const content=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
      const remaining=MAX_COMMAND_OUTPUT_BYTES - stdoutSize - stderrSize;
      if(remaining<=0){truncated=true;stop();return;}
      const take=content.subarray(0,remaining);
      if(kind==='stdout'){stdout+=decoders.stdout.write(take);stdoutSize+=take.length;}
      else{stderr+=decoders.stderr.write(take);stderrSize+=take.length;}
      if(take.length<content.length){truncated=true;stop();}
    }
    const timer=setTimeout(()=>{timedOut=true;stop();},timeoutMs);
    child.stdout.on('data',chunk=>collect('stdout',chunk));
    child.stderr.on('data',chunk=>collect('stderr',chunk));
    function finish(exitCode,error){
      if(done)return;done=true;clearTimeout(timer);
      stdout+=decoders.stdout.end();stderr+=decoders.stderr.end();
      resolve({command,cwd:workspace,exitCode:typeof exitCode==='number'?exitCode:null,stdout,stderr,truncated,timedOut,durationMs:Date.now()-start,error:error?.message || undefined});
    }
    child.once('error',error=>finish(null,error));
    child.once('close',code=>finish(code));
  });
}
module.exports={inside,safeRelative,readChangedFile,runManualCommand,MAX_PROMPT_CHARS,MAX_FILE_BYTES,MAX_COMMAND_MS};
