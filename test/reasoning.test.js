const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createAgentService}=require('../backend/agent/service.cjs');
test('reasoning stops use declared effort, not speed aliases or invented Ultra',async()=>{
  const {reasoningChoices}=await import('../codex-ui/src/components/ModelSwitcher/reasoning.mjs');
  const choices=reasoningChoices([{id:'custom-low',effort:'low'},{id:'maximum',effort:'max'}]);
  assert.deepEqual(choices.map(v=>v?.id || null),['custom-low',null,null,null,'maximum']);
  assert.deepEqual(reasoningChoices([]),[null,null,null,null,null]);
});
test('native session forwards a declared reasoning variant and rejects unsupported variants',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-effort-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const calls=[];
  const engine={ensure:async()=>{},close:async()=>{},request:async(route,body)=>{
    calls.push({route,body});
    if(route==='/api/model')return {data:[{id:'gpt-test',providerID:'openai',variants:[{id:'max',settings:{reasoningEffort:'max'}}]}]};
    if(route==='/api/session')return {data:{id:'ses_effort'}};
    return {data:{}};
  }};
  const service=createAgentService({root,workspaceBase:root,provider:'opencode',connection:'opencode',engine});
  const create=variant=>service.handle('POST','/sessions',{workspace:root,model:{providerID:'openai',id:'gpt-test',variant}});
  await assert.rejects(create('ultra'),{status:400});
  assert.equal(calls.filter(c=>c.route==='/api/session').length,0);
  await create('max');
  assert.deepEqual(calls.find(c=>c.route==='/api/session').body.model,{providerID:'openai',id:'gpt-test',variant:'max'});
});
