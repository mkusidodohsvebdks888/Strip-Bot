'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {httpError} = require('../../core/providers/index.cjs');
const IGNORED = new Set(['node_modules','.git','.next','.idea','.vscode','target','build','dist','out','.venv','venv','__pycache__','.gradle','.runtime','coverage','vendor']);
const SOURCE = /\.(?:java|kt|js|jsx|ts|tsx|py|go|cs)$/i;
const CONFIG = new Set(['package.json','pom.xml','build.gradle','build.gradle.kts','requirements.txt','pyproject.toml','go.mod','prisma.schema','schema.prisma','application.yml','application.yaml','application.properties','docker-compose.yml','compose.yaml','.env.example','README.md','settings.py','manage.py']);
const MAX_FILES = 240, MAX_DIRS = 1000;
function safeLocalURL(value) {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  let u;
  try {u = new URL(String(value));} catch {throw httpError(400,'本地 API 地址格式无效。');}
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw httpError(400,'后端 API 必须是 HTTP(S) 地址。');
  if (!['localhost','127.0.0.1','[::1]'].includes(u.hostname.toLowerCase()) || u.username || u.password || u.hash) throw httpError(400,'为保护本地环境，目前只允许本机回环 API 地址，且不能嵌入凭据。');
  return u.href;
}
function within(parent, target) {
  const relative = path.relative(parent,target);
  return relative === '' || (relative !== '..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative));
}
async function inspectProject(rootPath) {
  if (typeof rootPath !== 'string' || rootPath.length > 2048 || !path.isAbsolute(rootPath)) throw httpError(400,'请输入本地后端项目的绝对路径。');
  const folder = await fs.realpath(rootPath).catch(()=>{throw httpError(404,'本地目录不存在。');});
  if (!(await fs.stat(folder)).isDirectory()) throw httpError(400,'后端路径不是文件夹。');
  const files=[]; const stack=[{dir:folder,depth:0}]; let visited=0;
  while(stack.length && files.length<MAX_FILES && visited++<MAX_DIRS){
    const {dir,depth}=stack.pop();
    const entries=await fs.readdir(dir,{withFileTypes:true}).catch(()=>[]);
    for(const entry of entries){
      if(files.length>=MAX_FILES)break;
      if(entry.isSymbolicLink())continue;
      const current=path.join(dir,entry.name);
      if(entry.isDirectory()){
        if(depth<9 && !IGNORED.has(entry.name) && !entry.name.startsWith('.'))stack.push({dir:current,depth:depth+1});
      }else if(entry.isFile() && (SOURCE.test(entry.name) || CONFIG.has(entry.name)))files.push(current);
    }
  }
  const frameworks=new Set(),databases=new Set(), envKeys=new Set(),apiRoutes=new Set(), entries=[];
  for(const file of files){
    const base=path.basename(file),rel=path.relative(folder,file).replaceAll('\\','/');
    const stat=await fs.stat(file).catch(()=>null);
    if(!stat || stat.size>180000)continue;
    if(base==='package.json' || base==='pom.xml' || base==='pyproject.toml' || base==='go.mod')entries.push(rel);
    if(base==='schema.prisma')databases.add('Prisma');
    if(base==='.env.example'){
      const sample=await fs.readFile(file,'utf8').catch(()=>'');
      for(const line of sample.split(/\r?\n/).slice(0,150)){
        const m=/^\s*(?:export\s+)?([A-Z][A-Z0-9_]{2,79})\s*=/.exec(line);if(m)envKeys.add(m[1]);
      }
      continue;
    }
    // Never inspect real .env, keys, token files, database dumps, or runtime secrets.
    if(base==='README.md')continue;
    const text=(await fs.readFile(file,'utf8').catch(()=>'' )).slice(0,80000);
    const low=text.toLowerCase();
    if(/spring-boot|org\.springframework|springframework/.test(low))frameworks.add('Spring Boot');
    if(/fastapi|from fastapi import/.test(low))frameworks.add('FastAPI');
    if(/express|require\(['"]express['"]\)/.test(low))frameworks.add('Express');
    if(/@nestjs|nestjs\//.test(low))frameworks.add('NestJS');
    if(/django/.test(low))frameworks.add('Django');
    if(/gin-gonic|github.com\/gin-gonic/.test(low))frameworks.add('Gin (Go)');
    if(/mysql|mariadb/.test(low))databases.add('MySQL / MariaDB');
    if(/postgresql|postgres|psycopg/.test(low))databases.add('PostgreSQL');
    if(/sqlite/.test(low))databases.add('SQLite');
    if(/mongodb|mongoose/.test(low))databases.add('MongoDB');
    if(/redis/.test(low))databases.add('Redis');
    if(/h2database|jdbc:h2/.test(low))databases.add('H2');
    if(/@(?:Get|Post|Put|Patch|Delete|Request)Mapping\s*\(|@(Get|Post|Put|Patch|Delete)\s*\(|router\.(?:get|post|put|patch|delete)\s*\(/.test(text)){
      const re=/(?:@(?:Get|Post|Put|Patch|Delete|Request)Mapping\s*\(\s*(?:value\s*=\s*)?|router\.(?:get|post|put|patch|delete)\s*\()\s*['"]([^'"\r\n]{1,100})['"]/g;
      for(const m of text.matchAll(re)){apiRoutes.add(m[1]);if(apiRoutes.size>=28)break;}
    }
    if(/\.env|application\.(?:yaml|yml|properties)/.test(base)){
      for(const line of text.split(/\r?\n/).slice(0,500)){
        const m=/^\s*(?:\$\{)?([A-Z][A-Z0-9_]{3,79})\s*(?::|=|\})/.exec(line);if(m)envKeys.add(m[1]);
      }
    }
  }
  return {path:folder,frameworks:[...frameworks],databases:[...databases],entrypoints:entries.slice(0,12),sampleRoutes:[...apiRoutes].slice(0,25),envNames:[...envKeys].slice(0,45),filesScanned:files.length,needs:[
    '本地后端源码文件夹（已提供）', 'Agent 模型需要支持工具/函数调用，才能主动操作外部工具',
    '如需测试运行中的服务，请提供本机 API 根地址及必要的授权方式',
    '如需修改数据库，需要另外配置最小权限的数据库工具或现有业务 API',
    '对代码写入、服务重启和部署使用独立的操作审批',
  ]};
}
function createBackendRegistry({root}){
  const file=path.join(root,'.runtime','backend-projects.json');let pending=Promise.resolve();
  async function read(){try{const value=JSON.parse(await fs.readFile(file,'utf8'));return Array.isArray(value)?value:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}}
  async function write(list){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(list,null,2),{mode:0o600});await fs.rename(tmp,file);}
  function transaction(fn){const task=pending.then(async()=>{const list=await read();const result=await fn(list);await write(list);return result;});pending=task.catch(()=>{});return task;}
  return {
    inspect:async ({path:projectPath,url})=>({...await inspectProject(projectPath),apiUrl:safeLocalURL(url)}),
    list:()=>pending.then(read),
    connect:({path:projectPath,url,label,confirmed})=>transaction(async list=>{
      if(confirmed!==true)throw httpError(400,'连接本地源码需要明确授权。');
      const info=await inspectProject(projectPath);const apiUrl=safeLocalURL(url);
      if(list.length>=30 && !list.some(p=>p.path===info.path))throw httpError(400,'最多接入 30 个本地后端。');
      const projectLabel=String(label || path.basename(info.path)).trim();
      if(!projectLabel || projectLabel.length>64)throw httpError(400,'项目名称长度应为 1-64 字符。');
      const existed=list.find(p=>p.path===info.path);
      const item={id:existed?.id || 'backend_'+randomUUID().slice(0,12).replaceAll('-',''),label:projectLabel,path:info.path,apiUrl,frameworks:info.frameworks,databases:info.databases};
      if(existed)Object.assign(existed,item);else list.push(item);
      return {ok:true,item,inspection:info};
    }),
    remove:({id,confirmed})=>transaction(list=>{if(confirmed!==true)throw httpError(400,'移除连接需要确认。');const index=list.findIndex(x=>x.id===id);if(index<0)throw httpError(404,'连接不存在。');list.splice(index,1);return {ok:true};}),
    allowed:async folder=>{const target=await fs.realpath(folder).catch(()=>null);if(!target)return false;return (await pending.then(read)).some(item=>within(item.path,target));},
    async health({id}){
      const item=(await pending.then(read)).find(p=>p.id===id);if(!item)throw httpError(404,'连接不存在。');
      if(!item.apiUrl)return {ok:false,message:'尚未填写 API 地址；源码已接入，可以切换项目工作区。'};
      const response=await fetch(item.apiUrl,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(3500)}).catch(e=>{throw httpError(502,'本机 API 不可达：'+(e.name==='TimeoutError'?'请求超时':'请检查端口和服务'));});
      await response.body?.cancel();return {ok:response.status>=200&&response.status<400,httpStatus:response.status,message:`HTTP ${response.status} · 已完成网络探测（不代表业务接口可正常调用）`};
    }
  };
}
module.exports={createBackendRegistry,inspectProject,safeLocalURL,within};
