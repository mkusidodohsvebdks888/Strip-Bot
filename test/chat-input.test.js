'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json'));
const ts=req('typescript');
function harness(props={}){
  let cursor=0,tree;const slots=[];const sent=[];
  const hooks={useEffect(){},useLayoutEffect(){},useRef(init){const i=cursor++;return slots[i]??={current:init};},useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,next=>slots[i].value=typeof next==='function'?next(slots[i].value):next];}};
  const file=path.resolve(__dirname,'../codex-ui/src/components/ChatInput.tsx');const m={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',code)(id=>id==='react'?hooks:id.endsWith('.css')?{}:id==='../Icons'?{Icon:()=>null}:req(id),m,m.exports);
  const allProps={onSend:text=>sent.push(text),...props};
  function walk(node,fn){if(Array.isArray(node))return node.forEach(value=>walk(value,fn));if(!node?.props)return;fn(node);walk(node.props.children,fn);}
  const nodes=predicate=>{const out=[];walk(tree,node=>{if(predicate(node))out.push(node);});return out;};
  return {sent,nodes,render(){cursor=0;tree=m.exports.ChatInput(allProps);return tree;},area(){return nodes(node=>node.type==='textarea')[0].props;}};
}
test('ChatInput sends on Enter, preserves Shift+Enter and ignores IME composition',()=>{
  const h=harness();h.render();
  h.area().onChange({target:{value:'你好'}});h.render();
  const key=(shift=false,compose=false)=>({key:'Enter',shiftKey:shift,nativeEvent:{isComposing:compose},preventDefault(){}});
  h.area().onCompositionStart();h.area().onKeyDown(key(false,true));assert.deepEqual(h.sent,[]);
  h.area().onCompositionEnd();h.area().onKeyDown(key(true));assert.deepEqual(h.sent,[]);
  h.area().onKeyDown(key());assert.deepEqual(h.sent,['你好']);
});
test('ChatInput shares one action slot and stops on click or Escape',async()=>{
  let stopped=0;let release;const pending=new Promise(resolve=>{release=resolve;});
  const h=harness({busy:true,onStop:()=>{stopped++;return pending;}});h.render();
  const send=h.nodes(node=>node.props['aria-label']==='发送')[0];assert.equal(send.props['aria-hidden'],true);
  const stop=h.nodes(node=>node.props['aria-label']==='停止生成')[0];assert.ok(stop);
  stop.props.onClick();stop.props.onClick();assert.equal(stopped,1);
  h.render();assert.equal(h.nodes(node=>node.props['aria-label']==='正在停止')[0].props.disabled,true);
  release();await new Promise(resolve=>setImmediate(resolve));

  let escaped=0;const e=harness({busy:true,onStop:()=>escaped++});e.render();
  e.area().onKeyDown({key:'Escape',shiftKey:false,nativeEvent:{isComposing:false},preventDefault(){}});
  assert.equal(escaped,1);
});