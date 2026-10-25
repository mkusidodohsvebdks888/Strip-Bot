'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function harness({saved={},reject=false,deferConnect=false,ccHealthy=true,accountConnected=true}={}){
 const helpers=await import(pathToFileURL(path.resolve(__dirname,'../codex-ui/src/components/api-key-provider.mjs')).href);
 let cursor=0,tree,entered=0;const slots=[],effects=[],calls=[],stored=new Map(),themes=[];
 const hooks={useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,n=>slots[i].value=typeof n==='function'?n(slots[i].value):n];},useRef(init){const i=cursor++;return slots[i]??={current:init};},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||!deps.every((v,j)=>Object.is(v,old.deps[j]))){slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
 const intervals=[];let loggedIn=accountConnected;const mockWindow={matchMedia:()=>({matches:true}),setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){},setTimeout:()=>1,clearTimeout(){}};
 let releaseConnect;const waitingConnect=new Promise(resolve=>{releaseConnect=resolve;});
 const fetch=async(url,init)=>{calls.push({url,body:init?.body?JSON.parse(init.body):null});if(url==='/api/cc-switch/status')return {ok:true,json:async()=>({healthy:ccHealthy,codex:{model:ccHealthy?'test-model':''}})};if(url==='/api/connection/account/status')return {ok:true,json:async()=>({connected:loggedIn})};if(url==='/api/connection/account/login')return {ok:true,json:async()=>({url:'https://auth.example/authorize'})};if(url==='/api/connection/account/cancel')return {ok:true,json:async()=>({})};if(url==='/api/connection/status')return {ok:true,json:async()=>saved};if(url==='/api/connection/connect'){if(deferConnect)await waitingConnect;return {ok:!reject,json:async()=>reject?{error:'API 认证失败，请检查密钥。'}:{configured:true}};}throw Error('Unexpected network request');};
 const localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};
 function load(filename){const m={exports:{}},code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','fetch','localStorage','window',code)(id=>{
  if(id==='react')return hooks;if(id.endsWith('.css'))return {};
  if(id==='./api-key-provider.mjs')return helpers;
  if(id==='./api-models')return {discoverModels:async body=>{calls.push({url:'discoverModels',body});return {models:[{id:'test-chat'}]};}};
  if(id==='./entry-model-selection.mjs')return {pickEntryModel:models=>models[0]?.id||''};
  if(id==='../state/useAppearance')return {baseAppearance:v=>v};
  if(id==='./Brand/NonoBrand')return {NonoBrand:()=>null};
  if(id==='./api-presets')return load(path.resolve(path.dirname(filename),'api-presets.ts'));
  return req(id);
 },m,m.exports,fetch,localStorage,mockWindow);return m.exports;}
 const {ApiEntry}=load(path.resolve(__dirname,'../codex-ui/src/components/ApiEntry.tsx'));
 function walk(n,fn){if(Array.isArray(n))return n.forEach(v=>walk(v,fn));if(!n?.props)return;fn(n);walk(n.props.children,fn);}
 function nodes(fn){const list=[];walk(tree,n=>{if(fn(n))list.push(n);});return list;}
 function render(){cursor=0;tree=ApiEntry({appearance:themes.at(-1)||'warm',onThemeChange:value=>themes.push(value),onEntered:()=>entered++});walk(tree,n=>{if(n.ref&&typeof n.ref==='object')n.ref.current={focus(){}};});effects.splice(0).forEach(fn=>fn());}
 return {calls,stored,nodes,themes,releaseConnect,async finishAuth(){loggedIn=true;for(const poll of [...intervals])await poll();await flush();render();},entered:()=>entered,render,async ready(){render();await flush();render();},change(id,value){const n=nodes(n=>n.props.id===id)[0];assert.ok(n);n.props.onChange({target:{value}});render();},async click(label){const n=nodes(n=>n.type==='button'&&n.props['aria-label']===label)[0];assert.ok(n);assert.ok(!n.props.disabled);n.props.onClick();await flush();render();},async submit(){nodes(n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});await flush();render();}};
}
test('key-first screen performs no provider requests until submit and blocks ambiguous keys',async()=>{
 const h=await harness();await h.ready();assert.equal(h.nodes(n=>n.props.id==='strip-entry-vendor').length,0);
 h.change('strip-entry-api-key','sk-genericExample');assert.equal(h.nodes(n=>n.props.id==='strip-entry-vendor').length,1);
 assert.deepEqual(h.calls.map(c=>c.url),['/api/connection/status']);await h.submit();assert.equal(h.calls.length,1);assert.equal(h.entered(),0);
});
test('recognized key uses one provider, verifies before entry, and never calls save/check',async()=>{
 const h=await harness();await h.ready();h.change('strip-entry-api-key','sk-proj-EXAMPLE123');assert.equal(h.nodes(n=>n.props.id==='strip-entry-vendor').length,0);await h.submit();
 assert.deepEqual(h.calls.map(c=>c.url),['/api/connection/status','discoverModels','/api/connection/connect']);
 for(const call of h.calls.slice(1))assert.equal(call.body.baseUrl,'https://api.openai.com/v1');
 assert.equal(h.entered(),1);assert.equal(h.stored.get('strip_connection_mode_v1'),'direct');assert.ok(!JSON.stringify([...h.stored]).includes('EXAMPLE123'));
});
test('manual provider routing stays explicit and a replacement key does not inherit the old destination',async()=>{
 const h=await harness();await h.ready();h.change('strip-entry-api-key','sk-genericExample');h.change('strip-entry-vendor','deepseek');await h.submit();assert.equal(h.calls[1].body.baseUrl,'https://api.deepseek.com');
 const next=await harness();await next.ready();next.change('strip-entry-api-key','sk-genericExample');next.change('strip-entry-vendor','deepseek');next.change('strip-entry-api-key','sk-anotherExample');await next.submit();assert.equal(next.calls.length,1);
});
test('failed validation does not enter, saved custom connection can be reused without copying its key to UI',async()=>{
 const bad=await harness({reject:true});await bad.ready();bad.change('strip-entry-api-key','gsk_EXAMPLE');await bad.submit();assert.equal(bad.entered(),0);assert.equal(bad.stored.size,0);
 const saved=await harness({saved:{baseUrl:'https://custom.example/v1',protocol:'openai',model:'my-model',hasKey:true}});await saved.ready();await saved.submit();assert.equal(saved.entered(),1);assert.equal(saved.calls[1].body.apiKey,undefined);assert.equal(saved.calls[2].body.apiKey,undefined);assert.equal(saved.calls[2].body.baseUrl,'https://custom.example/v1');
});

