'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createBundledPlugins}=require('../backend/bundled-plugins.cjs');
test('plugins default disabled and require confirmation',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'stripbot-plugin-test-'));
  try{
    const p=createBundledPlugins({root});
    assert.equal((await p.list()).length,2);
    await assert.rejects(p.execute({id:'office-pdf',confirmed:true,action:'convert',input:'/tmp/a',output:'/tmp/out'}),/尚未启用/);
    assert.throws(()=>p.enable({id:'office-pdf',enabled:true}),/确认/);
    await p.enable({id:'office-pdf',enabled:true,confirmed:true});
    assert.equal((await p.list()).find(x=>x.id==='office-pdf').enabled,true);
    await assert.rejects(p.execute({id:'office-pdf',action:'convert',input:'/tmp/a',output:'/tmp/out',confirmed:true}),/绝对路径|不支持/);
    await p.enable({id:'office-pdf',enabled:false,confirmed:true});
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
