const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
function setup(){
 let cursor=0,current,resolve,requests=0,confirmed=true;const slots=[],effects=[],errors=[];
 const hooks={useCallback(fn){return fn;},useMemo(fn){return fn();},useSyncExternalStore(_subscribe,getSnapshot){return getSnapshot();},useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,n=>slots[i].value=typeof n==='function'?n(slots[i].value):n];},useRef(init){return slots[cursor++]??={current:init};},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j])){slots[i]={deps};effects.push(fn);}}};
 const file=path.resolve(__dirname,'../codex-ui/src/state/useManualCommands.ts'),source=fs.readFileSync(file,'utf8'),m={exports:{}};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','window','fetch','crypto',code)(id=>id==='react'?hooks:id.endsWith('.mjs')?require(path.resolve(path.dirname(file),id)):req(id),m,m.exports,{confirm:()=>confirmed},()=>{requests++;return new Promise(r=>resolve=r);},require('node:crypto'));
 const props={session:'ses_A',snapshot:{workspace:'G:/fixture',running:false,manualRunning:false,permissions:[],forms:[]},blocked:false,onError:e=>errors.push(e)};
 const render=()=>{cursor=0;current=m.exports.useManualCommands(props);effects.splice(0).forEach(fn=>fn());return current;};
 return {props,errors,render,get requests(){return requests;},confirm(value){confirmed=value;},finish(ok=true){resolve({ok,json:async()=>ok?{command:'echo test',stdout:'test',stderr:'',exitCode:0,cwd:'G:/fixture',durationMs:1,timedOut:false,truncated:false}:{error:'fixture failure'}});}};
}
test('manual commands require confirmation and reject invalid or busy sessions',async()=>{
 const h=setup();h.confirm(false);assert.equal(await h.render().run('echo test'),false);assert.equal(h.requests,0);
 h.confirm(true);h.props.blocked=true;assert.equal(await h.render().run('echo test'),false);
 h.props.blocked=false;h.props.snapshot.permissions=[{}];assert.equal(await h.render().run('echo test'),false);assert.equal(h.errors.length,1);
 h.props.snapshot.permissions=[];h.props.session='invalid';assert.equal(await h.render().run('echo test'),false);assert.equal(h.requests,0);
});
test('pending state blocks duplicate submission and completion stays with originating session',async()=>{
 const h=setup(),a=h.render(),pending=a.run('echo test');assert.equal(await a.run('echo test'),false);assert.equal(h.requests,1);
 assert.equal(h.render().results[0].status,'running');h.props.session='ses_B';h.render();let b=h.render();b.toggle();b=h.render();assert.equal(b.open,true);assert.equal(b.results.length,0);
 h.finish();assert.equal(await pending,true);b=h.render();assert.equal(b.open,true);assert.equal(b.results.length,0);assert.equal(b.anyRunning,false);
 h.props.session='ses_A';const done=h.render();assert.equal(done.results.length,1);assert.equal(done.results[0].stdout,'test');assert.equal(done.results[0].status,'done');
});
test('failed command retains popup and failure record while releasing execution lock',async()=>{
 const h=setup();h.render().toggle();const pending=h.render().run('echo test');h.finish(false);assert.equal(await pending,false);
 const done=h.render();assert.equal(done.open,true);assert.equal(done.anyRunning,false);assert.equal(done.results[0].error,'fixture failure');assert.deepEqual(h.errors,['fixture failure']);
});
