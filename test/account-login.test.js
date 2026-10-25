'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAccount}=require('../backend/opencode-account.cjs');
const {createGateway}=require('../backend/gateway.cjs');
test('account OAuth filters credentials, tracks owned attempts and preserves model variants',async()=>{
  const calls=[];let progress='pending',loginURL='https://auth.openai.com/authorize?state=private';
  const account=createAccount({engine:{ensure:async()=>{},close:async()=>{},request:async(route,body,method)=>{
    calls.push({route,body,method});
    if(route==='/api/integration')return {data:[{id:'openai',connections:[{type:'credential',method:'oauth',id:'SECRET'}]}]};
    if(route==='/api/model')return {data:[{providerID:'openai',id:'openai/gpt-test-fast',modelID:'gpt-test',name:'Fast',variants:[{id:'max',settings:{reasoningEffort:'max',private:'SECRET'}}]},{providerID:'other',id:'other/model'},{providerID:'openai',id:'old',enabled:false}]};
    if(route.endsWith('/oauth'))return {data:{attemptID:'owned',url:loginURL}};
    return {data:{status:progress,message:'private upstream information'}};
  }}});
  assert.deepEqual(await account.status(),{connected:true,models:[{id:'gpt-test-fast',name:'Fast',variants:[{id:'max',effort:'max'}]}],attempt:undefined});
  assert.equal((await account.login()).status,'pending');
  assert.deepEqual(calls.find(c=>c.body)?.body,{methodID:'chatgpt-browser'});
  for(const value of ['pending','complete','failed','expired']){await account.login();progress=value;const state=await account.status();assert.equal(state.attempt.status,value);assert.ok(!JSON.stringify(state).includes('SECRET'));assert.ok(!JSON.stringify(state).includes('private'));}
  await account.login();await account.cancel();assert.equal(calls.at(-1).route,'/api/integration/openai/connect/oauth/owned');assert.equal(calls.at(-1).method,'DELETE');
  loginURL='https://evil.example/authorize';await assert.rejects(account.login(),/授权地址无效/);await account.close();
});
test('third connection enables native sessions without CC Switch and protects OAuth endpoints',async t=>{
  const observed=[];
  const gateway=createGateway({ccOnly:true,ccSwitchOnly:true,connectionOptions:true,chatgptLogin:true,accountService:{status:async()=>({connected:true,models:[]}),login:async()=>({status:'pending'}),close:async()=>{}},agentService:{close:async()=>{},handle:async(...args)=>{observed.push(args);return {ok:true};}},ccSwitch:{resolve:async()=>{throw new Error('Unexpected CC Switch lookup');}}});
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));t.after(()=>{gateway.close();gateway.closeAllConnections?.();});
  const base='http://127.0.0.1:'+gateway.address().port;
  const post=(route,body,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await fetch(base+'/api/connection/account/status')).status,200);
  assert.equal((await post('/api/connection/account/login',{}, {Origin:'https://evil.example'})).status,403);
  assert.equal((await post('/api/agent/sessions',{provider:'opencode',modelOverride:'gpt-test'})).status,200);
  assert.deepEqual(observed.at(-1)[2].model,{providerID:'openai',id:'gpt-test'});
  assert.equal((await post('/api/agent/sessions/ses_test/prompt',{provider:'opencode',text:'hello'})).status,200);
  assert.equal(observed.at(-1)[2].routeModel,undefined);
});
test('account login is disabled unless explicitly enabled',async t=>{
  const gateway=createGateway();await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));t.after(()=>{gateway.close();gateway.closeAllConnections?.();});
  assert.equal((await fetch('http://127.0.0.1:'+gateway.address().port+'/api/connection/account/status')).status,410);
});

test('expired OAuth attempts do not invalidate an existing connected account',async()=>{
  const account=createAccount({engine:{ensure:async()=>{},close:async()=>{},request:async route=>{
    if(route==='/api/integration')return {data:[{id:'openai',connections:[{type:'credential',method:'oauth'}]}]};
    if(route==='/api/model')return {data:[{id:'gpt-test',providerID:'openai'}]};
    if(route.endsWith('/oauth'))return {data:{attemptID:'expired',url:'https://auth.openai.com/authorize'}};
    const error=new Error('OAuth attempt not found');error.status=404;throw error;
  }}});
  await account.login();const status=await account.status();assert.equal(status.connected,true);assert.equal(status.attempt.status,'expired');assert.equal((await account.status()).attempt,undefined);await account.close();
});
