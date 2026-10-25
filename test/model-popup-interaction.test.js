const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
function harness(){
 let cursor=0,tree;const slots=[],effects=[],listeners=new Map();
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={useState(init){const i=cursor++;if(!slots[i])slots[i]={value:typeof init==='function'?init():init};return [slots[i].value,n=>{slots[i].value=typeof n==='function'?n(slots[i].value):n;}];},useRef(init){const i=cursor++;return slots[i]??={current:init};},useEffect(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
 const target={addEventListener(t,fn){if(!listeners.has(t))listeners.set(t,new Set());listeners.get(t).add(fn);},removeEventListener(t,fn){listeners.get(t)?.delete(fn);}};
 const win={...target,localStorage:{getItem(){return null;}},dispatchEvent(){}};
 const model={id:'real-model',name:'Actual Model',vendorId:'openai',routes:[{id:'direct',configured:true,variants:[]}]};
 const cache=new Map();function load(file){if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports','window','document',code)(id=>{
   if(id==='react')return hooks;if(id.endsWith('.css'))return {};
   if(id==='./model-catalog')return {loadCatalog:async()=>({models:[model],api:{configured:true,model:model.id},errors:[]}),modelVendors:[{id:'openai',name:'OpenAI'}]};
   if(id==='../useAnchoredPopup')return {useAnchoredPopup:()=>({left:12,top:200,maxHeight:300,bottom:'auto'})};
   if(!id.startsWith('.'))return req(id);const base=path.resolve(path.dirname(file),id);return load(['','.tsx','.ts'].map(ext=>base+ext).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()));
  },m,m.exports,win,target);return m.exports;
 }
 const {ModelSwitcher}=load(path.resolve(__dirname,'../codex-ui/src/components/ModelSwitcher/ModelSwitcher.tsx'));
 function walk(n,fn){if(Array.isArray(n))return n.forEach(v=>walk(v,fn));if(!n?.props)return;fn(n);walk(n.props.children,fn);}
 function nodes(fn){const out=[];walk(tree,n=>{if(fn(n))out.push(n);});return out;}
 return {render(){cursor=0;tree=ModelSwitcher({effort:'',presetId:'balanced',mode:'direct',model:'real-model',busy:false,onApply(){},onResponseMode:async()=>{}});walk(tree,n=>{if(n.ref&&typeof n.ref==='object')n.ref.current={contains:target=>target?.inside===true,focus(){},querySelector:()=>({focus(){}}),querySelectorAll:()=>[]};});effects.splice(0).forEach(fn=>fn());},nodes,outside(){for(const fn of listeners.get('pointerdown')||[])fn({target:{}});},key(key){for(const fn of listeners.get('keydown')||[])fn({key,preventDefault(){}});},click(label){const n=nodes(n=>n.type==='button'&&n.props['aria-label']===label)[0];assert.ok(n);assert.ok(!n.props.disabled);n.props.onClick();}};
}
test('real model trigger opens model dialog, response trigger exposes the appearance picker',async()=>{
 const h=harness();h.render();h.click('切换模型');h.render();await new Promise(resolve=>setImmediate(resolve));h.render();
 assert.equal(h.nodes(n=>n.props.role==='dialog'&&n.props['aria-label']==='选择模型').length,1);
 assert.ok(h.nodes(n=>n.props.className==='smp-simple-model').length);
 assert.equal(h.nodes(n=>n.props['aria-label']==='关闭模型切换器').length,0);
 h.outside();h.render();assert.equal(h.nodes(n=>n.props.role==='dialog').length,0);
 h.click('切换模型');h.render();await new Promise(resolve=>setImmediate(resolve));h.render();
 h.key('Escape');h.render();assert.equal(h.nodes(n=>n.props.role==='dialog').length,0);
 h.click('切换模型');h.render();await new Promise(resolve=>setImmediate(resolve));h.render();
 assert.equal(h.nodes(n=>n.type==='input').length,0,'model popup has no search input');
 assert.equal(h.nodes(n=>n.type==='select').length,0,'model popup has no vendor dropdown');
 h.click('推理与响应模式');h.render();await new Promise(resolve=>setImmediate(resolve));h.render();
 assert.equal(h.nodes(n=>n.props.role==='dialog'&&n.props['aria-label']==='推理与响应模式').length,1);
 assert.equal(h.nodes(n=>typeof n.type==='function'&&n.type.name==='FiveStepSlider').length,1);
 assert.equal(h.nodes(n=>typeof n.type==='function'&&n.type.name==='SliderStylePicker').length,1);
 h.click('推理与响应模式');h.render();assert.equal(h.nodes(n=>n.props.role==='dialog').length,0);
});
