const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=()=>import('../codex-ui/src/components/ModelSwitcher/processing-speed.mjs');
const model=(id,route='opencode',configured=true)=>({id,routes:[{id:route,configured}]});
test('speed aliases require native catalog entries and configured routes',async()=>{
  const {speedChoices,processingMode}=await load();
  const entries=[model('gpt-x'),model('gpt-x-fast'),model('gpt-x-ultrafast','opencode',false)];
  assert.deepEqual(speedChoices(entries,'gpt-x-fast','opencode').map(x=>x?.id||null),['gpt-x','gpt-x-fast',null]);
  assert.equal(processingMode('gpt-x-ultrafast'),'ultrafast');
  assert.deepEqual(speedChoices([model('gpt-x')],'gpt-x','opencode').map(x=>x?.id||null),['gpt-x',null,null]);
});
test('proxy and API histories cannot advertise speed upgrades by suffix',async()=>{
  const {speedChoices}=await load();
  for(const route of ['ccswitch','direct']){
    const entries=[model('gpt-x',route),model('gpt-x-fast',route),model('gpt-x-ultrafast',route)];
    assert.deepEqual(speedChoices(entries,'gpt-x',route).map(x=>x?.id||null),['gpt-x',null,null]);
    assert.deepEqual(speedChoices(entries,'gpt-x-fast',route).map(x=>x?.id||null),[null,'gpt-x-fast',null]);
  }
});
