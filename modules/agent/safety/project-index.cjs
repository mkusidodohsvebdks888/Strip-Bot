'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const SKIP=new Set(['.git','.runtime','node_modules','dist','build','coverage','vendor','.next','.venv','target']);
const EXT=new Set(['.js','.jsx','.ts','.tsx','.cjs','.mjs','.py','.java','.go','.rs','.md','.css','.html','.vue','.sql','.yml','.yaml','.toml']);
const CACHE=new Map();
async function scan(workspace){
  const cwd=await fs.realpath(workspace);
  const cached=CACHE.get(cwd);
  if(cached&&Date.now()-cached.at<30000)return cached.value;
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
async function search(workspace,query){
  if(typeof query!=='string'||!query.trim()||query.length>120)throw Object.assign(new Error('搜索内容长度必须在 1 到 120 字符'),{status:400});
  const index=await scan(workspace);
  const q=query.toLowerCase();
  return {query,items:index.files.filter(file=>file.path.toLowerCase().includes(q)).slice(0,50),truncated:index.truncated};
}
function prompt(index){
  return index.files.length?'\n\n项目文件路径索引（仅文件名，不包含源码）：\n'+index.files.slice(0,100).map(f=>f.path).join('\n')+(index.truncated?'\n索引已截断。':''):'';
}
module.exports={scan,search,prompt};
