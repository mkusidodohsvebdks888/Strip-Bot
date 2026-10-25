'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createApiConnection}=require('../backend/api-connection.cjs');
const {createGateway}=require('../backend/gateway.cjs');
const vault=async(value,decrypt)=>decrypt?Buffer.from(value.slice(5),'base64').toString():('test:'+Buffer.from(value).toString('base64'));
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
const close=server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();});
const respond=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};

test('new API connection validates before saving and sends a key only to selected endpoint',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-api-login-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const calls=[];
  const upstream=http.createServer(async(req,res)=>{
    calls.push({path:req.url,authorization:req.headers.authorization});
    if(req.headers.authorization==='Bearer rejected')return respond(res,401,{error:'invalid'});
    if(req.url==='/v1/chat/completions')return respond(res,200,{choices:[{message:{role:'assistant',content:'OK'}}]});
    return respond(res,404,{error:'unmatched'});
  });
  const url=await listen(upstream);t.after(()=>close(upstream));
  const direct=createApiConnection({root,vault});
  const gateway=createGateway({connectionOptions:true,ccOnly:true,ccSwitchOnly:true,apiConnection:direct,agentService:{handle:async()=>({}),close:async()=>{}}});
  const local=await listen(gateway);t.after(()=>close(gateway));
  const connect=(apiKey,model='test-model')=>fetch(local+'/api/connection/connect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({apiKey,model,baseUrl:url+'/v1',protocol:'openai'})});
  const rejected=await connect('rejected');
  assert.equal(rejected.status,401);
  assert.equal((await direct.status()).configured,false);
  await assert.rejects(fs.access(path.join(root,'.runtime','api-connection.json')));
  const valid=await connect('accepted');
  assert.equal(valid.status,200);
  const first=await direct.status();
  assert.equal(first.hasKey,true);
  assert.equal(first.model,'test-model');
  assert.equal((await connect('rejected')).status,401);
  const stillSaved=await direct.status();
  assert.equal(stillSaved.revision,first.revision);
  assert.equal(stillSaved.model,first.model);
  assert.deepEqual(calls.map(entry=>entry.path),Array(3).fill('/v1/chat/completions'));
  assert.deepEqual(calls.map(entry=>entry.authorization),['Bearer rejected','Bearer accepted','Bearer rejected']);
  assert.ok(!JSON.stringify(stillSaved).includes('accepted'));
});

test('connect never reuses saved key when a destination changes',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-api-key-scope-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const calls=[];
  const direct=createApiConnection({root,vault,fetchImpl:async(url,init)=>{
    calls.push({url,authorization:init.headers.Authorization});
    return new Response(JSON.stringify({object:'response',status:'completed',output:[]}),{headers:{'content-type':'application/json'}});
  }});
  const original=await direct.save({baseUrl:'https://first.example/v1',protocol:'responses',model:'first-model',apiKey:'first-secret'});
  await assert.rejects(direct.connect({baseUrl:'https://second.example/v1',protocol:'responses',model:'second-model'}),{status:400});
  assert.equal(calls.length,0);
  assert.equal((await direct.status()).revision,original.revision);
  await assert.rejects(direct.connect({baseUrl:'https://second.example/v1',protocol:'responses',model:'second-model',apiKey:'bad\nkey'}),{status:400});
  assert.equal(calls.length,0);
});
