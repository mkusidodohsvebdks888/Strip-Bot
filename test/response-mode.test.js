const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=()=>import('../codex-ui/src/components/ModelSwitcher/response-mode.mjs');
const effortVariants=['low','medium','high','xhigh','max'].map(effort=>({id:'reason-'+effort,effort}));
const model=(id,route='opencode',variants=effortVariants,configured=true)=>({id,name:id,vendorId:'openai',routes:[{id:route,name:route,configured,status:'ok',variants}]});

test('single response slider chooses only real native fast aliases and supported reasoning',async()=>{
  const {responseOptions}=await load();
  const entries=[model('gpt-example'),model('gpt-example-fast'),model('gpt-example-ultrafast')];
  const options=responseOptions(entries,'opencode','gpt-example');
  assert.deepEqual(options.map(option=>option.model),['gpt-example-ultrafast','gpt-example-fast','gpt-example','gpt-example','gpt-example']);
  assert.deepEqual(options.map(option=>option.variant),['reason-low','reason-medium','reason-high','reason-xhigh','reason-max']);
  assert.deepEqual(options.map(option=>option.displayRate),[null,200,160,120,90]);
  assert(options.every(item=>item.supported && item.reasoningSupported));
});

test('never infers fast-model capabilities for API Key and CC Switch routes',async()=>{
  const {responseOptions}=await load();
  for(const route of ['direct','ccswitch']){
    const entries=[model('gpt-example',route,[]),model('gpt-example-fast',route,[])];
    const options=responseOptions(entries,route,'gpt-example');
    assert(options.every(item=>item.model==='gpt-example' && !item.reasoningSupported && item.displayOnly && item.speedMode==='standard'));
    assert(responseOptions(entries,route,'gpt-example-fast').every(item=>item.speedMode==='standard'));
    assert(options.every(item=>item.supported));
  }
});

test('undeclared reasoning levels are disabled, not promoted to Ultra',async()=>{
  const {responseOptions}=await load();
  const entries=[model('gpt-example','opencode',[{id:'my-low',effort:'low'},{id:'max',effort:'max'}])];
  const options=responseOptions(entries,'opencode','gpt-example');
  assert.deepEqual(options.map(item=>item.supported),[true,false,false,false,true]);
  assert.equal(options[4].variant,'max');
});

test('a fast alias without reasoning variants is bypassed for actual reasoning support',async()=>{
  const {responseOptions}=await load();
  const entries=[model('gpt-example'),model('gpt-example-fast','opencode',[])];
  const options=responseOptions(entries,'opencode','gpt-example');
  assert.equal(options[1].model,'gpt-example');
  assert.equal(options[1].variant,'reason-medium');
});

test('disconnected models cannot be selected and previously saved effort migrates',async()=>{
  const {responseOptions,activePresetIndex}=await load();
  assert(responseOptions([model('gpt-example','opencode',effortVariants,false)],'opencode','gpt-example').every(item=>!item.supported));
  assert.equal(activePresetIndex('deep','',effortVariants),3);
  assert.equal(activePresetIndex('','reason-max',effortVariants),4);
  assert.equal(activePresetIndex('bad','',[]),2);
});
test('direct API presets preserve the model and use declared reasoning variants',async()=>{
  const {responseOptions}=await load();
  const options=responseOptions([model('gpt-example','direct')],'direct','gpt-example');
  assert(options.every(option=>option.supported && option.model==='gpt-example' && option.speedMode==='standard'));
  assert.deepEqual(options.map(option=>option.variant),effortVariants.map(variant=>variant.id));
});
