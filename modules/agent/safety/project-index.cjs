'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const SKIP=new Set(['.git','.runtime','node_modules','dist','build','coverage','vendor','.next','.venv','target']);
const EXT=new Set(['.js','.jsx','.ts','.tsx','.cjs','.mjs','.py','.java','.go','.rs','.md','.css','.html','.vue','.sql','.yml','.yaml','.toml']);
const CACHE=new Map();
async function scan(workspace,{refresh=false}={}){
  const cwd=await fs.realpath(workspace);
  const cached=CACHE.get(cwd);
  if(!refresh&&cached&&Date.now()-cached.at<30000)return cached.value;
  const queue=[{dir:cwd,depth:0}],files=[];let truncated=false;
  while(queue.length&&files.length<400){
    const {dir,depth}=queue.shift();
    const entries=(await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
    for(const item of entries){
      if(item.isSymbolicLink()||SKIP.has(item.name)||item.name.startsWith('.env'))continue;
      const full=path.join(dir,item.name);
      if(item.isDirectory()){if(depth<5)queue.push({dir:full,depth:depth+1});else truncated=true;continue;}
      if(!item.isFile()||!EXT.has(path.extname(item.name).toLowerCase()))continue;
      const stat=await fs.stat(full);
      if(stat.size>1024*1024)continue;
      files.push({path:path.relative(cwd,full).split(path.sep).join('/'),bytes:stat.size,modifiedAt:stat.mtimeMs});
      if(files.length>=400){truncated=true;break;}
    }
  }
  if(queue.length)truncated=true;
  const value={files,truncated,updatedAt:Date.now()};
  CACHE.set(cwd,{at:Date.now(),value});
  if(CACHE.size>20)CACHE.delete(CACHE.keys().next().value);
  return value;
}
async function searchContent(workspace,query){
  if(typeof query!=='string'||query.trim().length<2||query.length>120)throw Object.assign(new Error('源码搜索需要 2 到 120 个字符'),{status:400});
  const cwd=await fs.realpath(workspace),index=await scan(cwd,{refresh:true}),matches=[];
  const needle=query.toLowerCase();
  for(const file of index.files){
    if(matches.length>=50)break;
    const absolute=path.join(cwd,file.path);
    let stat;
    try{stat=await fs.lstat(absolute);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>128*1024)continue;
    const source=await fs.readFile(absolute,'utf8');
    if(source.includes('\\0'))continue;
    const lines=source.split(/\r?\n/);
    for(let i=0;i<lines.length&&matches.length<50;i++){
      if(!lines[i].toLowerCase().includes(needle))continue;
      // Return location only: avoid accidentally exposing secrets or private source through search results.
      matches.push({path:file.path,line:i+1});
    }
  }
  return {query,items:matches,truncated:index.truncated||matches.length>=50,contentReturned:false};
}
async function search(workspace,query){
  if(typeof query!=='string'||!query.trim()||query.length>120)throw Object.assign(new Error('搜索内容长度必须在 1 到 120 字符'),{status:400});
  const index=await scan(workspace);
  const q=query.toLowerCase();
  return {query,items:index.files.filter(file=>file.path.toLowerCase().includes(q)).slice(0,50),truncated:index.truncated};
}
function prompt(index){
  return index.files.length?'\n\n项目文件路径索引（仅文件名，不包含源码）：\n'+index.files.slice(0,100).map(f=>f.path).join('\n')+(index.truncated?'\n索引已截断。':''):'';
}
module.exports={scan,search,searchContent,prompt};
