const {test}=require('node:test'),assert=require('node:assert/strict');
test('pacer exposes completion, flushes explicitly and catches large backlogs at a bounded rate',async()=>{
 const {DisplayPacer}=await import('../codex-ui/src/state/display-pacer.mjs');
 const p=new DisplayPacer('中'.repeat(1000),10,true);assert.equal(p.done,false);
 assert.equal(p.tick(.1).length,4);assert.equal(p.finish().length,1000);assert.equal(p.done,true);
});

test('clipboard falls back after permission denial and always removes the temporary field',async()=>{
 const {copyToClipboard}=await import('../codex-ui/src/components/MessageThread/copy-text.mjs');
 let removed=0,focused=0,copied='';
 const area={style:{},setAttribute(){},select(){copied=this.value;},remove(){removed++;}};
 const environment={navigator:{clipboard:{writeText:async()=>{throw Error('denied');}}},document:{activeElement:{focus(){focused++;}},body:{append(){}},createElement:()=>area,execCommand:()=>true}};
 await copyToClipboard('中文🙂\ncode',environment);assert.equal(copied,'中文🙂\ncode');assert.equal(removed,1);assert.equal(focused,1);
 environment.document.execCommand=()=>false;await assert.rejects(copyToClipboard('failed',environment));assert.equal(removed,2);
});

test('animation scheduling stops when done or unlimited, and drains after the upstream finishes',async()=>{
 const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
 const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
 const {DisplayPacer}=await import('../codex-ui/src/state/display-pacer.mjs');
 let cursor=0,now=0,nextId=0;const slots=[],effects=[],frames=new Map();
 const hooks={useRef(init){const i=cursor++;return slots[i]??={current:init};},useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,v=>slots[i].value=typeof v==='function'?v(slots[i].value):v];},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j]))){slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
 const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../codex-ui/src/components/PacedMessage.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,m={exports:{}};
 new Function('require','module','exports','performance','requestAnimationFrame','cancelAnimationFrame',code)(id=>id==='react'?hooks:id.endsWith('.mjs')?{DisplayPacer,createFenceTracker:()=>({stabilize:value=>value,reset(){}})}:req(id),m,m.exports,{now:()=>now},fn=>{frames.set(++nextId,fn);return nextId;},id=>frames.delete(id));
 let visible='';const props={text:'中文测试',rate:10,animate:true,children:text=>{visible=text;return null;}};
 function render(){cursor=0;const tree=m.exports.PacedMessage(props);tree.props.children;effects.splice(0).forEach(fn=>fn());}
 function frame(){now+=50;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));render();}
 render();frame();props.animate=false;render();assert.notEqual(visible,props.text);
 for(let i=0;i<20;i++)frame();assert.equal(visible,props.text);assert.equal(frames.size,0);
 props.text+='后续';render();assert.equal(frames.size,1);props.rate=null;render();render();assert.equal(frames.size,0);assert.equal(visible,props.text);
});
test('explicit stop with drain=false freezes at all received text',async()=>{
 const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
 const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
 const {DisplayPacer}=await import('../codex-ui/src/state/display-pacer.mjs');
 let cursor=0,now=0,nextId=0;const slots=[],effects=[],frames=new Map();
 const hooks={useRef(init){const i=cursor++;return slots[i]??={current:init};},useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,v=>slots[i].value=typeof v==='function'?v(slots[i].value):v];},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j]))){slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
 const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../codex-ui/src/components/PacedMessage.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,m={exports:{}};
 new Function('require','module','exports','performance','requestAnimationFrame','cancelAnimationFrame',code)(id=>id==='react'?hooks:id.endsWith('.mjs')?{DisplayPacer,createFenceTracker:()=>({stabilize:value=>value,reset(){}})}:req(id),m,m.exports,{now:()=>now},fn=>{frames.set(++nextId,fn);return nextId;},id=>frames.delete(id));
 let visible='';const props={text:'停止后不应继续补完',rate:4,animate:true,drain:true,children:text=>{visible=text;return null;}};
 function render(){cursor=0;const tree=m.exports.PacedMessage(props);tree.props.children;effects.splice(0).forEach(fn=>fn());}
 function frame(){now+=50;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));render();}
 render();frame();assert.notEqual(visible,props.text);
 props.animate=false;props.drain=false;render();render();
 assert.equal(visible,props.text);assert.equal(frames.size,0);
});