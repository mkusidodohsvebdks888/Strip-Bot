const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
function harness(){
 let cursor=0,tree;const slots=[],sent=[];
 const hooks={forwardRef:fn=>fn,useId:()=>':composer:',useEffect(){},useLayoutEffect(){},useImperativeHandle(){},useCallback(fn){return fn;},useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,next=>slots[i].value=typeof next==='function'?next(slots[i].value):next];},useRef(init){const i=cursor++;return slots[i]??={current:init};}};
 const file=path.resolve(__dirname,'../codex-ui/src/components/StripCodexComposer.tsx'),m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',code)(id=>id==='react'?hooks:id.endsWith('.mjs')?require(path.resolve(path.dirname(file),id)):id.startsWith('.')?{}:req(id),m,m.exports);
 const props={value:'输入内容',onSend:async value=>sent.push(value),toolsInSidebar:true,onValueChange(){}};
 function walk(n,fn){if(Array.isArray(n))return n.forEach(v=>walk(v,fn));if(!n?.props)return;fn(n);walk(n.props.children,fn);}
 const nodes=predicate=>{const out=[];walk(tree,n=>{if(predicate(n))out.push(n);});return out;};
 return {props,sent,nodes,render(){cursor=0;tree=m.exports.StripCodexComposer(props,null);},area(){return nodes(n=>n.type==='textarea')[0].props;}};
}
test('composer omits expand and optimize buttons while Enter sends and IME never submits',async()=>{
 const h=harness();h.render();assert.equal(h.area().maxLength,240000);
 assert.equal(h.nodes(n=>n.props['aria-label']==='展开长文本编辑器').length,0);
 assert.equal(h.nodes(n=>n.props['aria-label']==='优化指令').length,0);
 const key=(ctrl=false,compose=false,shift=false)=>({key:'Enter',ctrlKey:ctrl,metaKey:false,shiftKey:shift,nativeEvent:{isComposing:compose},keyCode:compose?229:13,preventDefault(){}});
 h.area().onKeyDown(key(false,true));assert.equal(h.sent.length,0);
 h.area().onKeyDown(key(false,false,true));assert.equal(h.sent.length,0);
 h.area().onKeyDown(key());await new Promise(resolve=>setImmediate(resolve));assert.equal(h.sent.length,1);
});
test('oversized attachments and more than twelve files are rejected without adding or sending',()=>{
 const h=harness();h.render();const file=(name,size=10)=>({name,size,lastModified:1});
 const choose=files=>h.nodes(n=>n.type==='input'&&n.props.type==='file')[0].props.onChange({target:{files,value:'fixture'}});
 choose([file('large.txt',512*1024+1)]);h.render();assert.equal(h.nodes(n=>n.props['aria-label']==='待发送的附件').length,0);
 choose(Array.from({length:13},(_,i)=>file(i+'.txt')));h.render();assert.equal(h.nodes(n=>n.props['aria-label']==='待发送的附件').length,0);
 choose([file('ok.txt')]);h.render();assert.equal(h.nodes(n=>n.props['aria-label']==='待发送的附件').length,1);assert.equal(h.sent.length,0);
});
test('composer keeps one fixed action slot, locks repeated stops and supports Escape',async()=>{
 const h=harness();let calls=0;let release;const pending=new Promise(resolve=>{release=resolve;});
 h.props.busy=true;h.props.onStop=()=>{calls++;return pending;};h.render();
 const slot=()=>h.nodes(n=>n.props.className==='strip-codex-composer__action-slot')[0];
 assert.equal(slot().props['data-state'],'stop');
 const send=h.nodes(n=>n.props['aria-label']==='发送')[0];assert.equal(send.props['aria-hidden'],true);
 const stop=h.nodes(n=>n.props['aria-label']==='停止生成')[0];assert.ok(stop);
 stop.props.onClick();stop.props.onClick();assert.equal(calls,1);
 h.render();assert.equal(slot().props['data-state'],'stopping');
 assert.equal(h.nodes(n=>n.props['aria-label']==='正在停止')[0].props.disabled,true);
 release();await new Promise(resolve=>setImmediate(resolve));

 const escHarness=harness();let escaped=0;escHarness.props.busy=true;escHarness.props.onStop=()=>{escaped++;};escHarness.render();
 escHarness.area().onKeyDown({key:'Escape',preventDefault(){},nativeEvent:{isComposing:false},ctrlKey:false,metaKey:false,shiftKey:false,keyCode:27});
 assert.equal(escaped,1);
});