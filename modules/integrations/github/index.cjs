'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {httpError}=require('../../core/providers/index.cjs');

function parseGithubUrl(value){
  let u;try{u=new URL(value);}catch{throw httpError(400,'请输入完整的 GitHub 仓库地址。');}
  if(u.protocol!=='https:' || u.hostname.toLowerCase()!=='github.com' || u.username || u.password || u.port || u.search || u.hash)throw httpError(400,'仅支持公开的 https://github.com/owner/repo 仓库链接。');
  const parts=u.pathname.split('/').filter(Boolean),owner=parts[0],repo=parts[1]?.replace(/\.git$/i,'');
  if(!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(owner||'') || !/^[a-zA-Z0-9_.-]{1,90}$/.test(repo||'') || repo==='.' || repo==='..' || parts.length>2)throw httpError(400,'请使用仓库首页地址，不支持文件、分支或非 GitHub 链接。');
  return {owner,repo,url:`https://github.com/${owner}/${repo}.git`};
}
function execute(binary,args,opts={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(binary,args,{cwd:opts.cwd,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'},stdio:['ignore','pipe','pipe'],shell:opts.shell===true});
    let output='',ended=false;
    const timer=setTimeout(()=>{child.kill();if(!ended)reject(httpError(504,'GitHub 下载或依赖准备超时。'));ended=true;},opts.timeout || 60000);
    const collect=data=>{if(output.length<12000)output+=String(data).slice(0,12000-output.length);};
    child.stdout?.on('data',collect);child.stderr?.on('data',collect);
    child.once('error',e=>{if(!ended){ended=true;clearTimeout(timer);reject(httpError(503,'无法启动所需命令：'+e.message));}});
    child.once('close',code=>{if(!ended){ended=true;clearTimeout(timer);if(code!==0)reject(httpError(422,'命令未成功：'+output.slice(-1800).replace(/(token|password|authorization)\s*[:=]\s*\S+/gi,'$1=[hidden]')));else resolve(output);}});
  });
}
async function cloneGithub(url,target){
  const info=parseGithubUrl(url);
  await fs.mkdir(path.dirname(target),{recursive:true});
  // No shell, GitHub-only HTTPS host, no recursive submodules, no LFS smudge hooks.
  await execute('git',['-c','core.hooksPath='+ (process.platform==='win32'?'NUL':'/dev/null'),'-c','filter.lfs.smudge=','clone','--depth','1','--single-branch','--quiet',info.url,target],{timeout:90000});
  const sha=(await execute('git',['-C',target,'rev-parse','HEAD'])).trim();
  return {...info,sha};
}
async function textIfSafe(folder,name,max=90000){
  const full=path.join(folder,name);
  try{const realRoot=await fs.realpath(folder),real=await fs.realpath(full);const relative=path.relative(realRoot,real);if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))return '';const stat=await fs.lstat(full);if(!stat.isFile() || stat.isSymbolicLink() || stat.size>max)return '';
    return await fs.readFile(full,'utf8');
  }catch{return '';}
}
async function inspectToolFolder(folder){
  const packageRaw=await textIfSafe(folder,'package.json',90000);
  let pkg={};try{pkg=JSON.parse(packageRaw||'{}');}catch{}
  const readme=(await textIfSafe(folder,'README.md',90000) || await textIfSafe(folder,'readme.md',90000));
  const python=!!(await textIfSafe(folder,'pyproject.toml',90000) || await textIfSafe(folder,'requirements.txt',90000));
  const node=!!packageRaw;
  const marker=/\bmcp\b|model.context.protocol|@modelcontextprotocol\/sdk|fastmcp/i.test([readme.slice(0,7000),packageRaw].join('\n'));
  const runtime=node?'node':python?'python':'unknown';
  let launch=[];
  const binValue=typeof pkg.bin==='string'?pkg.bin:pkg.bin&&typeof pkg.bin==='object'?Object.values(pkg.bin).find(s=>typeof s==='string'):null;
  const candidates=[binValue,'dist/index.js','build/index.js','dist/server.js','build/server.js','index.js','server.js','src/index.js','src/server.js'].filter(Boolean);
  if(node){for(const candidate of candidates){if(typeof candidate!=='string'||candidate.includes('..')||path.isAbsolute(candidate)||!/\.m?js$/.test(candidate))continue;if(await textIfSafe(folder,candidate,1000000)){launch=['node',path.join(folder,candidate)];break;}}}
  if(!node && python){for(const candidate of ['server.py','main.py','src/server.py']){if(await textIfSafe(folder,candidate,1000000)){launch=['python',path.join(folder,candidate)];break;}}}
  const envRaw=await textIfSafe(folder,'.env.example',30000);
  const envNames=envRaw.split(/\r?\n/).map(line=>/^\s*(?:export\s+)?([A-Z][A-Z0-9_]{2,79})\s*=/.exec(line)?.[1]).filter(Boolean).slice(0,30);
  return {runtime,mcpLikely:marker,packageName:String(pkg.name || '').slice(0,100),scriptNames:pkg.scripts&&typeof pkg.scripts==='object'?Object.keys(pkg.scripts).slice(0,15):[],launch,requiresDependencies:node && !!(pkg.dependencies && Object.keys(pkg.dependencies).length || pkg.optionalDependencies && Object.keys(pkg.optionalDependencies).length),envNames,readmeSummary:readme.replace(/```[\s\S]*?```/g,'[code example]').slice(0,1000)};
}
function createGithubTools({root,clone=cloneGithub}){
  const base=path.join(root,'.runtime','github-tools');
  const file=path.join(root,'.runtime','github-tools.json');let pending=Promise.resolve();
  async function read(){try{const items=JSON.parse(await fs.readFile(file,'utf8'));return Array.isArray(items)?items:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}}
  async function write(items){await fs.mkdir(path.dirname(file),{recursive:true});const t=file+'.tmp';await fs.writeFile(t,JSON.stringify(items,null,2),{mode:0o600});await fs.rename(t,file);}
  function transact(fn){const task=pending.then(async()=>{const items=await read();const result=await fn(items);await write(items);return result;});pending=task.catch(()=>{});return task;}
  return {
    list:()=>pending.then(read),
    import:({url,confirmed})=>transact(async items=>{
      if(confirmed!==true)throw httpError(400,'下载第三方源码前需明确确认。');
      const parsed=parseGithubUrl(url);
      const key=`${parsed.owner}/${parsed.repo}`.toLowerCase();
      if(items.some(x=>x.key===key))throw httpError(409,'该仓库已导入。');
      if(items.length>=25)throw httpError(400,'最多导入 25 个 GitHub 工具仓库。');
      const id='github_'+randomUUID().slice(0,12);const target=path.join(base,id);
      try {
        const source=await clone(url,target);const analysis=await inspectToolFolder(target);
        const item={id,key,label:`${source.owner}/${source.repo}`,url:`https://github.com/${source.owner}/${source.repo}`,sha:source.sha,folder:target,importedAt:Date.now(),...analysis};
        items.push(item);return {ok:true,item};
      }catch(e){await fs.rm(target,{recursive:true,force:true}).catch(()=>{});throw e;}
    }),
    remove:({id,confirmed})=>transact(async items=>{
      if(confirmed!==true)throw httpError(400,'删除已导入仓库需要确认。');
      const index=items.findIndex(x=>x.id===id);if(index<0)throw httpError(404,'工具仓库不存在。');
      // Do not destroy a tool while an Agent might still have it enabled. The gateway checks registry before invoking.
      const [item]=items.splice(index,1);
      const target=path.resolve(base,item.id);if(!/^github_[a-f0-9-]{12}$/.test(item.id) || path.resolve(item.folder)!==target || path.dirname(target)!==path.resolve(base))throw httpError(403,'仓库目录超出工具库范围。');
      await fs.rm(target,{recursive:true,force:true});return {ok:true};
    }),
    dependencies:({id,confirmed})=>transact(async items=>{
      if(confirmed!==true)throw httpError(400,'安装第三方依赖需要明确确认。');
      const item=items.find(x=>x.id===id);if(!item)throw httpError(404,'仓库不存在。');
      if(item.runtime!=='node')throw httpError(422,'目前只支持 Node.js 仓库的受限依赖准备。');
      const folder=await fs.realpath(item.folder);
      if(!/^github_[a-f0-9-]{12}$/.test(item.id) || folder!==path.join(await fs.realpath(base),item.id))throw httpError(403,'仓库目录不符合隔离要求。');
      const hasLock=await fs.access(path.join(folder,'package-lock.json')).then(()=>true,()=>false);
      const args=hasLock?['ci','--ignore-scripts','--no-audit','--no-fund']:['install','--ignore-scripts','--no-audit','--no-fund'];
      const binary=process.platform==='win32'?'npm.cmd':'npm';
      await execute(binary,args,{cwd:folder,timeout:120000,shell:process.platform==='win32'});
      return {ok:true,message:'已准备 Node.js 依赖（安装脚本已禁用）。如仓库需要构建，请依据其 README 在可信环境手动构建。'};
    }),
  };
}
module.exports={createGithubTools,parseGithubUrl,cloneGithub,inspectToolFolder};
