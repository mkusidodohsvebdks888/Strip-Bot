const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const requireUI=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=requireUI('typescript');
function harness(entries,busy=false){
 let cursor=0,tree;const slots=[],pending=[],listeners=new Map(),selected=[],focused=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={useId:()=>':search:',useState(init){const i=cursor++;if(!slots[i])slots[i]={value:typeof init==='function'?init():init};return [slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];},useRef(init){const i=cursor++;return (slots[i]??={current:init});},useCallback(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={value:fn,deps};return slots[i].value;},useEffect(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};pending.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
 const listen={addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);}};
 const document={...listen,documentElement:{dataset:{stripDesktop:'true'}}};
 const window={innerWidth:1000,innerHeight:700,...listen};
 class FakeNode{}
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../codex-ui/src/components/Sidebar/SearchPopup.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};new Function('require','module','exports','window','document','Node',code)(id=>id==='react'?hooks:id.endsWith('.css')?{default:new Proxy({},{get:(o,k)=>k})}:id==='../../Icons'?{Icon:()=>null}:requireUI(id),mod,mod.exports,window,document,FakeNode);
 function walk(node,fn){if(Array.isArray(node)){node.forEach(item=>walk(item,fn));return;}if(!node||typeof node!=='object'||!node.props)return;fn(node);walk(node.props.children,fn);}
 function nodes(predicate){const out=[];walk(tree,node=>{if(predicate(node))out.push(node);});return out;}
 function key(key,extra={}){return {key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,repeat:false,isComposing:false,nativeEvent:{isComposing:false},preventDefault(){this.defaultPrevented=true;},...extra};}
 return {
  render(){cursor=0;tree=mod.exports.SearchPopup({entries,active:'1',busy,onSelect:id=>selected.push(id)});walk(tree,node=>{if(node.ref&&typeof node.ref==='object'){const fake=new FakeNode();Object.assign(fake,{focus:()=>focused.push(node.type),getBoundingClientRect:()=>({left:10,bottom:130}),contains:target=>target===fake,querySelector:()=>({scrollIntoView(){}})});node.ref.current=fake;}});pending.splice(0).forEach(fn=>fn());return tree;},
  nodes,selected,focused,
  trigger(){nodes(n=>n.type==='button'&&n.props['aria-haspopup']==='dialog')[0].props.onClick();},
  query(value){nodes(n=>n.type==='input')[0].props.onChange({target:{value}});},
  inputKey(value,extra){nodes(n=>n.type==='input')[0].props.onKeyDown(key(value,extra));},
  shortcut(value,extra){const event=key(value,extra);[...(listeners.get('keydown')||[])].forEach(fn=>fn(event));return event;},
  outside(){[...(listeners.get('pointerdown')||[])].forEach(fn=>fn({target:new FakeNode()}));},
  dispose(){slots.forEach(slot=>slot?.cleanup?.());},listenerCount:()=>[...listeners.values()].reduce((n,set)=>n+set.size,0),
 };
}
const entries=[{id:'1',title:'API Settings',description:'连接配置',updatedAt:1},{id:'2',title:'修改输入框',description:'编程',updatedAt:2},{id:'3',title:'模型选择',description:'API channel',updatedAt:3}];
test('search popup filters live titles and descriptions, arrow navigation selects the real session ID',()=>{
 const h=harness(entries);h.render();h.trigger();h.render();assert.ok(h.focused.includes('input'));
 h.query(' API ');h.render();assert.equal(h.nodes(n=>n.props.role==='option').length,2);
 h.inputKey('ArrowDown');h.render();h.inputKey('Enter');h.render();assert.deepEqual(h.selected,['3']);assert.equal(h.nodes(n=>n.props.role==='dialog').length,0);
 h.trigger();h.render();h.query('not found');h.render();assert.equal(h.nodes(n=>n.props.role==='option').length,0);
});
test('Ctrl+K opens, Escape returns focus, outside click closes and listeners are removed',()=>{
 const h=harness(entries);h.render();assert.equal(h.shortcut('k',{ctrlKey:true}).defaultPrevented,true);h.render();assert.equal(h.nodes(n=>n.props.role==='dialog').length,1);
 h.shortcut('Escape');h.render();assert.equal(h.nodes(n=>n.props.role==='dialog').length,0);assert.equal(h.focused.at(-1),'button');
 h.shortcut('k',{metaKey:true});h.render();h.outside();h.render();assert.equal(h.nodes(n=>n.props.role==='dialog').length,0);
 h.shortcut('k',{ctrlKey:true,isComposing:true});h.render();assert.equal(h.nodes(n=>n.props.role==='dialog').length,0);
 h.dispose();assert.equal(h.listenerCount(),0);
});
test('busy sessions cannot be selected; IME Enter never selects a result',()=>{
 const h=harness(entries,true);h.render();h.trigger();h.render();h.inputKey('Enter');assert.deepEqual(h.selected,[]);h.nodes(n=>n.props.role==='option')[0].props.onClick();assert.deepEqual(h.selected,[]);
 const ready=harness(entries);ready.render();ready.trigger();ready.render();ready.inputKey('Enter',{nativeEvent:{isComposing:true}});assert.deepEqual(ready.selected,[]);
});
