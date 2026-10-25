'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createBundledPlugins}=require('../backend/bundled-plugins.cjs');
const harness=require('../plugins/deepseek-harness-pet/index.cjs');
function fakePet(){
  let running=false;
  return {status:async()=>({installed:true,supported:true,running}),
    launch:async()=>{running=true;},stop:async()=>{running=false;},
    execute:async()=>{throw Error('仅支持启动或停止');}};
}
async function sandbox(fn){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'stripbot-plugin-test-'));
  try{return await fn(root);}finally{await fs.rm(root,{recursive:true,force:true});}
}
test('plugin center shows two pets, archive and conversion as independent plugins',()=>sandbox(async root=>{
  const calls=[];
  const nono={status:()=>({enabled:false,supported:true,running:false,state:'stopped'}),
    setEnabled:async enabled=>{calls.push(enabled);return{enabled,running:enabled};}};
  const plugins=createBundledPlugins({root,nono});
  const list=await plugins.list();
  assert.deepEqual(list.map(item=>item.id),['nono-desktop','deepseek-harness-pet','archive-7zip','office-pdf']);
  assert.deepEqual(list.map(item=>item.category),['desktop-pet','desktop-pet','archive','document']);
  assert.ok(list.every(item=>item.enabled===false));
  assert.ok(list.every(item=>item.available===true));
  assert.equal(calls.length,0);
}));
test('file and pet plugins require an explicit enable and operation confirmation',()=>sandbox(async root=>{
  const registry=createBundledPlugins({root,pet:fakePet()});
  await assert.rejects(registry.execute({id:'office-pdf',action:'convert',input:'/tmp/a.docx',output:'/tmp/out',confirmed:true}),/请先启用/);
  assert.throws(()=>registry.enable({id:'office-pdf',enabled:true}),/明确确认/);
  await registry.enable({id:'office-pdf',enabled:true,confirmed:true});
  await assert.rejects(registry.execute({id:'office-pdf',action:'convert',input:'/tmp/a.docx',output:'/tmp/out'}),/明确确认/);
  await registry.enable({id:'deepseek-harness-pet',enabled:true,confirmed:true});
  await assert.rejects(registry.execute({id:'deepseek-harness-pet',action:'launch'}),/明确确认/);
  await assert.rejects(registry.execute({id:'nono-desktop',action:'launch',confirmed:true}),/启用开关/);
  await assert.rejects(registry.execute({id:'unknown-plugin',action:'launch',confirmed:true}),/不存在/);
  await registry.enable({id:'office-pdf',enabled:false,confirmed:true});
  assert.equal((await registry.list()).find(item=>item.id==='office-pdf').enabled,false);
}));
test('Nono enable is delegated to the existing desktop service, not duplicated',()=>sandbox(async root=>{
  const calls=[];let enabled=false;
  const nono={status:()=>({enabled,supported:true,running:enabled,state:enabled?'running':'stopped'}),
    setEnabled:async value=>{enabled=value;calls.push(value);return{enabled:value,running:value};}};
  const registry=createBundledPlugins({root,nono});
  assert.throws(()=>registry.enable({id:'nono-desktop',enabled:true}),/明确确认/);
  await registry.enable({id:'nono-desktop',enabled:true,confirmed:true});
  assert.equal((await registry.list()).find(x=>x.id==='nono-desktop').runtime.running,true);
  await registry.enable({id:'nono-desktop',enabled:false,confirmed:true});
  assert.deepEqual(calls,[true,false]);
}));
test('Q版桌宠用固定源码独立运行，禁用后停止由StripBot启动的进程',async()=>sandbox(async root=>{
  const pets=createBundledPlugins({root,pet:fakePet()});
  const all=await pets.list();
  const pet=all.find(x=>x.id==='deepseek-harness-pet');
  assert.match(pet.name,/Q版/);
  assert.equal(pet.enabled,false);
  assert.equal(pet.runtime.running,false);
  await assert.rejects(pets.execute({id:'deepseek-harness-pet',action:'launch',confirmed:true}),/请先启用/);
  await pets.enable({id:'deepseek-harness-pet',enabled:true,confirmed:true});
  assert.equal((await pets.list()).find(x=>x.id==='deepseek-harness-pet').runtime.running,true);
  await assert.rejects(pets.execute({id:'deepseek-harness-pet',action:'destroy',confirmed:true}),/仅支持启动或停止/);
  await pets.enable({id:'deepseek-harness-pet',enabled:false,confirmed:true});
  assert.equal((await pets.list()).find(x=>x.id==='deepseek-harness-pet').enabled,false);
  assert.equal((await pets.list()).find(x=>x.id==='deepseek-harness-pet').runtime.running,false);
  await pets.enable({id:'deepseek-harness-pet',enabled:true,confirmed:true});
  assert.equal((await pets.list()).find(x=>x.id==='deepseek-harness-pet').runtime.running,true);
}));
test('Q版桌宠独立入口必须是绝对路径的 standalone.js',async()=>{
  assert.equal(harness.resolveScript({env:{DSH_PET_STANDALONE_PATH:'relative.js'}}),null);
  assert.equal(harness.resolveScript({env:{DSH_PET_STANDALONE_PATH:'/tmp/unsafe.js'}}),null);
  const filename=harness.resolveScript({env:{},baseDir:path.resolve(__dirname,'../plugins/deepseek-harness-pet')});
  assert.ok(filename.endsWith(path.join('dsh-pet','lib','standalone.js')));
  await assert.rejects(harness.execute({action:'destroy'}),/仅支持启动或停止/);
});
