'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const DRAFTS=new Map();
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const allowed=/^codex-ui\/src\/generated-ui\/[A-Za-z][A-Za-z0-9]{0,75}Preview\.tsx$/;
const HISTORY=new Map();
const historyDirectory=workspace=>path.join(workspace,'.stripbot','ui-generation-history');
async function saveHistory(entry,undo){
 const directory=historyDirectory(entry.workspace);
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 const filename=path.join(directory,undo+'.json');
 await fs.writeFile(filename,JSON.stringify(entry),{flag:'wx',mode:0o600});
}
async function loadHistory(workspace,undo){
 if(typeof undo!=='string'||!/^uir_[a-f0-9]{24}$/.test(undo))throw Object.assign(new Error('无效的恢复标识'),{status:400});
 const base=await fs.realpath(workspace);
 const memory=HISTORY.get(undo);
 if(memory&&memory.workspace===base)return memory;
 const file=path.join(historyDirectory(base),undo+'.json');
 const stat=await fs.lstat(file).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(!stat||!stat.isFile()||stat.size>250000)throw Object.assign(new Error('恢复记录不存在或不安全'),{status:404});
 const entry=JSON.parse(await fs.readFile(file,'utf8'));
 if(entry.workspace!==base||!allowed.test(entry.filename)||typeof entry.appliedHash!=='string'||(entry.previous!==null&&typeof entry.previous!=='string'))throw Object.assign(new Error('恢复记录校验失败'),{status:409});
 return entry;
}

