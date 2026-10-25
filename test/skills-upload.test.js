'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createSkillsRegistry}=require('../backend/skills.cjs');
const b64=value=>Buffer.from(value,'utf8').toString('base64');
async function sandbox(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-skill-upload-'));try{return await fn(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
test('browser dropped skill uploads materialize into the disabled library',()=>sandbox(async root=>{
  const registry=createSkillsRegistry({root});
  const result=await registry.upload({confirmed:true,subdir:'my-skill',label:'my-skill',files:[
    {path:'my-skill/SKILL.md',base64:b64('---\nname: my-skill\ndescription: Uploaded skill\n---\n\nUse it.\n')},
    {path:'my-skill/references/checklist.md',base64:b64('Verify endpoints.\n')},
  ]});
  assert.equal(result.item.id,'my-skill');
  assert.equal(result.item.enabled,false);
  assert.match(result.item.source,/拖入/);
  assert.match(await fs.readFile(path.join(root,'.runtime','skills-library','my-skill','SKILL.md'),'utf8'),/Uploaded skill/);
  assert.equal(await fs.readFile(path.join(root,'.runtime','skills-library','my-skill','references','checklist.md'),'utf8'),'Verify endpoints.\n');
  assert.equal((await registry.list()).length,1);
}));
test('browser skill upload rejects missing confirmation, traversal and invalid base64',()=>sandbox(async root=>{
  const registry=createSkillsRegistry({root});
  const file=(filePath,base64=b64('---\nname: safe\ndescription: Safe\n---\n'))=>({path:filePath,base64});
  await assert.rejects(registry.upload({confirmed:false,subdir:'safe',files:[file('safe/SKILL.md')]}),{status:400});
  await assert.rejects(registry.upload({confirmed:true,subdir:'safe',files:[file('../escape/SKILL.md')]}),{status:400});
  await assert.rejects(registry.upload({confirmed:true,subdir:'safe',files:[file('safe/SKILL.md','%%%not-base64%%%')]}),{status:400});
  assert.deepEqual(await registry.list(),[]);
}));