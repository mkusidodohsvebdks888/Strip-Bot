'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const MAX_BYTES=1024*1024;
const markers=[
 ['package.json','Node.js / JavaScript'],['pom.xml','Java / Maven'],
 ['build.gradle','Java / Gradle'],['build.gradle.kts','Kotlin / Gradle'],
 ['pyproject.toml','Python'],['requirements.txt','Python'],
 ['Cargo.toml','Rust'],['go.mod','Go'],['composer.json','PHP'],
 ['Dockerfile','Docker'],['compose.yaml','Docker Compose'],
 ['docker-compose.yml','Docker Compose']
];
const specs=['openapi.json','openapi.yaml','openapi.yml','swagger.json','docs/openapi.json'];
const mcpConfigs=['.mcp.json','.vscode/mcp.json'];
const badKey=/secret|token|password|api.?key|authorization|credential|private.?key/i;
async function safeFile(root,relative){
 const base=await fs.realpath(root);
 const full=path.resolve(base,relative);
 if(!full.startsWith(base+path.sep))return null;
 let stat;try{stat=await fs.lstat(full);}catch{return null;}
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_BYTES)return null;
 return full;
}
async function readJson(root,relative){
 const file=await safeFile(root,relative);
 if(!file)return null;
 try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return null;}
}
function cleanName(name){return typeof name==='string'?name.slice(0,120):'';}
function publicMcpConfig(value){
 const servers=value?.mcpServers||value?.servers;
 if(!servers||typeof servers!=='object'||Array.isArray(servers))return [];
 return Object.entries(servers).slice(0,40).map(([name,config])=>({
  name:cleanName(name),transport:typeof config?.type==='string'?config.type:
  typeof config?.url==='string'?'http':'stdio',
  configured:true,connected:false,
  // Never return command arguments, URLs, environment variables or credentials.
  requiresApproval:true
 }));
}
async function discover(workspace){
 const root=await fs.realpath(workspace);
 const frameworks=[];
 for(const [file,kind] of markers)if(await safeFile(root,file))frameworks.push({file,kind});
 const pkg=await readJson(root,'package.json');
 const dependencies={...pkg?.dependencies,...pkg?.devDependencies};
 for(const [key,kind] of [['react','React'],['vue','Vue'],['next','Next.js'],['vite','Vite'],['express','Express'],['fastify','Fastify']]){
  if(Object.hasOwn(dependencies,key))frameworks.push({file:'package.json',kind});
 }
 const mcp=[];
 for(const file of mcpConfigs){const config=await readJson(root,file);if(config)mcp.push(...publicMcpConfig(config).map(item=>({...item,configFile:file})));}
 const api=[];
 for(const file of specs){
  const json=file.endsWith('.json')?await readJson(root,file):null;
  if(json&&typeof json==='object'&&(json.openapi||json.swagger)){
   const paths=json.paths&&typeof json.paths==='object'?Object.keys(json.paths).slice(0,100):[];
   api.push({file,title:cleanName(json.info?.title),version:cleanName(json.info?.version),paths,operations:paths.length,availableForImport:true});
  }else if(await safeFile(root,file)){
   api.push({file,format:'yaml',availableForImport:false,note:'YAML 规范需要专用解析器'});
  }
 }
 return {workspace:root,frameworks,mcp,openapi:api,capabilities:{
  files:{available:true,mode:'read-only',requiresApprovalForWrites:true},
  projectSearch:{available:true,mode:'read-only'},
  mcp:{configured:mcp.length,connected:0},
  openapi:{discovered:api.length,executionEnabled:false},
  terminal:{executionEnabled:false},
  database:{executionEnabled:false}
 },note:'只读发现：不会执行 MCP Server、项目脚本、HTTP 请求或数据库命令。'};
}

const DENIED=new Set(['.git','.env','.ssh','.aws','.npmrc','.pypirc','node_modules','.stripbot','dist','build','coverage','vendor','__pycache__']);
const PRIVATE=/(^|[._-])(secret|token|password|credential|private|keypair|id_rsa|id_ed25519)([._-]|$)|\.(pem|p12|pfx|key|sqlite|db)$/i;
function segments(relative){
 if(typeof relative!=='string'||relative.length>500||relative.includes('\\')||relative.includes('\\0'))throw Object.assign(new Error('无效的相对路径'),{status:400});
 const parts=relative.split('/');
 if(parts.some(x=>x===''||x==='.'||x==='..'||DENIED.has(x.toLowerCase())||x.toLowerCase().startsWith('.env')||PRIVATE.test(x)))throw Object.assign(new Error('此路径不可读取'),{status:403});
 return parts;
}
async function resolveReadOnly(workspace,relative,folder=false){
 const base=await fs.realpath(workspace);
 const parts=segments(relative);
 let current=base;
 for(const part of parts){
  current=path.join(current,part);
  const stat=await fs.lstat(current);
  if(stat.isSymbolicLink())throw Object.assign(new Error('禁止访问符号链接'),{status:403});
 }
 const stat=await fs.lstat(current);
 if(folder?!stat.isDirectory():!stat.isFile())throw Object.assign(new Error('路径类型不匹配'),{status:400});
 return {current,stat};
}
async function list(workspace,relative){
 const {current}=await resolveReadOnly(workspace,relative,true);
 const entries=await fs.readdir(current,{withFileTypes:true});
 return {path:relative,entries:entries.filter(x=>!DENIED.has(x.name.toLowerCase())&&!x.name.toLowerCase().startsWith('.env')&&!PRIVATE.test(x.name)&&!x.isSymbolicLink()).slice(0,200).map(x=>({name:x.name,type:x.isDirectory()?'directory':x.isFile()?'file':'other'}))};
}
async function read(workspace,relative){
 const {current,stat}=await resolveReadOnly(workspace,relative);
 if(stat.size>MAX_BYTES)throw Object.assign(new Error('文件超过 1MB 限制'),{status:413});
 const data=await fs.readFile(current);
 if(data.includes(0))throw Object.assign(new Error('不允许读取二进制文件'),{status:415});
 return {path:relative,content:data.toString('utf8'),size:data.length};
}

module.exports={discover,list,read};
