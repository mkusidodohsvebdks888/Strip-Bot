const {test}=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../codex-ui/src/components/ModelSwitcher/model-families.mjs');
const m=(id,route='opencode',configured=true)=>({id,name:id,vendorId:'openai',routes:[{id:route,configured}]});
test('model families hide variants without manufacturing missing base models',async()=>{
  const {modelFamilies,familyID,familyName}=await load();
  const groups=modelFamilies([m('gpt-one-fast'),m('gpt-one'),m('gpt-one-ultrafast'),m('gpt-two-fast')]);
  assert.equal(groups.length,2);assert.equal(groups[0].models.length,3);
  assert.equal(groups[1].id,'gpt-two');assert.equal(groups[1].models[0].id,'gpt-two-fast');
  assert.equal(familyID('gpt-one-ultrafast'),'gpt-one');assert.equal(familyName('GPT One Fast'),'GPT One');
  assert.equal(familyID('deepseek-v4-flash'),'deepseek-v4-flash');
});
test('family selection preserves tier and route where configured, otherwise chooses a real fallback',async()=>{
  const {modelFamilies,familyChoice}=await load();
  const family=modelFamilies([m('gpt-one'),m('gpt-one-fast'),m('gpt-one-ultrafast','opencode',false)])[0];
  assert.equal(familyChoice(family,'opencode','gpt-other-fast').id,'gpt-one-fast');
  assert.equal(familyChoice(family,'opencode','gpt-other-ultrafast').id,'gpt-one');
  assert.equal(familyChoice(modelFamilies([m('gpt-one-fast','direct')])[0],'direct','gpt-other').id,'gpt-one-fast');
  assert.equal(familyChoice(modelFamilies([m('gpt-one','direct',false)])[0],'direct','gpt-other'),null);
});