function syntaxCheck(workspace,source){
 let ts;
 try{ts=require(require.resolve('typescript',{paths:[path.join(workspace,'codex-ui')]}));}
 catch{throw Object.assign(new Error('缺少本地 TypeScript 编译器。请先在 codex-ui 安装依赖，才能审核生成代码。'),{status:503});}
 const file=ts.createSourceFile('GeneratedPreview.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const diagnostics=file.parseDiagnostics||[];
 if(diagnostics.length){
   const details=diagnostics.slice(0,5).map(d=>{
     const pos=file.getLineAndCharacterOfPosition(d.start||0);
     return (pos.line+1)+':'+(pos.character+1)+' '+ts.flattenDiagnosticMessageText(d.messageText,' ');
   });
   throw Object.assign(new Error('TSX 语法检查未通过：'+details.join('；')),{status:400});
 }
 return {ok:true,engine:'TypeScript parser',note:'已检查 TSX 语法，未执行生成代码；完整类型检查仍需运行项目构建。'};
}
function validate(filename,source){
 if(typeof filename!=='string'||!allowed.test(filename))throw Object.assign(new Error('仅允许写入 generated-ui 下的独立预览组件'),{status:400});
 if(typeof source!=='string'||!source.trim()||source.length>100000)throw Object.assign(new Error('生成代码不能为空或超过 100 KB'),{status:400});
 if(/\b(?:eval\s*\(|new\s+Function\s*\(|child_process|node:fs|process\.env|dangerouslySetInnerHTML)\b/.test(source))throw Object.assign(new Error('生成代码包含不允许的高风险调用'),{status:400});
 if(/\b(?:import\s*\(|require\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket|window\.|document\.|localStorage|sessionStorage|iframe|script|onerror\s*=)\b/i.test(source))throw Object.assign(new Error('预览组件不得调用网络、浏览器存储或动态执行接口'),{status:400});
 const imports=[...source.matchAll(/(?:^|\n)\s*import\s+[^;\n]+?\s+from\s+['\"]([^'\"]+)['\"]/g)];
 if(imports.some(match=>match[1]!=='react'))throw Object.assign(new Error('独立预览组件只允许从 react 导入'),{status:400});
}
function expire(){for(const [id,item] of DRAFTS)if(Date.now()-item.at>30*60*1000)DRAFTS.delete(id);}
async function propose({workspace,filename,source}){
 validate(filename,source);expire();
 const base=await fs.realpath(workspace);
 const validation=syntaxCheck(base,source);
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
 if(existing&&!existing.isFile())throw Object.assign(new Error('目标不是普通文件'),{status:409});
 const previous=existing?await fs.readFile(target,'utf8'):null;
 if(previous!==null&&previous.length>100000)throw Object.assign(new Error('现有文件过大'),{status:409});
 const id='uig_'+crypto.randomBytes(12).toString('hex');
 const item={id,workspace:base,filename,source,hash:sha(source),previous,previousHash:previous===null?null:sha(previous),at:Date.now()};
 DRAFTS.set(id,item);
 return {id,filename,hash:item.hash,expiresAt:item.at+30*60*1000,diff:(previous===null?'':previous.split(/\r?\n/).map(line=>'-'+line).join('\n')+'\n')+source.split(/\r?\n/).map(line=>'+'+line).join('\n'),kind:previous===null?'add':'replace',validation};
}
async function apply({workspace,id,hash,confirmed}){
 if(confirmed!==true)throw Object.assign(new Error('需要明确批准'),{status:400});
 expire();const item=DRAFTS.get(id);
 if(!item||item.workspace!==await fs.realpath(workspace)||item.hash!==hash)throw Object.assign(new Error('草案已过期或内容不匹配'),{status:409});
 validate(item.filename,item.source);
 syntaxCheck(item.workspace,item.source);
 const target=path.resolve(item.workspace,...item.filename.split('/'));
 // Never create directories in an unexpected or symlinked ancestor.
 let current=item.workspace;
 for(const segment of item.filename.split('/').slice(0,-1)){
   current=path.join(current,segment);
   const stat=await fs.lstat(current).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
   if(stat&&!stat.isDirectory())throw Object.assign(new Error('目标目录不安全'),{status:409});
   if(!stat)await fs.mkdir(current);
 }
 const existing=await fs.lstat(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(existing&&!existing.isFile())throw Object.assign(new Error('目标不是普通文件'),{status:409});
 const actual=existing?await fs.readFile(target,'utf8'):null;
 if((actual===null?null:sha(actual))!==item.previousHash)throw Object.assign(new Error('目标文件在审核后发生变化，请重新生成草案'),{status:409});
 if(actual===null){const handle=await fs.open(target,'wx',0o600);try{await handle.writeFile(item.source,'utf8');}finally{await handle.close();}}
 else{const temporary=target+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';const handle=await fs.open(temporary,'wx',0o600);try{await handle.writeFile(item.source,'utf8');}finally{await handle.close();}try{await fs.rename(temporary,target);}catch(error){await fs.unlink(temporary).catch(()=>{});throw error;}}
 const undo='uir_'+crypto.randomBytes(12).toString('hex');
 const entry={workspace:item.workspace,filename:item.filename,previous:item.previous,appliedHash:item.hash,at:Date.now()};
 await saveHistory(entry,undo);
 HISTORY.set(undo,entry);
 DRAFTS.delete(id);
 return {ok:true,filename:item.filename,hash:item.hash,undo};
}
async function rollback({workspace,undo,confirmed}){
 if(confirmed!==true)throw Object.assign(new Error('需要明确确认恢复'),{status:400});
 const entry=await loadHistory(workspace,undo);
 if(!entry||entry.workspace!==await fs.realpath(workspace))throw Object.assign(new Error('恢复记录不存在或已失效'),{status:404});
 const target=path.resolve(entry.workspace,...entry.filename.split('/'));
 let current=entry.workspace;
 for(const segment of entry.filename.split('/').slice(0,-1)){current=path.join(current,segment);const stat=await fs.lstat(current);if(!stat.isDirectory())throw Object.assign(new Error('路径已发生变化'),{status:409});}
 const stat=await fs.lstat(target);
 if(!stat.isFile()||sha(await fs.readFile(target,'utf8'))!==entry.appliedHash)throw Object.assign(new Error('文件已经被其他操作修改，拒绝恢复'),{status:409});
 if(entry.previous===null)await fs.unlink(target);
 else await fs.writeFile(target,entry.previous,{flag:'w'});
 HISTORY.delete(undo);
 await fs.unlink(path.join(historyDirectory(entry.workspace),undo+'.json')).catch(error=>{if(error.code!=='ENOENT')throw error;});
 return {ok:true,filename:entry.filename};
}
module.exports={propose,apply,rollback};
