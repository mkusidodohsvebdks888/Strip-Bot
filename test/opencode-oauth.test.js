'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {createAgentService} = require('../backend/agent/service.cjs');
const {createGateway} = require('../backend/gateway.cjs');

function fakeEngine(version, calls) {
  return {executable:__filename, ensure:async () => {},close:async () => {calls.push({version,method:'close'});},
    request:async (route,body) => {
      calls.push({version,route,body});
      if (route === '/api/session/active') return {data:{}};
      if (route.startsWith('/api/model')) return {data:[
        {id:'openai/gpt-test',modelID:'gpt-test',providerID:'openai',name:'GPT Test',enabled:true},
        {id:'gpt-test-fast',modelID:'gpt-test',providerID:'openai',name:'GPT Test Fast',enabled:true},
        {id:'openai/old',modelID:'old',providerID:'openai',name:'Deprecated',enabled:false},
        {id:'strip-local/test',modelID:'test',providerID:'strip-local',name:'Local',enabled:true},
      ]};
      if (route === '/api/session') return {data:{id:'ses_native1',title:'test'}};
      return {data:[]};
    }};
}

test('CC Switch-only deployment blocks native session creation, configuration and prompts',async t=>{
  const observed=[];
  const gateway=createGateway({ccOnly:true,ccSwitchOnly:true,agentService:{close:async()=>{},handle:async(...args)=>{observed.push(args);return {ok:true};}},ccSwitch:{resolve:async()=>({provider:'responses',endpoint:'http://127.0.0.1:15721/v1/responses',model:'gpt-test'})}});
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  t.after(()=>{gateway.close();gateway.closeAllConnections?.();});
  const base='http://127.0.0.1:'+gateway.address().port;
  const post=(route,body)=>fetch(base+'/api/agent'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  for(const route of ['/configure','/sessions','/sessions/ses_old/prompt'])assert.equal((await post(route,{provider:'opencode',text:'test'})).status,410);
  assert.equal(observed.length,0);
  assert.equal((await post('/sessions',{provider:'ccswitch'})).status,200);
  assert.equal(observed.at(-1)[2].configuration.connection,'ccswitch');
  const health=await (await fetch(base+'/api/health')).json();
  assert.equal(health.capabilities.ccSwitchOnly,true);
  assert.equal(health.capabilities.nativeAuth,false);
});

test('unified CC Switch requests resolve the current route on each new conversation and follow-up',async t=>{
  let model='model-a';const observed=[];
  const gateway=createGateway({ccOnly:true,nativeAgent:true,agentService:{close:async()=>{},handle:async(...args)=>{observed.push(args);return {ok:true};}},ccSwitch:{resolve:async()=>({provider:'responses',endpoint:'http://127.0.0.1:15721/v1/responses',model,apiKey:'PROXY_MANAGED'})}});
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  t.after(()=>{gateway.close();gateway.closeAllConnections?.();});
  const post=(route,body)=>fetch('http://127.0.0.1:'+gateway.address().port+'/api/agent'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post('/sessions',{provider:'ccswitch',workspace:__dirname})).status,200);
  assert.equal(observed.at(-1)[2].configuration.model,'model-a');
  assert.equal(observed.at(-1)[2].configuration.connection,'ccswitch');
  assert.equal(observed.at(-1)[2].followCurrent,true);
  model='model-b';
  assert.equal((await post('/sessions',{provider:'ccswitch',workspace:__dirname})).status,200);
  assert.equal(observed.at(-1)[2].configuration.model,'model-b');
  assert.equal((await post('/sessions/ses_test/prompt',{provider:'ccswitch',text:'hello'})).status,200);
  assert.equal(observed.at(-1)[2].routeModel,'model-b');
});

test('native OpenCode OAuth mode is independent of CC Switch and validates OpenAI model ref',async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'strip-opencode-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  const calls = [], factories = [];
  const factory = options => {factories.push(options);return fakeEngine(factories.length,calls);};
  const agent = createAgentService({root,workspaceBase:root,engineFactory:factory,provider:'openai',model:'local',endpoint:'http://127.0.0.1:3010/v1/chat/completions'});
  assert.deepEqual(await agent.handle('POST','/configure',{provider:'opencode'}),{ok:true,connection:'opencode'});
  assert.equal(factories[1].provider,'opencode');
  assert.equal(factories[1].apiKey,'');
  const available = await agent.handle('GET','/models');
  assert.deepEqual(available.models,[{id:'gpt-test',providerID:'openai',name:'GPT Test'},{id:'gpt-test-fast',providerID:'openai',name:'GPT Test Fast'}]);
  assert.equal(available.connection,'opencode');
  await assert.rejects(agent.handle('POST','/sessions',{workspace:root,model:{providerID:'strip-local',id:'test'}}),{status:400});
  await assert.rejects(agent.handle('POST','/sessions',{workspace:root,model:{providerID:'openai',id:'old'}}),{status:400});
  await assert.rejects(agent.handle('POST','/sessions',{workspace:root,model:{providerID:'openai',id:'gpt-made-up'}}),{status:400});
  await agent.handle('POST','/sessions',{workspace:root,model:{providerID:'openai',id:'gpt-test'},title:'test'});
  assert.deepEqual(calls.filter(x => x.route === '/api/session')[0].body.model,{providerID:'openai',id:'gpt-test'});
  assert.deepEqual(calls.filter(x => x.route === '/api/session')[0].body.permissions,[{action:'*',resource:'*',effect:'ask'}]);
  await agent.handle('POST','/sessions',{workspace:root,model:{providerID:'openai',id:'gpt-test-fast'}});
  assert.deepEqual(calls.filter(x=>x.route==='/api/session').at(-1).body.model,{providerID:'openai',id:'gpt-test-fast'});
});

test('CC-only gateway accepts native OpenCode Agent configuration but blocks other local providers',async t => {
  const observed = [];
  const agent = {close:async () => {},handle:async (...args) => {observed.push(args);return {ok:true};}};
  const gateway = createGateway({ccOnly:true,agentService:agent});
  await new Promise(resolve => gateway.listen(0,'127.0.0.1',resolve));
  t.after(() => {gateway.close();gateway.closeAllConnections?.();});
  const base = 'http://127.0.0.1:'+gateway.address().port;
  const post = async body => fetch(base+'/api/agent/configure',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({provider:'opencode'})).status,200);
  assert.deepEqual(observed.at(-1),['POST','/configure',{provider:'opencode'}]);
  assert.equal((await post({provider:'openai',endpoint:'http://127.0.0.1:3010/v1/chat/completions',model:'gpt-test'})).status,410);
});

test('unified native conversation create and follow-up never resolve CC Switch',async t => {
  const observed=[];
  const agent={close:async()=>{},handle:async(...args)=>{observed.push(args);return {ok:true};}};
  const gateway=createGateway({ccOnly:true,agentService:agent,ccSwitch:{resolve:async()=>{throw new Error('CC Switch must not be used');}}});
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  t.after(()=>{gateway.close();gateway.closeAllConnections?.();});
  const base='http://127.0.0.1:'+gateway.address().port;
  const post=async(route,body)=>fetch(base+'/api/agent'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post('/sessions',{provider:'opencode',modelOverride:'gpt-test',workspace:__dirname})).status,200);
  assert.deepEqual(observed.at(-1)[2].configuration,{provider:'opencode'});
  assert.deepEqual(observed.at(-1)[2].model,{providerID:'openai',id:'gpt-test'});
  assert.equal((await post('/sessions/ses_native1/prompt',{provider:'opencode',text:'continue'})).status,200);
  assert.equal(observed.at(-1)[2].routeModel,undefined);
});
