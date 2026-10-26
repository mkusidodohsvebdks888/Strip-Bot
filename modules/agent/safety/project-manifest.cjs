'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
async function projectManifest(workspace){
  const root=await fs.realpath(workspace);
  const filename=path.join(root,'package.json');
  try{
    const stat=await fs.lstat(filename);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536)return {available:false};
    const pkg=JSON.parse(await fs.readFile(filename,'utf8'));
    const scripts=Object.fromEntries(Object.entries(pkg.scripts||{}).filter(([key,value])=>typeof key==='string'&&typeof value==='string').slice(0,30));
    return {available:true,name:String(pkg.name||''),scripts,dependencies:Object.keys(pkg.dependencies||{}).slice(0,80),devDependencies:Object.keys(pkg.devDependencies||{}).slice(0,80)};
  }catch(error){if(error.code==='ENOENT')return {available:false};throw error;}
}
module.exports={projectManifest};
