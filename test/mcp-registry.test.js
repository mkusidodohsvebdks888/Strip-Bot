'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createIntegrationRegistry,normalize}=require('../modules/integrations/mcp/index.cjs');

test('MCP normalization rejects insecure remote HTTP and embedded credentials',()=>{
  assert.throws(()=>normalize({id:'remote_1',label:'Remote',type:'remote',url:'http://example.com/mcp'}));
  assert.throws(()=>normalize({id:'remote_1',label:'Remote',type:'remote',url:'https://user:pass@example.com/mcp'}));
  assert.equal(normalize({id:'remote_1',label:'Remote',type:'remote',url:'https://example.com/mcp'}).enabled,false);
});

test('MCP diagnostics report configuration without launching commands',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'stripbot-mcp-test-'));
  try{
    const registry=createIntegrationRegistry({root});
    await registry.upsert({id:'local_1',label:'Local',type:'local',command:['definitely-not-a-real-command'],cwd:root});
    const diagnostic=await registry.inspect({id:'local_1'});
    assert.equal(diagnostic.configured,true);
    assert.equal(diagnostic.connected,null);
    assert.equal(diagnostic.checks.find(check=>check.name==='工作目录').ok,true);
    assert.equal(diagnostic.checks.find(check=>check.name==='进程启动').ok,null);
    await assert.rejects(registry.inspect({id:'missing'}));
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('MCP remote diagnostics never send a network request',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'stripbot-mcp-test-'));
  try{
    const registry=createIntegrationRegistry({root});
    await registry.upsert({id:'remote_1',label:'Remote',type:'remote',url:'https://example.com/mcp'});
    const diagnostic=await registry.inspect({id:'remote_1'});
    assert.equal(diagnostic.connected,null);
    assert.equal(diagnostic.checks.find(check=>check.name==='协议握手').ok,null);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
