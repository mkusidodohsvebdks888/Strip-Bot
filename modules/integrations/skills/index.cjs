'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const {httpError}=require('../../core/providers/index.cjs');
const {cloneGithub}=require('../github/index.cjs');
const MAX_SKILL_FILES=100, MAX_SKILL_BYTES=8*1024*1024;
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function skillName(value){const id=String(value||'').trim().toLowerCase().replace(/[ _]+/g,'-');if(id.length>64 || !ID.test(id))throw httpError(400,'Skill 标识必须是小写英文、数字及单个连接符（最长 64 位）。');return id;}
function parseSkill(content,fallback){
  if(!content.startsWith('---'))throw httpError(400,'SKILL.md 缺少 YAML frontmatter（--- 开头）。');
  const match=/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);if(!match)throw httpError(400,'SKILL.md 的 frontmatter 没有正确结束。');
  const name=/^name:\s*(.*)$/m.exec(match[1])?.[1]?.trim().replace(/^['"]|['"]$/g,'') || fallback;
  const description=/^description:\s*(.*)$/m.exec(match[1])?.[1]?.trim().replace(/^['"]|['"]$/g,'') || '';
  if(!description || description==='|' || description==='>')throw httpError(400,'SKILL.md 需要单行 description，描述什么情况下使用该技能。');
  if(description.length>1024)throw httpError(400,'Skill description 过长。');
  if(content.length>140000)throw httpError(400,'SKILL.md 太大，限制 140KB。');
  return {id:skillName(ID.test(name.toLowerCase()) ? name : fallback),sourceName:name,description};
}
async function findSkillFolder(base,hint=''){
  const real=await fs.realpath(base).catch(()=>{throw httpError(404,'Skill 来源目录不存在。');});
  const target=path.resolve(real,hint || '.');
  if(target!==real && !target.startsWith(real+path.sep))throw httpError(400,'Skill 子目录不能超出仓库范围。');
  const candidates=[target];
  if(!hint){
    const entries=await fs.readdir(target,{withFileTypes:true}).catch(()=>[]);
    for(const item of entries){if(item.isDirectory() && !item.isSymbolicLink() && !item.name.startsWith('.'))candidates.push(path.join(target,item.name));}
    for(const cat of ['skills','.claude/skills','.agents/skills','.codex/skills','.opencode/skills']){
      const sub=path.join(target,cat);const names=await fs.readdir(sub,{withFileTypes:true}).catch(()=>[]);
      for(const item of names){if(item.isDirectory() && !item.isSymbolicLink())candidates.push(path.join(sub,item.name));}
    }
  }
  const matches=[];
  for(const folder of candidates){
    const resolved=await fs.realpath(folder).catch(()=>null);if(!resolved || resolved!==real && !resolved.startsWith(real+path.sep))continue;
    try{const entry=await fs.lstat(path.join(folder,'SKILL.md'));if(entry.isFile() && entry.size<140000)matches.push(folder);}catch{}
  }
  if(!matches.length)throw httpError(422,'未找到 SKILL.md。请填写具体技能子目录，如 skills/my-skill。');
  if(matches.length>1)throw httpError(422,'仓库包含多个 Skill，请填写具体子目录。检测到：'+matches.slice(0,8).map(dir=>path.relative(real,dir)).join('、'));
  return matches[0];
}
async function copySkill(source,target){
  let files=0,bytes=0;
  async function walk(src,dst,depth){
    if(depth>8)throw httpError(422,'Skill 的目录层级过深。');
    await fs.mkdir(dst,{recursive:true});
    for(const item of await fs.readdir(src,{withFileTypes:true})){
      if(item.name.startsWith('.') && item.name!=='.gitignore' || item.name==='node_modules' || item.name==='__pycache__')continue;
      if(item.isSymbolicLink())throw httpError(422,'Skill 中包含符号链接，出于安全考虑不允许直接安装。');
      const from=path.join(src,item.name),to=path.join(dst,item.name);
      if(item.isDirectory())await walk(from,to,depth+1);
      else if(item.isFile()){
        const stat=await fs.stat(from);files++;bytes+=stat.size;
        if(files>MAX_SKILL_FILES||bytes>MAX_SKILL_BYTES)throw httpError(413,'Skill 文件数量或大小超出安全限制。');
        await fs.copyFile(from,to);
      }
    }
  }
  await walk(source,target,0);
  return {files,bytes};
}
function createSkillsRegistry({root,clone=cloneGithub}){
  const storage=path.join(root,'.runtime','skills-library');
  // This directory is explicitly advertised to the Strip Bot managed Codex agent.
  const enabledRoot=path.join(root,'.runtime','skills-enabled');
  const index=path.join(root,'.runtime','skills.json');let queue=Promise.resolve();
  const SAFE_UPLOAD_REL=/^(?!\.)(?:[^\\/:*?"<>|\r\n]+\/)*[^\\/:*?"<>|\r\n]+$/;
  async function materializeUpload(files){
    if(!Array.isArray(files) || !files.length)throw httpError(400,'没有收到任何文件。');
    if(files.length>MAX_SKILL_FILES)throw httpError(413,`Skill 最多 ${MAX_SKILL_FILES} 个文件。`);
    const folder=await fs.mkdtemp(path.join(os.tmpdir(),'strip-skill-up-'));
    let bytes=0;const seen=new Set();
    try{
      for(const file of files){
        const rel=String(file?.path || '').replace(/\\/g,'/');
        if(!SAFE_UPLOAD_REL.test(rel) || rel.split('/').some(segment=>segment==='..' || segment.startsWith('.') && segment!=='.gitignore'))throw httpError(400,`非法文件路径：${rel}`);
        if(seen.has(rel))throw httpError(400,`文件路径重复：${rel}`);
        seen.add(rel);
        const raw=String(file?.base64 || '');
        if(raw && (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length%4!==0))throw httpError(400,`文件内容编码无效：${rel}`);
        const buffer=Buffer.from(raw,'base64');
        bytes+=buffer.length;
        if(bytes>MAX_SKILL_BYTES)throw httpError(413,'Skill 总大小超过 8 MB。');
        const destination=path.join(folder,rel);
        if(!destination.startsWith(folder+path.sep))throw httpError(400,'文件路径超出范围。');
        await fs.mkdir(path.dirname(destination),{recursive:true});
        await fs.writeFile(destination,buffer,{flag:'wx'});
      }
      return folder;
    }catch(error){await fs.rm(folder,{recursive:true,force:true});throw error;}
  }
  async function read(){try{const data=JSON.parse(await fs.readFile(index,'utf8'));return Array.isArray(data)?data:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}}
  async function write(items){await fs.mkdir(path.dirname(index),{recursive:true});const temp=index+'.tmp';await fs.writeFile(temp,JSON.stringify(items,null,2),{mode:0o600});await fs.rename(temp,index);}
  function txn(fn){const task=queue.then(async()=>{const items=await read();const result=await fn(items);await write(items);return result;});queue=task.catch(()=>{});return task;}
  async function stage(items,folder,source){
    const content=await fs.readFile(path.join(folder,'SKILL.md'),'utf8');
    const info=parseSkill(content,path.basename(folder));
    if(items.some(x=>x.id===info.id))throw httpError(409,`Skill ${info.id} 已经安装。请先移除旧版本。`);
    if(items.length>=60)throw httpError(400,'最多管理 60 个 Skills。');
    const installed=path.join(storage,info.id);
    const temp=installed+'.'+randomUUID()+'.tmp';
    try{
      await copySkill(folder,temp);
      // Align name with the agent skill identifier (Claude / Codex skills are also SKILL.md based).
      const first=content.replace(/^(---\s*\r?\n[\s\S]*?^name:\s*)([^\r\n]+)/m,(_,before)=>before+info.id);
      await fs.writeFile(path.join(temp,'SKILL.md'),first);
      await fs.mkdir(storage,{recursive:true});await fs.rename(temp,installed);
      const item={...info,enabled:false,source,installedAt:Date.now()};items.push(item);
      return {ok:true,item};
    }catch(error){await fs.rm(temp,{recursive:true,force:true});throw error;}
  }
  return {
    list:()=>queue.then(read),
    enabledPath:enabledRoot,
    create:({name,description,instructions,confirmed})=>txn(async items=>{
      if(confirmed!==true)throw httpError(400,'创建 Skill 需要确认。');
      const id=skillName(name);
      const desc=String(description||'').trim();const body=String(instructions||'').trim();
      if(!desc || desc.length>1024 || !body || body.length>65000)throw httpError(400,'请填写用途描述（最多 1024 字）和执行说明（最多 65000 字）。');
      const folder=await fs.mkdtemp(path.join(os.tmpdir(),'strip-skill-'));
      try{
        await fs.writeFile(path.join(folder,'SKILL.md'),`---\nname: ${id}\ndescription: ${JSON.stringify(desc)}\n---\n\n${body}\n`);
        return await stage(items,folder,'手动创建');
      }finally{await fs.rm(folder,{recursive:true,force:true});}
    }),
    import:({type,folder,url,subdir,confirmed})=>txn(async items=>{
      if(confirmed!==true)throw httpError(400,'导入外部 Skill 需要明确授权。');
      if(type==='local'){
        if(typeof folder!=='string' || !path.isAbsolute(folder))throw httpError(400,'请输入 Skill 目录绝对路径。');
        const found=await findSkillFolder(folder,subdir || '');
        return stage(items,found,'本地 · '+found);
      }
      if(type==='github'){
        const staging=await fs.mkdtemp(path.join(os.tmpdir(),'strip-skill-gh-'));
        try{
          const repo=path.join(staging,'repo');const meta=await clone(url,repo);
          const found=await findSkillFolder(repo,subdir || '');
          return await stage(items,found,`GitHub · ${meta.owner}/${meta.repo}@${meta.sha.slice(0,10)}`);
        }finally{await fs.rm(staging,{recursive:true,force:true});}
      }
      throw httpError(400,'Skill 来源只支持本地目录或公开 GitHub 仓库。');
    }),
    upload:({files,subdir,label,confirmed})=>txn(async items=>{
      if(confirmed!==true)throw httpError(400,'导入外部 Skill 需要明确授权。');
      const folder=await materializeUpload(files);
      try{
        const found=await findSkillFolder(folder,subdir || '');
        const name=String(label || '').slice(0,80) || path.basename(found);
        return await stage(items,found,'拖入 · '+name);
      }finally{await fs.rm(folder,{recursive:true,force:true});}
    }),
    enable:({id,enabled,confirmed})=>txn(async items=>{
      const item=items.find(x=>x.id===id);if(!item)throw httpError(404,'Skill 不存在。');
      if(typeof enabled!=='boolean' || enabled && confirmed!==true)throw httpError(400,'启用 Skill 需要明确确认。');
      const safeId=skillName(item.id);const target=path.resolve(enabledRoot,safeId);if(path.dirname(target)!==path.resolve(enabledRoot))throw httpError(403,'技能目录超出范围。');
      if(enabled){
        const staging=path.join(storage,safeId+'.'+randomUUID()+'.enable');
        try{await copySkill(path.join(storage,safeId),staging);await fs.mkdir(enabledRoot,{recursive:true});await fs.rm(target,{recursive:true,force:true});await fs.rename(staging,target);}
        finally{await fs.rm(staging,{recursive:true,force:true});}
      }else await fs.rm(target,{recursive:true,force:true});
      item.enabled=enabled;
      return {ok:true,item,needsReload:true};
    }),
    remove:({id,confirmed})=>txn(async items=>{
      if(confirmed!==true)throw httpError(400,'移除 Skill 需要确认。');
      const n=items.findIndex(x=>x.id===id);if(n<0)throw httpError(404,'Skill 不存在。');
      const [item]=items.splice(n,1);skillName(item.id);
      await fs.rm(path.join(enabledRoot,item.id),{recursive:true,force:true});await fs.rm(path.join(storage,item.id),{recursive:true,force:true});return {ok:true,needsReload:true};
    }),
  };
}
module.exports={createSkillsRegistry,parseSkill,skillName,findSkillFolder,copySkill};
