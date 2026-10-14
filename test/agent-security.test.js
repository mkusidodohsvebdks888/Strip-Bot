'use strict';
const {test} = require('node:test'),assert = require('node:assert/strict'),fs = require('node:fs/promises'),path = require('node:path');
const {createAgentService} = require('../backend/agent/service.cjs');
const {createGateway} = require('../backend/gateway.cjs');
const http = require('node:http');

test('Agent API isolates sessions, validates workspaces and only accepts one-time permission replies',async () => {
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
