'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {createApiConnection,normalizeBase}=require('../backend/api-connection.cjs');
const {createGateway}=require('../backend/gateway.cjs');
const {createAgentService}=require('../backend/agent/service.cjs');
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
const close=server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();});
const vault=async(value,decrypt)=>decrypt?Buffer.from(value.slice(5),'base64').toString():('test:'+Buffer.from(value).toString('base64'));

test('API configuration hides keys, requires encrypted storage and prevents keys following a changed destination',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-api-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const direct=createApiConnection({root,vault});
  assert.equal(normalizeBase('https://api.openai.com/v1/responses'),'https://api.openai.com/v1');
  assert.throws(()=>normalizeBase('http://public.example/v1'),{status:400});
  assert.throws(()=>normalizeBase('https://u:pw@example.com/v1'),{status:400});
  const saved=await direct.save({baseUrl:'https://example.com/v1',model:'gpt-test',protocol:'responses',apiKey:'sample-test-secret'});
  assert.equal(saved.hasKey,true);assert.ok(!JSON.stringify(saved).includes('sample-test-secret'));
  const disk=await fs.readFile(path.join(root,'.runtime','api-connection.json'),'utf8');assert.ok(!disk.includes('sample-test-secret'));
  await assert.rejects(direct.save({baseUrl:'https://different.example/v1',model:'gpt-test',protocol:'responses'}),{status:400});
  const reload=createApiConnection({root,vault});assert.equal((await reload.status()).hasKey,true);
  await reload.save({baseUrl:'https://example.com/v1',model:'gpt-next',protocol:'openai'});assert.equal((await reload.status()).hasKey,true);
  const cleared=await reload.save({baseUrl:'http://127.0.0.1:9999/v1',model:'local-test',protocol:'responses',clearKey:true});assert.equal(cleared.hasKey,false);
});

test('direct API sessions and tool-result follow-ups bypass CC Switch; proxy is authenticated and secrets stay backend-only',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-api-route-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const observed=[];
  const upstream=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;observed.push({auth:req.headers.authorization,path:req.url,body:JSON.parse(raw)});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({object:'response',status:'completed',output:[]}));});
  const upstreamBase=await listen(upstream);t.after(()=>close(upstream));
  const direct=createApiConnection({root,vault});await direct.save({baseUrl:upstreamBase+'/v1',model:'gpt-test',protocol:'responses',apiKey:'server-test-key'});
  const calls=[];
  const gateway=createGateway({connectionOptions:true,ccOnly:true,ccSwitchOnly:true,apiConnection:direct,agentService:{close:async()=>{},handle:async(...args)=>{calls.push(args);return {ok:true};}},ccSwitch:{resolve:async()=>{throw new Error('CC Switch must not be called');}}});
  const base=await listen(gateway);t.after(()=>close(gateway));
  const post=(route,body={},headers={})=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  const route=await direct.resolve(base);
  assert.equal((await post('/api/agent/sessions',{provider:'direct',workspace:root})).status,200);
  const configured=calls.at(-1)[2];assert.equal(configured.configuration.connection,'direct');assert.equal(configured.configuration.endpoint,route.endpoint);assert.equal(configured.configuration.apiKey,direct.internalKey());
  assert.equal((await post('/api/agent/sessions/ses_test/prompt',{provider:'direct',text:'tool output result'})).status,200);assert.equal(calls.at(-1)[2].routeEndpoint,route.endpoint);
  assert.equal((await post('/api/agent/configure',{provider:'direct'})).status,200);assert.equal(calls.at(-1)[2].connection,'direct');
  assert.equal((await post('/api/connection/save',{}, {origin:'https://evil.example'})).status,403);
  const proxyPath=new URL(route.endpoint).pathname;
  assert.equal((await post(proxyPath,{input:'hello'})).status,401);
  assert.equal((await post(proxyPath,{model:'wrong',input:[{type:'function_call_output',call_id:'call_test',output:'file read'}],stream:false},{authorization:'Bearer '+route.apiKey})).status,200);
  assert.equal(observed.at(-1).auth,'Bearer server-test-key');assert.equal(observed.at(-1).body.model,'gpt-test');assert.equal(observed.at(-1).body.input[0].call_id,'call_test');
  const status=await (await fetch(base+'/api/connection/status')).json();assert.equal(status.hasKey,true);assert.ok(!JSON.stringify(status).includes('server-test-key'));
  assert.equal((await direct.check()).ok,true);
  await direct.save({baseUrl:upstreamBase+'/v1',model:'new-model',protocol:'responses'});
  assert.equal((await post(proxyPath,{input:'old config'},{authorization:'Bearer '+route.apiKey})).status,409);
});

test('connection test distinguishes auth, quota and malformed success responses',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-api-errors-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  let code=401;
  const direct=createApiConnection({root,vault,fetchImpl:async()=>new Response(JSON.stringify({error:{message:'upstream private info'}}),{status:code})});
  await direct.save({baseUrl:'https://example.com/v1',protocol:'responses',model:'gpt-test'});
  assert.equal((await direct.check()).status,401);code=429;assert.equal((await direct.check()).status,429);code=200;assert.equal((await direct.check()).ok,false);
});

