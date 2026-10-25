'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../codex-ui/node_modules/typescript');
function harness(saved=null,small=false,blocked=false){
 let cursor=0,stored=saved,focusInside=false,focused=0;
 const slots=[],pending=[],listeners=new Set(),mediaListeners=new Set();
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={
  useState(init){const i=cursor++;if(!slots[i])slots[i]={value:typeof init==='function'?init():init};return [slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];},
  useCallback(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={value:fn,deps};return slots[i].value;},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};pending.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
 };
 const media={matches:small,addEventListener:(t,fn)=>mediaListeners.add(fn),removeEventListener:(t,fn)=>mediaListeners.delete(fn)};
 const win={matchMedia:()=>media,addEventListener:(t,fn)=>listeners.add(fn),removeEventListener:(t,fn)=>listeners.delete(fn)};
 const doc={activeElement:{closest:()=>focusInside},querySelector:()=>({focus(){focused++;focusInside=false;}})};
 const storage={getItem(){if(blocked)throw Error('blocked');return stored;},setItem(k,v){if(blocked)throw Error('blocked');assert.equal(k,'strip_sidebar_expanded_v1');stored=v;}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../codex-ui/src/state/useSidebar.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};new Function('require','module','exports','localStorage','window','document',code)(()=>hooks,mod,mod.exports,storage,win,doc);
 return {
  render(){cursor=0;const result=mod.exports.useSidebar();pending.splice(0).forEach(fn=>fn());return result;},
  saved:()=>stored,resize(value){media.matches=value;[...mediaListeners].forEach(fn=>fn());},
  key(extra={}){const event={key:'b',ctrlKey:true,metaKey:false,repeat:false,isComposing:false,altKey:false,shiftKey:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};[...listeners].forEach(fn=>fn(event));return event;},
  focusPanel(){focusInside=true;},focused:()=>focused,
  dispose(){slots.forEach(slot=>slot?.cleanup?.());},listenerCount:()=>listeners.size+mediaListeners.size,
 };
}
test('sidebar collapse survives reload and reopens through the same state control',()=>{
 const h=harness();assert.equal(h.render().panelOpen,true);
 h.render().setPanelOpen(false);assert.equal(h.render().panelOpen,false);assert.equal(h.saved(),'false');
 assert.equal(harness(h.saved()).render().panelOpen,false);
 h.render().setPanelOpen(value=>!value);assert.equal(h.render().panelOpen,true);assert.equal(h.saved(),'true');
});
test('responsive drawer does not overwrite desktop collapse preference',()=>{
 const h=harness('false');assert.equal(h.render().panelOpen,false);h.resize(true);assert.equal(h.render().panelOpen,false);
 h.render().setPanelOpen(true);assert.equal(h.render().panelOpen,true);assert.equal(h.saved(),'false');
 h.render().setPanelOpen(false);h.render();h.resize(false);assert.equal(h.render().panelOpen,false);
 const open=harness('true');open.render();open.resize(true);assert.equal(open.render().panelOpen,false);open.resize(false);assert.equal(open.render().panelOpen,true);
});
test('Ctrl+B toggles once, ignores composition and other shortcuts, restores focus and cleans listeners',()=>{
 const h=harness(null,false,true);h.render();h.focusPanel();assert.equal(h.key().defaultPrevented,true);assert.equal(h.render().panelOpen,false);assert.equal(h.focused(),1);
 for(const extra of [{repeat:true},{isComposing:true},{altKey:true},{shiftKey:true},{defaultPrevented:true},{key:'x'}]){h.key(extra);assert.equal(h.render().panelOpen,false);}
 h.key({key:'B',ctrlKey:false,metaKey:true});assert.equal(h.render().panelOpen,true);
 assert.equal(h.listenerCount(),2);h.dispose();assert.equal(h.listenerCount(),0);
});
