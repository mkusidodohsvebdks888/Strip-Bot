'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const DRAFTS=new Map();
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const allowed=/^codex-ui\/src\/generated-ui\/[A-Za-z][A-Za-z0-9]{0,75}Preview\.tsx$/;
function validate(filename,source){
 if(typeof filename!=='string'||!allowed.test(filename))throw Object.assign(new Error('仅允许写入 generated-ui 下的独立预览组件'),{status:400});
 if(typeof source!=='string'||!source.trim()||source.length>100000)throw Object.assign(new Error('生成代码不能为空或超过 100 KB'),{status:400});
 if(/\b(?:eval\s*\(|new\s+Function\s*\(|child_process|node:fs|process\.env|dangerouslySetInnerHTML)\b/.test(source))throw Object.assign(new Error('生成代码包含不允许的高风险调用'),{status:400});
}
function expire(){for(const [id,item] of DRAFTS)if(Date.now()-item.at>30*60*1000)DRAFTS.delete(id);}
async function propose({workspace,filename,source}){
 validate(filename,source);expire();
 const base=await fs.realpath(workspace);
 const target=path.resolve(base,...filename.split('/'));
 if(!target.startsWith(base+path.sep))throw Object.assign(new Error('目标路径不在项目内'),{status:403});
 const parent=path.dirname(target);
 const expectedParent=path.resolve(base,'codex-ui','src');
 // All existing ancestors must be real directories, not symlinks.
 let current=base;
 for(const segment of filename.split('/').slice(0,-1)){
   current=path.join(current,segment);
   const stat=await fs.lstat(current).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
   if(stat&&!stat.isDirectory())throw Object.assign(new Error('目标目录包含文件或符号链接'),{status:409});
 }
 if(!parent.startsWith(expectedParent+path.sep))throw Object.assign(new Error('目标目录不允许写入'),{status:403});
 const existing=await fs.lstat(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(existing)throw Object.assign(new Error('目标文件已存在，不允许覆盖'),{status:409});
 const id='uig_'+crypto.randomBytes(12).toString('hex');
 const item={id,workspace:base,filename,source,hash:sha(source),at:Date.now()};
 DRAFTS.set(id,item);
 return {id,filename,hash:item.hash,expiresAt:item.at+30*60*1000,diff:source.split(/\r?\n/).map(line=>'+'+line).join('\n'),kind:'add'};
}
async function apply({workspace,id,hash,confirmed}){
 if(confirmed!==true)throw Object.assign(new Error('需要明确批准'),{status:400});
 expire();const item=DRAFTS.get(id);
 if(!item||item.workspace!==await fs.realpath(workspace)||item.hash!==hash)throw Object.assign(new Error('草案已过期或内容不匹配'),{status:409});
 validate(item.filename,item.source);
 const target=path.resolve(item.workspace,...item.filename.split('/'));
 // Never create directories in an unexpected or symlinked ancestor.
 let current=item.workspace;
 for(const segment of item.filename.split('/').slice(0,-1)){
   current=path.join(current,segment);
   const stat=await fs.lstat(current).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
   if(stat&&!stat.isDirectory())throw Object.assign(new Error('目标目录不安全'),{status:409});
   if(!stat)await fs.mkdir(current);
 }
 const handle=await fs.open(target,'wx',0o600);
 try{await handle.writeFile(item.source,'utf8');}finally{await handle.close();}
 DRAFTS.delete(id);
 return {ok:true,filename:item.filename,hash:item.hash};
}
module.exports={propose,apply};
