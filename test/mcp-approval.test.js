'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createIntegrationRegistry}=require('../modules/integrations/mcp/index.cjs');

async function fixture(run){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'stripbot-mcp-approval-'));
  try{
    const registry=createIntegrationRegistry({root});
    await registry.upsert({id:'approval_mcp',label:'Approval test',type:'local',command:['node','test-server.js']});
    await registry.enable({id:'approval_mcp',enabled:true,confirmed:true});
    return await run(registry);
  }finally{await fs.rm(root,{recursive:true,force:true});}
}
test('MCP ask requests require a one-time decision and cannot be replayed',()=>fixture(async registry=>{
  const request=await registry.requestApproval({id:'approval_mcp',tool:'read_file'});
  assert.equal(request.reason,'approval_required');
  assert.ok(request.requestId);
  const decision=await registry.decideApproval({requestId:request.requestId,allow:true});
  assert.equal(decision.allowed,true);
  assert.match(decision.note,/尚未授权或执行工具调用/);
  await assert.rejects(registry.decideApproval({requestId:request.requestId,allow:true}),/不存在或已处理/);
  assert.equal((await registry.evaluatePermission({id:'approval_mcp',tool:'read_file'})).allowed,false);
}));
test('MCP approval is rejected after policy changes or server disable',()=>fixture(async registry=>{
  const first=await registry.requestApproval({id:'approval_mcp',tool:'read_file'});
  await registry.setPermission({id:'approval_mcp',tool:'read_file',mode:'deny'});
  assert.equal((await registry.decideApproval({requestId:first.requestId,allow:true})).reason,'policy_changed');
  await registry.setPermission({id:'approval_mcp',tool:'read_file',mode:'ask'});
  const second=await registry.requestApproval({id:'approval_mcp',tool:'read_file'});
  await registry.enable({id:'approval_mcp',enabled:false});
  assert.equal((await registry.decideApproval({requestId:second.requestId,allow:true})).allowed,false);
}));
test('MCP allow and deny modes do not create approval requests',()=>fixture(async registry=>{
  await registry.setPermission({id:'approval_mcp',tool:'read_file',mode:'allow'});
  assert.equal((await registry.requestApproval({id:'approval_mcp',tool:'read_file'})).requestId,null);
  await registry.setPermission({id:'approval_mcp',tool:'read_file',mode:'deny'});
  assert.equal((await registry.requestApproval({id:'approval_mcp',tool:'read_file'})).requestId,null);
}));
