const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=()=>import('../codex-ui/src/components/ModelSwitcher/slider-styles.mjs');

test('six slider appearances include energy while preserving the existing default',async()=>{
  const {sliderStyles,defaultSliderStyle,normalizeSliderStyle}=await load();
  assert.deepEqual(sliderStyles.map(style=>style.id),['dots','line','pill','segments','gradient','energy']);
  assert.equal(defaultSliderStyle,'dots');
  assert.equal(normalizeSliderStyle('gradient'),'gradient');
  assert.equal(normalizeSliderStyle('energy'),'energy');
  assert.equal(normalizeSliderStyle('unknown'),'dots');
});

test('appearance preference can persist and fails safely in private storage',async()=>{
  const {sliderStyleKey,readSliderStyle,saveSliderStyle}=await load();
  const values=new Map();
  const storage={getItem(key){return values.get(key)||null;},setItem(key,value){values.set(key,value);}};
  assert.equal(readSliderStyle(storage),'dots');
  assert.equal(saveSliderStyle('pill',storage),'pill');
  assert.equal(values.get(sliderStyleKey),'pill');
  assert.equal(readSliderStyle(storage),'pill');
  const broken={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
  assert.equal(readSliderStyle(broken),'dots');
  assert.equal(saveSliderStyle('line',broken),'line');
});

const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const requireUI=createRequire(path.resolve(__dirname,'../codex-ui/package.json'));
const ts=requireUI('typescript');
const sliderModule={exports:{}};
const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../codex-ui/src/components/ModelSwitcher/FiveStepSlider.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
new Function('require','module','exports',code)(id=>id==='./EnergySlider'?{EnergySlider:()=>null}:requireUI(id),sliderModule,sliderModule.exports);
const {FiveStepSlider}=sliderModule.exports;
function inputOf(props){return FiveStepSlider({visual:'dots',value:2,label:'Mode',valueText:'Balanced',...props}).props.children[1].props;}
test('slider previews, commits on release, and cancels without committing on blur',()=>{
 const changes=[],commits=[];let cancelled=0;
 const input=inputOf({onChange:v=>changes.push(v),onCommit:v=>commits.push(v),onCancel:()=>cancelled++});
 input.onChange({target:{value:'3'}});assert.deepEqual(changes,[3]);assert.deepEqual(commits,[]);
 input.onPointerUp({currentTarget:{value:'3'}});assert.deepEqual(commits,[3]);
 input.onPointerCancel();assert.equal(cancelled,1);assert.equal(input.onBlur,undefined);
});
test('slider supports keyboard commits and prevents Enter submitting the chat',()=>{
 const commits=[];let prevented=false;
 const input=inputOf({onChange(){},onCommit:v=>commits.push(v)});
 input.onKeyDown({key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,true);
 input.onKeyUp({key:'Enter',currentTarget:{value:'2'}});assert.deepEqual(commits,[]);
 input.onKeyUp({key:'End',currentTarget:{value:'4'}});assert.deepEqual(commits,[4]);
 const ref={current:null};assert.equal(inputOf({disabled:true,inputRef:ref,onChange(){}}).disabled,true);
 assert.equal(FiveStepSlider({visual:'dots',value:2,label:'Mode',valueText:'Balanced',inputRef:ref,onChange(){}}).props.children[1].ref,ref);
});

test('animated ticks track fill and carry ordered stagger indices while retaining capability state',()=>{
 const rail=FiveStepSlider({visual:'dots',value:2,label:'Mode',valueText:'Balanced',supported:[true,false,true,true,true],onChange(){}}).props.children[0];
 const ticks=rail.props.children[1];
 assert.deepEqual(ticks.map(t=>t.props.style['--i']),[0,1,2,3,4]);
 assert.deepEqual(ticks.map(t=>t.props.className.includes('is-filled')),[true,true,true,false,false]);
 assert.ok(ticks[1].props.className.includes('is-unsupported'));
 assert.ok(ticks[2].props.className.includes('is-current'));
});
