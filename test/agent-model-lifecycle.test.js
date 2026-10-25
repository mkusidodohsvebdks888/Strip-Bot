'use strict';
const {test} = require('node:test'),assert = require('node:assert/strict'),fs = require('node:fs/promises'),path = require('node:path');
const {createAgentService} = require('../backend/agent/service.cjs');

test('new Agent tasks bind fresh models; running tasks block reconfiguration and old tasks cannot silently change model',async t => {
  const root = path.resolve(__dirname,'..','.runtime','agent-model-'+Date.now());await fs.mkdir(root,{recursive:true});
  let active = {},count=0;const created = [],prompts=[];
  const factory = config => ({executable:__filename,ensure:async () => {},close:async () => {},request:async (route,body) => {
    if (route === '/api/session/active') return {data:active};
    if (route === '/api/session') {created.push({model:body.model,config});return {data:{id:'ses_model'+(++count),title:'model task'}};}
    if (route.endsWith('/prompt')) {prompts.push(body);return {data:{}};}
    return {data:[]};
  }});
  const agent = createAgentService({root,workspaceBase:root,engineFactory:factory});t.after(() => agent.close());
  const configuration = model => ({endpoint:'http://127.0.0.1:15721/v1/responses',provider:'responses',connection:'ccswitch',model});
  const create = model => agent.handle('POST','/sessions',{workspace:root,followCurrent:true,configuration:configuration(model)});
  const a = (await create('model-a')).session;
  assert.equal(created[0].model.id,'model-a');
  active = {[a.id]:{status:'busy'}};
  await assert.rejects(create('model-b'),{status:409});
  // New behavior: a prompt arriving while a turn is active is accepted into the durable queue.
  const overlap=await agent.handle('POST',`/sessions/${a.id}/prompt`,{text:'overlap',routeModel:'model-a'});
  assert.equal(overlap.accepted,true);
  await assert.rejects(create('model-b'),{status:409});
  await agent.handle('POST',`/sessions/${a.id}/tasks/${overlap.task.id}/cancel`,{});
  active = {};
  await assert.rejects(agent.handle('POST',`/sessions/${a.id}/prompt`,{text:'stale',routeModel:'model-b'}),{status:409});
  const b = (await create('model-b')).session;
  assert.equal(created.at(-1).model.id,'model-b');assert.equal(created.at(-1).config.apiKey,'PROXY_MANAGED');
  await assert.rejects(agent.handle('POST',`/sessions/${a.id}/prompt`,{text:'old',routeModel:'model-b'}),{status:409});
  const next=await agent.handle('POST',`/sessions/${b.id}/prompt`,{text:'new',routeModel:'model-b'});
  assert.equal(next.accepted,true);
  await agent.handle('POST',`/sessions/${b.id}/tasks/${next.task.id}/cancel`,{});
  const history = await agent.handle('GET',`/sessions/${a.id}`);
  assert.equal(history.model.id,'model-a');assert.equal(history.configurationChanged,true);
  // Concurrent creates must each configure and create atomically.
  const results = await Promise.all([create('model-c'),create('model-d')]);
  assert.deepEqual(results.map(r=>r.session.model.id),['model-c','model-d']);
  assert.deepEqual(created.slice(-2).map(r=>r.config.model),['model-c','model-d']);
});
