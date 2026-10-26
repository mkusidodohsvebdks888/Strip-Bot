'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createIntegrationRegistry}=require('../modules/integrations/mcp/index.cjs');

test('MCP tool permissions fail closed until server is enabled and tool approved',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'stripbot-permissions-'));
  try{
    const registry=createIntegrationRegistry({root});
    await registry.upsert({id:'test_mcp',label:'Test',type:'local',command:['node','example.js']});
    assert.equal((await registry.evaluatePermission({id:'test_mcp',tool:'read'})).allowed,false);
    await registry.enable({id:'test_mcp',enabled:true,confirmed:true});
    assert.equal((await registry.evaluatePermission({id:'test_mcp',tool:'read'})).reason,'approval_required');
    assert.equal((await registry.evaluatePermission({id:'test_mcp',tool:'read',approved:true})).allowed,true);
    await registry.setPermission({id:'test_mcp',tool:'read',mode:'deny'});
    assert.equal((await registry.evaluatePermission({id:'test_mcp',tool:'read',approved:true})).allowed,false);
    await registry.setPermission({id:'test_mcp',tool:'read',mode:'allow'});
    assert.equal((await registry.evaluatePermission({id:'test_mcp',tool:'read'})).allowed,true);
    assert.equal((await registry.evaluatePermission({id:'missing',tool:'read'})).allowed,false);
    await registry.enable({id:'test_mcp',enabled:false});
    assert.equal((await registry.evaluatePermission({id:'test_mcp',tool:'read'})).allowed,false);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
