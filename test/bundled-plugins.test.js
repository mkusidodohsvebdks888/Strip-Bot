'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createBundledPlugins}=require('../backend/bundled-plugins.cjs');
const harness=require('../plugins/deepseek-harness-pet/index.cjs');
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
  const registry=createBundledPlugins({root});
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
  await assert.rejects(registry.enable({id:'nono-desktop',enabled:true}),/明确确认/);
  await registry.enable({id:'nono-desktop',enabled:true,confirmed:true});
  assert.equal((await registry.list()).find(x=>x.id==='nono-desktop').runtime.running,true);
  await registry.enable({id:'nono-desktop',enabled:false,confirmed:true});
  assert.deepEqual(calls,[true,false]);
}));
test('DeepSeek Harness pet only resolves local Windows EXE and does not download',async()=>{
  assert.equal(harness.executable({platform:'linux'}),null);
  assert.equal(harness.executable({platform:'win32',env:{DEEPSEEK_HARNESS_PET_BIN:'relative.exe'}}),null);
  assert.ok(harness.executable({platform:'win32',env:{LOCALAPPDATA:'C:/Users/Example/AppData/Local'}})?.endsWith('DeepSeekHarnessPet.exe'));
  const state=await harness.status({platform:'linux'});
  assert.equal(state.supported,false);
  await assert.rejects(harness.execute({action:'delete'}),/仅支持启动/);
});
