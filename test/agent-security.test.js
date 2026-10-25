'use strict';
const {test} = require('node:test'),assert = require('node:assert/strict'),fs = require('node:fs/promises'),path = require('node:path');
const {createAgentService} = require('../backend/agent/service.cjs');
const {createGateway} = require('../backend/gateway.cjs');
const http = require('node:http');

test('Agent API isolates sessions, validates workspaces and rejects unconfirmed persistent permission replies',async () => {
  const root = path.resolve(__dirname,'..','.runtime','agent-security-'+Date.now());await fs.mkdir(root,{recursive:true});
  let sessionCount = 0;const calls = [];
  const engine = {executable:__filename,ensure:async () => {},close:async () => {},request:async (route,body) => {
    calls.push({route,body});
    if (route === '/api/session') return {data:{id:'ses_test'+(++sessionCount),title:'test'}};
    if (route.endsWith('/permission')) return {data:[{id:'per_test',sessionID:'ses_test1',action:'edit',resources:['result.txt']}]};
    return {data:[]};
  }};
  const agent = createAgentService({root,workspaceBase:root,engine});
  const model = {id:'test',providerID:'strip-local'};
  await assert.rejects(agent.handle('POST','/sessions',{workspace:path.dirname(root),model}),{status:403});
  const a = await agent.handle('POST','/sessions',{workspace:root,model});
  const b = await agent.handle('POST','/sessions',{workspace:root,model});
  await assert.rejects(agent.handle('POST','/sessions/ses_unknown/prompt',{text:'test'}),{status:404});
  await assert.rejects(agent.handle('POST',`/sessions/${b.session.id}/permissions`,{requestID:'per_test',decision:'once'}),{status:404});
  await assert.rejects(agent.handle('POST',`/sessions/${a.session.id}/permissions`,{requestID:'per_test',decision:'always'}),{status:400});
  await agent.handle('POST',`/sessions/${a.session.id}/permissions`,{requestID:'per_test',decision:'reject'});
  assert.deepEqual(calls.at(-1),{route:'/api/session/ses_test1/permission/per_test/reply',body:{decision:'reject'}});
  await assert.rejects(agent.handle('POST','/shell',{command:'anything'}),{status:404});
});

test('Persistent approval requires current engine rules, explicit confirmation and session ownership',async () => {
  const root=path.resolve(__dirname,'..','.runtime','approval-security-'+Date.now());await fs.mkdir(root,{recursive:true});
  let count=0,fail=false,pending=[];const replies=[];
  const engine={executable:__filename,ensure:async()=>{},close:async()=>{},request:async(route,body)=>{
    if(route==='/api/session')return {data:{id:'ses_approval'+(++count),title:'approval test'}};
    if(route.endsWith('/permission'))return {data:pending};
    if(route.endsWith('/reply')){
      if(fail)throw Object.assign(new Error('upstream unavailable'),{status:502});
      replies.push({route,body});pending=pending.filter(p=>!route.includes('/'+p.id+'/'));return {data:{}};
    }
    return {data:[]};
  }};
  const agent=createAgentService({root,workspaceBase:root,engine});
  const model={id:'test',providerID:'strip-local'};
  const a=await agent.handle('POST','/sessions',{workspace:root,model});
  const b=await agent.handle('POST','/sessions',{workspace:root,model});
  const route='/sessions/'+a.session.id+'/permissions';
  pending=[{id:'per_rules',sessionID:a.session.id,action:'shell',resources:['npm run build'],save:['npm run *']}];
  const body={requestID:'per_rules',decision:'always',confirmed:true,confirmedAction:'shell',confirmedRules:['npm run *']};
  await assert.rejects(agent.handle('POST','/sessions/'+b.session.id+'/permissions',body),{status:404});
  await assert.rejects(agent.handle('POST',route,{...body,confirmed:false}),{status:400});
  await assert.rejects(agent.handle('POST',route,{...body,confirmedAction:'*'}),{status:400});
  await assert.rejects(agent.handle('POST',route,{...body,confirmedRules:['*']}),{status:400});
  pending[0].save=[];
  await assert.rejects(agent.handle('POST',route,body),{status:400});
  pending[0].save=['npm run *'];fail=true;
  await assert.rejects(agent.handle('POST',route,body),{status:502});
  assert.equal(pending.length,1);assert.equal(replies.length,0);
  fail=false;
  // Duplicate concurrent submissions are serialized and re-check pending requests.
  const results=await Promise.allSettled([agent.handle('POST',route,body),agent.handle('POST',route,body)]);
  assert.equal(results[0].status,'fulfilled');assert.equal(results[1].reason.status,404);
  assert.equal(replies.length,1);
  assert.deepEqual(replies[0],{route:'/api/session/'+a.session.id+'/permission/per_rules/reply',body:{decision:'always'}});
  for(const decision of ['once','reject']){
    pending=[{id:'per_rules',sessionID:a.session.id,action:'read',resources:['test.txt']}];
    await agent.handle('POST',route,{requestID:'per_rules',decision});
    assert.deepEqual(replies.at(-1).body,{decision});
  }
  await agent.close();
});

test('Agent gateway rejects external Host/Origin and exposes no arbitrary shell route',async () => {
  const agent = {close:async () => {},handle:async () => ({installed:true})};
  const gateway = createGateway({agentService:agent});
  await new Promise(resolve => gateway.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${gateway.address().port}`;
  try {
    assert.equal((await fetch(base+'/api/agent/status')).status,200);
    const hostStatus = await new Promise(resolve => http.get({hostname:'127.0.0.1',port:gateway.address().port,path:'/api/agent/status',headers:{Host:'evil.example:'+gateway.address().port}},res => {res.resume();resolve(res.statusCode);}));
    assert.equal(hostStatus,403);
    assert.equal((await fetch(base+'/api/agent/status',{headers:{origin:'https://evil.example'}})).status,403);
    assert.equal((await fetch(base+'/api/agent/status',{headers:{origin:base}})).status,200);
  } finally {await new Promise(resolve => gateway.close(resolve));}
});