test('direct Agent credentials are internal, survive session reload, and cannot mix with CC Switch sessions',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-api-agent-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const engines=[];
  const factory=options=>{engines.push(options);return {executable:__filename,ensure:async()=>{},close:async()=>{},request:async(route)=>route==='/api/session'?{data:{id:'ses_direct1'}}:route==='/api/session/active'?{data:{}}:{data:[]}};};
  const agent=createAgentService({root,workspaceBase:root,engineFactory:factory,directApiKey:()=> 'internal-relay-secret'});
  const endpoint='http://127.0.0.1:3060/api/connection/proxy/abcdef/v1/responses';
  await agent.handle('POST','/sessions',{workspace:root,model:{providerID:'strip-local',id:'gpt-test'},configuration:{endpoint,model:'gpt-test',provider:'responses',connection:'direct'}});
  assert.equal(engines.at(-1).apiKey,'internal-relay-secret');
  const stored=await fs.readFile(path.join(root,'.runtime','agent-sessions.json'),'utf8');assert.ok(!stored.includes('internal-relay-secret'));
  await assert.rejects(agent.handle('POST','/sessions/ses_direct1/prompt',{provider:'ccswitch',text:'wrong route'}),{status:409});
  await assert.rejects(agent.handle('POST','/sessions/ses_direct1/prompt',{provider:'direct',routeEndpoint:endpoint+'/changed',text:'stale API'}),{status:409});
  const restored=createAgentService({root,workspaceBase:root,engineFactory:factory,directApiKey:()=> 'new-relay-secret'});
  await restored.handle('POST','/sessions/ses_direct1/prompt',{provider:'direct',routeEndpoint:endpoint,text:'same API, fresh process'});
  assert.equal(engines.at(-1).apiKey,'new-relay-secret');
});

test('disconnecting the API account clears its saved secret, retains non-secret preferences and invalidates old proxy URLs',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-api-disconnect-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const direct=createApiConnection({root,vault});
  const saved=await direct.save({baseUrl:'https://example.org/v1',model:'gpt-test',protocol:'responses',apiKey:'revoke-local-secret'});
  assert.equal(saved.hasKey,true);
  const oldRevision=saved.revision;
  const oldRoute=await direct.resolve('http://127.0.0.1:3000');
  const gateway=createGateway({connectionOptions:true,apiConnection:direct,agentService:{close:async()=>{},handle:async()=>({ok:true})}});
  const base=await listen(gateway);t.after(()=>close(gateway));
  assert.equal((await fetch(base+'/api/connection/disconnect',{method:'POST',headers:{origin:'https://foreign.example','content-type':'application/json'},body:'{}'})).status,403);
  assert.equal((await direct.status()).hasKey,true);
  const response=await fetch(base+'/api/connection/disconnect',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(response.status,200);
  const state=await response.json();
  assert.equal(state.hasKey,false);
  assert.equal(state.configured,true);
  assert.equal(state.baseUrl,'https://example.org/v1');
  assert.equal(state.model,'gpt-test');
  assert.notEqual(state.revision,oldRevision);
  const serialized=await fs.readFile(path.join(root,'.runtime','api-connection.json'),'utf8');
  assert.ok(!serialized.includes('revoke-local-secret'));
  assert.equal(JSON.parse(serialized).encryptedKey,'');
  const reload=createApiConnection({root,vault});
  assert.equal((await reload.status()).hasKey,false);
  const oldPath=new URL(oldRoute.endpoint).pathname;
  const oldRequest=await fetch(base+oldPath,{method:'POST',headers:{'Content-Type':'application/json',authorization:'Bearer '+oldRoute.apiKey},body:JSON.stringify({input:'test'})});
  assert.equal(oldRequest.status,409);
  const after=await direct.save({baseUrl:'https://example.org/v1',model:'gpt-test',protocol:'responses',apiKey:'revoke-local-secret'});
  assert.equal(after.hasKey,true);
  assert.notEqual(after.revision,oldRevision);
  const reusedOldRoute=await fetch(base+oldPath,{method:'POST',headers:{'Content-Type':'application/json',authorization:'Bearer '+oldRoute.apiKey},body:JSON.stringify({input:'no-reuse'})});
  assert.equal(reusedOldRoute.status,409);
});

test('DeepSeek connection failures retain distinct upstream HTTP reasons without leaking credentials',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-api-diagnosis-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 let code=401;
 const direct=createApiConnection({root,vault,fetchImpl:async()=>new Response(JSON.stringify({error:{message:'private-upstream sk-test-secret'}}),{status:code})});
 const body={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',protocol:'openai',apiKey:'sk-test-secret'};
 for(const status of [401,403,402,429]){code=status;await assert.rejects(direct.connect(body),error=>{assert.ok(error.message.includes('HTTP '+status));assert.ok(!error.message.includes('sk-test-secret'));assert.ok(!error.message.includes('private-upstream'));return true;});}
 assert.equal((await direct.status()).hasKey,false);
});
