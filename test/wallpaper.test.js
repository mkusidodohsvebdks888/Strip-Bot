'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../codex-ui/node_modules/typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(shared={prefs:null,record:null},options={}){
 let cursor=0,counter=0;const slots=[],effects=[],revoked=[],cleanups=[];
 const hooks={useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];},useRef(init){const i=cursor++;return slots[i]??={current:init};},useEffect(fn,deps){const i=cursor++;const prior=slots[i];if(!prior||!deps.every((v,j)=>Object.is(v,prior.deps[j]))){slots[i]={deps};effects.push(()=>{prior?.cleanup?.();const cleanup=fn();slots[i].cleanup=cleanup;if(cleanup)cleanups.push(cleanup);});}}};
 const idb={open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(store,mode){const transaction={objectStore(){return {get(){const request={};queueMicrotask(()=>{request.result=shared.record;request.onsuccess();});return request;},put(record){queueMicrotask(()=>{if(options.failWrite){transaction.error=Error('disk full');transaction.onerror();}else{shared.record=record;transaction.oncomplete();}});},delete(){queueMicrotask(()=>{shared.record=null;transaction.oncomplete();});}};}};return transaction;}};request.onsuccess();});return request;}};
 const storage={getItem(){if(options.blockPrefs)throw Error('blocked');return shared.prefs;},setItem(key,value){if(options.blockPrefs)throw Error('blocked');shared.prefs=value;}};
 class Image {naturalWidth=600;naturalHeight=400;set src(value){queueMicrotask(()=>options.badImage?this.onerror():this.onload());}}
 const url={createObjectURL(){return 'blob:test-'+(++counter);},revokeObjectURL(value){revoked.push(value);}};
 const file=path.join(__dirname,'../codex-ui/src/state/useWallpaper.ts'),code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,m={exports:{}};
 new Function('require','module','exports','window','localStorage','indexedDB','URL','Image',code)(()=>hooks,m,m.exports,{indexedDB:idb},storage,idb,url,Image);
 return {shared,revoked,render(){cursor=0;const w=m.exports.useWallpaper();effects.splice(0).forEach(fn=>fn());return w;},unmount(){cleanups.forEach(fn=>fn());}};
}
const file={type:'image/png',size:100,name:'背景.png'};
test('wallpaper saves locally, restores settings and image, disables, resumes and deletes',async()=>{
 const h=harness();h.render();await flush();assert.equal(h.render().wallpaperLoading,false);
 await h.render().uploadWallpaper(file);let w=h.render();assert.equal(w.wallpaperEnabled,true);assert.equal(w.wallpaper.name,file.name);
 w.setFit('cover');w.setOpacity(70);w.setSoftness(25);h.render();
 const reopened=harness(h.shared);reopened.render();await flush();w=reopened.render();assert.equal(w.wallpaper.name,file.name);assert.equal(w.wallpaperEnabled,true);assert.equal(w.fit,'cover');assert.equal(w.opacity,70);assert.equal(w.softness,25);
 w.disableWallpaper();assert.equal(reopened.render().wallpaperEnabled,false);reopened.render().enableWallpaper();assert.equal(reopened.render().wallpaperEnabled,true);
 await reopened.render().removeWallpaper();w=reopened.render();assert.equal(w.wallpaper,null);assert.equal(w.wallpaperEnabled,false);assert.equal(h.shared.record,null);assert.ok(reopened.revoked.length);
 h.unmount();assert.ok(h.revoked.includes('blob:test-2'));
});
test('invalid images and failed persistence preserve the current wallpaper',async()=>{
 const h=harness();h.render();await flush();await h.render().uploadWallpaper(file);const before=h.render().wallpaper;
 for(const invalid of [{...file,type:'image/svg+xml'},{...file,size:31*1024*1024},{...file,size:0}]){await h.render().uploadWallpaper(invalid);assert.equal(h.render().wallpaper,before);assert.ok(h.render().error);}
 for(const option of ['badImage','failWrite']){const broken=harness({}, {[option]:true});broken.render();await flush();await broken.render().uploadWallpaper(file);assert.equal(broken.render().wallpaper,null);assert.ok(broken.render().error);assert.equal(broken.render().busy,false);}
});
test('numeric settings clamp corrupt preferences and tolerate blocked localStorage',async()=>{
 const h=harness({prefs:JSON.stringify({opacity:200,softness:-5,fit:'invalid'}),record:null});h.render();await flush();assert.equal(h.render().opacity,100);assert.equal(h.render().softness,0);assert.equal(h.render().fit,'contain');
 h.render().setOpacity(NaN);assert.equal(h.render().opacity,95);
 const blocked=harness({}, {blockPrefs:true});blocked.render();await flush();await blocked.render().uploadWallpaper(file);assert.equal(blocked.render().wallpaperEnabled,true);
});
