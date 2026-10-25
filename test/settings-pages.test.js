const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
function harness(storage=new Map(),mode='direct'){
 let cursor=0,tree;const slots=[],effects=[],requests=[],focus=[];
 const hooks={useId:()=>':settings:',useState(init){const i=cursor++;if(!slots[i])slots[i]={value:typeof init==='function'?init():init};return [slots[i].value,n=>{slots[i].value=typeof n==='function'?n(slots[i].value):n;}];},useEffect(fn,deps){const i=cursor++;if(!slots[i] || !deps || deps.some((v,j)=>!Object.is(v,slots[i].deps?.[j]))){slots[i]={deps};effects.push(fn);}}};
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({baseUrl:'https://api.example.com/v1',model:'actual-model',protocol:'responses',hasKey:false,configured:false,reasoningEnabled:false,reasoningEffort:''})};};
 const file=path.resolve(__dirname,'../codex-ui/src/components/ConnectionSettings.tsx');const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};new Function('require','module','exports','localStorage','fetch','document',code)(id=>{
  if(id==='react')return hooks;if(id.endsWith('.css'))return {};if(id==='./ControlIcon')return {ControlIcon:()=>null};if(id==='./ChatGPTAccount')return {ChatGPTAccount:()=>null};if(id==='./api-models')return {discoverModels:async()=>({models:[]})};if(id==='./model-vendors')return {modelVendor:()=> 'openai',modelVendors:[{id:'openai',name:'OpenAI'},{id:'deepseek',name:'DeepSeek'}]};return req(id);
 },m,m.exports,localStorage,fetch,{getElementById:id=>({focus:()=>focus.push(id)})});
 function walk(n,fn){if(Array.isArray(n))return n.forEach(v=>walk(v,fn));if(!n?.props)return;fn(n);walk(n.props.children,fn);}
 function nodes(predicate){const out=[];walk(tree,n=>{if(predicate(n))out.push(n);});return out;}
 const props={appearanceSettings:'FIVE_THEMES',displayRate:{rate:null,commit(){},error:''},mode,onMode(){},onBack(){},onSaved(){},busy:false,account:{connected:true,models:[{id:'native-model',name:'Native'}]},nativeModel:'native-model',onNativeModel(){},workspace:'G:/p/fixture',workspaceLocked:false,onWorkspace(){}};
 return {props,render(){cursor=0;tree=m.exports.ConnectionSettings(props);effects.splice(0).forEach(fn=>fn());},nodes,requests,focus,storage,
 tab(label){return nodes(n=>n.props.role==='tab'&&n.props.children===label)[0];},
 visible(){return nodes(n=>n.props.role==='tabpanel'&&!n.props.hidden);},
 input(name){return nodes(n=>n.type==='input'&&(n.props['aria-label']===name||n.props.type===name))[0];}};
}
test('six settings pages show one panel at a time and preserve unsaved API fields without saving',async()=>{
 const h=harness();h.render();await new Promise(r=>setImmediate(r));h.render();
 assert.equal(h.nodes(n=>n.props.role==='tab').length,6);assert.equal(h.visible().length,1);
 h.tab('API 连接').props.onClick();h.render();
 h.input('url').props.onChange({target:{value:'https://edited.example.com/v1'}});h.render();h.input('password').props.onChange({target:{value:'fixture-only'}});h.render();
 h.tab('可用模型').props.onClick();h.render();h.input('API 模型 ID').props.onChange({target:{value:'edited-model'}});h.render();
 for(const label of ['显示与性能','项目设置','外观主题','模型设置','API 连接']){h.tab(label).props.onClick();h.render();assert.equal(h.visible().length,1);}
 assert.equal(h.input('url').props.value,'https://edited.example.com/v1');assert.equal(h.input('password').props.value,'fixture-only');assert.equal(h.input('API 模型 ID').props.value,'edited-model');
 assert.deepEqual(h.requests.map(r=>r.url),['/api/connection/status']);
});
test('settings remember the last page and keyboard navigation moves selection and focus',()=>{
 const store=new Map(),h=harness(store);h.render();h.tab('外观主题').props.onClick();h.render();
 const reopened=harness(store);reopened.render();assert.equal(reopened.tab('外观主题').props['aria-selected'],true);
 let prevented=false;reopened.tab('外观主题').props.onKeyDown({key:'ArrowRight',preventDefault(){prevented=true;}});reopened.render();assert.equal(prevented,true);assert.equal(reopened.tab('模型设置').props['aria-selected'],true);assert.ok(reopened.focus[0].endsWith('-model'));
 reopened.tab('模型设置').props.onKeyDown({key:'End',preventDefault(){}});reopened.render();assert.equal(reopened.tab('外观主题').props['aria-selected'],true);
 const corrupt=harness(new Map([['strip_settings_page_v1','bad']]));corrupt.render();assert.equal(corrupt.tab('模型设置').props['aria-selected'],true);
 const blocked=harness({get(){throw Error('blocked');},set(){throw Error('blocked');}});blocked.render();blocked.tab('项目设置').props.onClick();blocked.render();assert.equal(blocked.tab('项目设置').props['aria-selected'],true);
});
test('native and CC Switch settings retain separate connection and model pages',()=>{
 for(const mode of ['opencode','ccswitch']){const h=harness(new Map(),mode);h.render();h.tab('API 连接').props.onClick();h.render();assert.equal(h.visible().length,1);h.tab('可用模型').props.onClick();h.render();assert.equal(h.visible().length,1);assert.equal(h.nodes(n=>n.props.role==='tab').length,6);}
});

test('project shortcuts open project settings without clearing API drafts or forcing the tab on later renders',async()=>{
 const h=harness();h.render();await new Promise(r=>setImmediate(r));h.render();
 h.tab('API 连接').props.onClick();h.render();h.input('password').props.onChange({target:{value:'fixture-draft'}});h.render();
 h.props.pageRequest={page:'project'};h.render();h.render();assert.equal(h.tab('项目设置').props['aria-selected'],true);
 h.tab('API 连接').props.onClick();h.render();assert.equal(h.input('password').props.value,'fixture-draft');
 assert.equal(h.tab('API 连接').props['aria-selected'],true);
 assert.deepEqual(h.requests.map(r=>r.url),['/api/connection/status']);
});
