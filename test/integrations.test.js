'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createIntegrationRegistry}=require('../backend/integrations.cjs');
const {createGateway}=require('../backend/gateway.cjs');

async function fixture(run){const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-integration-'));try{return await run(root);}finally{await fs.rm(root,{recursive:true,force:true});}}

test('integrations require explicit consent, generate v2 MCP configuration and avoid accidental command re-approval',()=>fixture(async root=>{
  const registry=createIntegrationRegistry({root});
  const command=['node','D:\\Projects\\Pet\\mcp.cjs'];
  await registry.upsert({id:'my_pet',label:'桌宠',type:'local',command});
  assert.deepEqual(await registry.asMcpServers(),{});
  await assert.rejects(registry.enable({id:'my_pet',enabled:true}),{status:400});
  await registry.enable({id:'my_pet',enabled:true,confirmed:true});
  assert.deepEqual(await registry.asMcpServers(),{my_pet:{type:'local',command}});
  await registry.upsert({id:'my_pet',label:'桌宠',type:'local',command:['node','changed.js']});
  assert.equal((await registry.list())[0].enabled,false);
  await registry.upsert({id:'my_pet',label:'桌宠',type:'local',command:['node','changed.js']});
  assert.equal((await registry.list())[0].enabled,false);
  await registry.upsert({id:'localhost_api',label:'本地 MCP',type:'remote',url:'http://127.0.0.1:5010/mcp'});
  await registry.enable({id:'localhost_api',enabled:true,confirmed:true});
  assert.deepEqual((await registry.asMcpServers()).localhost_api,{type:'remote',url:'http://127.0.0.1:5010/mcp'});
  await assert.rejects(registry.upsert({id:'bad',label:'bad',type:'remote',url:'http://unsafe.example/mcp'}),{status:400});
  await assert.rejects(registry.upsert({id:'bad',label:'bad',type:'remote',url:'file:///tmp/x'}),{status:400});
  await assert.rejects(registry.upsert({id:'bad',label:'bad',type:'local',command:'node project.js'}),{status:400});
  await assert.rejects(registry.remove({id:'my_pet'}),{status:400});
  await registry.remove({id:'my_pet',confirmed:true});
  assert.equal((await registry.list()).length,1);
  const second=createIntegrationRegistry({root});
  assert.equal((await second.list())[0].id,'localhost_api');
}));

test('integration gateway enforces same-origin, delegates reload, and returns project list',()=>fixture(async root=>{
  let reloads=0;
  const agent={handle:async()=>({ok:true}),close:async()=>{},reloadIntegrations:async()=>({ok:true,reloaded:++reloads})};
  const account={close:async()=>{}};
  const ccSwitch={status:async()=>({ok:true})};
  const server=createGateway({agentRoot:root,agentService:agent,accountService:account,ccSwitch});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=`http://127.0.0.1:${server.address().port}`;
  try{
    const send=(endpoint,payload,origin=address)=>fetch(address+endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const other=await send('/api/integrations',{id:'my_pet',label:'桌宠',type:'local',command:['node','my.js']},'https://attacker.example');
    assert.equal(other.status,403);
    const created=await send('/api/integrations',{id:'my_pet',label:'桌宠',type:'local',command:['node','my.js']});
    assert.equal(created.status,200);
    const list=await fetch(address+'/api/integrations');
    assert.equal((await list.json()).items[0].enabled,false);
    const reloaded=await send('/api/integrations/reload',{});
    assert.deepEqual(await reloaded.json(),{ok:true,reloaded:1});
  }finally{await new Promise(resolve=>server.close(resolve));}
}));

test('agent tool reload is blocked during active work and safely restarts the sidecar when idle',async()=>fixture(async root=>{
  const {createAgentService}=require('../backend/agent/service.cjs');
  let active={};let starts=0,closes=0;
  const engine={executable:__filename,ensure:async()=>{starts++;},close:async()=>{closes++;},request:async route=>route==='/api/session/active'?{data:active}:{data:[]}};
  const service=createAgentService({root,engine});
  try {
    assert.equal((await service.reloadIntegrations()).reloaded,false);
    await service.handle('GET','/models');
    active={ses_123:{status:'running'}};
    await assert.rejects(service.reloadIntegrations(),{status:409});
    assert.equal(closes,0);
    active={};
    assert.equal((await service.reloadIntegrations()).reloaded,true);
    assert.equal(starts,2);assert.equal(closes,1);
  } finally {await service.close();}
}));