test('login motion reflects the real pending request and clears after failure without entering',async()=>{
 const h=await harness({deferConnect:true,reject:true});await h.ready();
 assert.equal(h.nodes(n=>n.type==='button'&&n.props.type==='submit')[0].props['aria-busy'],false);
 h.change('strip-entry-api-key','sk-proj-EXAMPLE123');await h.submit();
 const form=h.nodes(n=>n.type==='form')[0],button=h.nodes(n=>n.type==='button'&&n.props.type==='submit')[0];
 assert.equal(form.props['data-state'],'loading');assert.equal(button.props['aria-busy'],true);assert.equal(button.props.disabled,true);assert.equal(h.entered(),0);
 await h.submit();assert.equal(h.calls.filter(c=>c.url==='/api/connection/connect').length,1);
 h.releaseConnect();await flush();h.render();
 assert.equal(h.nodes(n=>n.type==='form')[0].props['data-state'],undefined);
 assert.equal(h.nodes(n=>n.type==='button'&&n.props.type==='submit')[0].props['aria-busy'],false);
 assert.equal(h.nodes(n=>n.props.id==='strip-entry-api-key')[0].props['aria-describedby'],'strip-entry-error');
 assert.equal(h.nodes(n=>n.props.id==='strip-entry-error'&&n.props.role==='alert').length,1);assert.equal(h.entered(),0);
});

test('theme button calls the shared preference setter and toggles back without any provider request',async()=>{
 const h=await harness();await h.ready();await h.click('切换主题');assert.deepEqual(h.themes,['dark']);await h.click('切换主题');assert.deepEqual(h.themes,['dark','warm']);assert.equal(h.calls.length,1);
});

test('merged entry exposes three real entry points without model lists or advanced settings',async()=>{
 const h=await harness();await h.ready();
 assert.equal(h.nodes(n=>n.type==='details').length,0);
 assert.equal(h.nodes(n=>n.props['aria-label']==='获取模型').length,0);
 assert.equal(h.nodes(n=>n.props['aria-label']==='CC Switch 连接并进入').length,1);
 assert.equal(h.nodes(n=>n.props['aria-label']==='ChatGPT 授权连接并进入').length,1);
 assert.deepEqual(h.calls.map(c=>c.url),['/api/connection/status']);
});
test('CC Switch enters only when a local route and model are present',async()=>{
 const h=await harness();await h.ready();await h.click('CC Switch 连接并进入');assert.equal(h.entered(),1);assert.equal(h.stored.get('strip_connection_mode_v1'),'ccswitch');
 const bad=await harness({ccHealthy:false});await bad.ready();await bad.click('CC Switch 连接并进入');assert.equal(bad.entered(),0);assert.equal(bad.stored.size,0);assert.equal(bad.nodes(n=>n.props.role==='alert').length,1);
});
test('ChatGPT reuses authorized account or waits for actual authorization before entering',async()=>{
 const h=await harness();await h.ready();await h.click('ChatGPT 授权连接并进入');assert.equal(h.entered(),1);assert.equal(h.stored.get('strip_connection_mode_v1'),'opencode');
 const pending=await harness({accountConnected:false});await pending.ready();await pending.click('ChatGPT 授权连接并进入');assert.equal(pending.entered(),0);assert.equal(pending.nodes(n=>n.type==='a')[0].props.href,'https://auth.example/authorize');await pending.finishAuth();assert.equal(pending.entered(),1);
});
test('pending authorization can be cancelled without entering or saving a connection mode',async()=>{
 const h=await harness({accountConnected:false});await h.ready();await h.click('ChatGPT 授权连接并进入');await h.click('取消授权');assert.equal(h.entered(),0);assert.equal(h.stored.size,0);assert.equal(h.nodes(n=>n.type==='a').length,0);assert.equal(h.calls.at(-1).url,'/api/connection/account/cancel');
});

