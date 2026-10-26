'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createCloudClient,CLOUD_ID,CLOUD_URL,isCloud}=require('../modules/integrations/mcp/cloud-client.cjs');
const {createIntegrationRegistry}=require('../backend/integrations.cjs');
const {createGateway}=require('../backend/gateway.cjs');
const TOKEN='test-only-render-token-of-32-characters';
const BAD_TOKEN='wrong-but-long-token-with-32-characters';
async function fixture(run){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-cloud-'));
  try{return await run(root);}finally{await fs.rm(root,{recursive:true,force:true});}
}
function mockedFetch(calls){
  return async(url,options)=>{
    assert.equal(url,CLOUD_URL,'Only the pinned cloud endpoint can be contacted');
    assert.equal(options.method,'POST');
    assert.equal(options.redirect,'manual');
    const message=JSON.parse(options.body);
    calls.push({method:message.method,token:options.headers.Authorization});
    if(options.headers.Authorization!=='Bearer '+TOKEN)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{'content-type':'application/json'}});
    if(message.method==='notifications/initialized')return new Response(null,{status:202});
    const answer=message.method==='initialize'?{protocolVersion:'2025-03-26',serverInfo:{name:'stripbot-public-readonly'}}:
      message.method==='tools/list'?{tools:[{name:'service_status',description:'Read-only service status'}]}:
      message.method==='tools/call'&&message.params?.name==='service_status'?{content:[{type:'text',text:'{"ok":true}'}]}:null;
    if(answer===null)throw Error('Unexpected tool');
    return new Response(JSON.stringify({jsonrpc:'2.0',id:message.id,result:answer}),{status:200,headers:{'content-type':'application/json'}});
  };
}
test('pinned cloud client completes authenticated MCP handshake and only allows read-only status',async()=>{
  const calls=[];
  const client=createCloudClient({fetchImpl:mockedFetch(calls)});
  const discovery=await client.probe(TOKEN);
  assert.equal(discovery.connected,true);
  assert.deepEqual(discovery.tools.map(item=>item.name),['service_status']);
  assert.deepEqual(await client.call(TOKEN,'service_status',{}),{content:[{type:'text',text:'{"ok":true}'}]});
  assert(calls.some(call=>call.method==='tools/call'));
  await assert.rejects(client.probe(BAD_TOKEN),{status:401});
  assert.throws(()=>client.call(TOKEN,'shell',{command:'ls'}),{status:403});
  assert.throws(()=>client.call(TOKEN,'service_status',{unwanted:true}),{status:403});
  assert.equal(isCloud({id:CLOUD_ID,type:'remote',url:CLOUD_URL}),true);
  assert.equal(isCloud({id:CLOUD_ID,type:'remote',url:'http://169.254.169.254/mcp'}),false);
});
test('cloud registry keeps credentials in memory, enforces per-tool permission and denies agent bypass',()=>fixture(async root=>{
  let probes=0,calls=0;
  const cloudClient={
    probe:async token=>{assert.equal(token,TOKEN);probes++;return {connected:true,protocolVersion:'2025-03-26',tools:[{name:'service_status'}]};},
    call:async(token,tool,args)=>{assert.equal(token,TOKEN);assert.equal(tool,'service_status');assert.deepEqual(args,{});calls++;return {content:[{type:'text',text:'ok'}]};}
  };
  const registry=createIntegrationRegistry({root,cloudClient});
  await assert.rejects(registry.connectCloud({token:TOKEN}),{status:400});
  await registry.connectCloud({token:TOKEN,confirmed:true});
  const status=await registry.cloudStatus();
  assert.equal(status.registered,true);
  assert.equal(status.credentialsLoaded,true);
  assert.deepEqual(await registry.asMcpServers(),{},'Never expose bearer-less remote server directly to agent');
  assert.equal((await registry.list())[0].url,CLOUD_URL);
  const stored=await fs.readFile(path.join(root,'.runtime','integrations.json'),'utf8');
  assert(!stored.includes(TOKEN),'No cloud token on disk');
  assert(!JSON.stringify(await registry.permissions({id:CLOUD_ID})).includes(TOKEN));
  await registry.probe({id:CLOUD_ID,confirmed:true});
  const result=await registry.callService({id:CLOUD_ID,tool:'service_status',arguments:{},confirmed:true});
  assert.equal(result.ok,true);
  assert.equal(probes,1);assert.equal(calls,1);
  await assert.rejects(registry.callService({id:CLOUD_ID,tool:'service_status',arguments:{},confirmed:false}),{status:400});
  await assert.rejects(registry.callService({id:CLOUD_ID,tool:'delete_all',arguments:{},confirmed:true}),{status:403});
  await registry.setPermission({id:CLOUD_ID,tool:'service_status',mode:'deny'});
  await assert.rejects(registry.callService({id:CLOUD_ID,tool:'service_status',arguments:{},confirmed:true}),{status:403});
  const audit=await fs.readFile(path.join(root,'.runtime','mcp-cloud-audit.jsonl'),'utf8');
  assert(!audit.includes(TOKEN),'Audit must never contain authentication tokens');
  await registry.remove({id:CLOUD_ID,confirmed:true});
  assert.equal((await registry.cloudStatus()).credentialsLoaded,false);
  const restart=createIntegrationRegistry({root,cloudClient});
  assert.equal((await restart.cloudStatus()).credentialsLoaded,false);
}));
test('gateway cloud onboarding never returns or persists bearer token',()=>fixture(async root=>{
  const gateway=createGateway({
    agentRoot:root,
    agentService:{handle:async()=>({ok:true}),close:async()=>{},reloadIntegrations:async()=>({ok:true})},
    accountService:{close:async()=>{}},ccSwitch:{status:async()=>({ok:true})}
  });
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+gateway.address().port;
  try{
    const status=await fetch(base+'/api/integrations/cloud/status');
    assert.equal(status.status,200);
    assert.equal((await status.json()).registered,false);
    const connect=await fetch(base+'/api/integrations/cloud/connect',{method:'POST',
      headers:{Origin:base,'Content-Type':'application/json'},
      body:JSON.stringify({token:TOKEN,confirmed:true,url:'http://169.254.169.254/'})});
    assert.equal(connect.status,200);
    const data=await connect.json();
    assert.equal(data.ok,true);
    assert(!JSON.stringify(data).includes(TOKEN));
    const list=await (await fetch(base+'/api/integrations')).json();
    assert.equal(list.items[0].url,CLOUD_URL);
    assert(!JSON.stringify(list).includes(TOKEN));
    const forbidden=await fetch(base+'/api/integrations/cloud/connect',{method:'POST',headers:{Origin:'https://malicious.example','Content-Type':'application/json'},body:JSON.stringify({token:TOKEN,confirmed:true})});
    assert.equal(forbidden.status,403);
  }finally{await new Promise(resolve=>gateway.close(resolve));}
}));
