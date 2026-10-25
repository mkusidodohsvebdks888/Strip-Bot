'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createAgentService}=require('../backend/agent/service.cjs');
const {createGateway}=require('../backend/gateway.cjs');
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+s.address().port)));
const close=s=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections?.();});

test('deleting a session removes OpenCode and owned persistence only when stopped',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-session-delete-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  let running=false,rejectDelete=false;const operations=[];
  const factory=()=>({executable:__filename,ensure:async()=>{},close:async()=>{},request:async(route,body,method)=>{
    operations.push({route,method});
    if(route==='/api/session')return {data:{id:'ses_delete1'}};
    if(route==='/api/session/active')return {data:running?{ses_delete1:true}:{}};
    if(route==='/api/session/ses_delete1' && method==='DELETE'){
      if(rejectDelete)throw Object.assign(new Error('engine denied delete'),{status:502});
      return {data:{deleted:true}};
    }
    return {data:[]};
  }});
  const service=createAgentService({root,workspaceBase:root,engineFactory:factory});t.after(()=>service.close());
  await service.handle('POST','/sessions',{workspace:root,configuration:{provider:'responses',connection:'ccswitch',endpoint:'http://127.0.0.1:15721/v1/responses',model:'gpt-test'},model:{providerID:'strip-local',id:'gpt-test'}});
  const disk=path.join(root,'.runtime','agent-sessions.json');
  assert.ok(JSON.parse(await fs.readFile(disk,'utf8')).ses_delete1);
  running=true;
  await assert.rejects(service.handle('DELETE','/sessions/ses_delete1'),{status:409});
  assert.ok(JSON.parse(await fs.readFile(disk,'utf8')).ses_delete1);
  running=false;rejectDelete=true;
  await assert.rejects(service.handle('DELETE','/sessions/ses_delete1'),/engine denied delete/);
  assert.ok(JSON.parse(await fs.readFile(disk,'utf8')).ses_delete1);
  rejectDelete=false;
  assert.equal((await service.handle('DELETE','/sessions/ses_delete1')).deleted,true);
  assert.equal(JSON.parse(await fs.readFile(disk,'utf8')).ses_delete1,undefined);
  assert.ok(operations.some(op=>op.method==='DELETE' && op.route==='/api/session/ses_delete1'));
  await assert.rejects(service.handle('DELETE','/sessions/ses_delete1'),{status:404});
});

test('gateway DELETE is limited to same-origin owned Agent session route',async t=>{
  const calls=[];
  const gateway=createGateway({agentService:{close:async()=>{},handle:async(...args)=>{calls.push(args);return {ok:true};}}});
  const base=await listen(gateway);t.after(()=>close(gateway));
  const doDelete=(endpoint,origin)=>fetch(base+endpoint,{method:'DELETE',headers:origin?{Origin:origin}:{}});
  assert.equal((await doDelete('/api/agent/sessions/ses_a', 'https://evil.example')).status,403);
  assert.equal((await doDelete('/api/connection/save')).status,405);
  assert.equal((await doDelete('/api/agent/sessions/ses_a/prompt')).status,405);
  assert.equal((await doDelete('/api/agent/sessions/ses_a',base)).status,200);
  assert.deepEqual(calls.at(-1).slice(0,2),['DELETE','/sessions/ses_a']);
});
