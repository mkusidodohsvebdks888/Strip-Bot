const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),req=createRequire(path.join(root,'codex-ui/package.json')),ts=req('typescript');
function harness(initial={serial:0,active:false}){
 let cursor=0,tree,serial=0;const slots=[],effects=[],timers=new Map();
 const hooks={useRef(init){const i=cursor++;return slots[i]??={current:init};},useState(init){const i=cursor++;slots[i]??={value:init};return [slots[i].value,v=>slots[i].value=typeof v==='function'?v(slots[i].value):v];},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old || deps.some((v,j)=>!Object.is(v,old.deps[j]))){slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
 const m={exports:{}},filename=path.join(root,'codex-ui/src/components/Brand/NonoWelcome.tsx');
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const mockWindow={setTimeout(fn){timers.set(++serial,fn);return serial;},clearTimeout(id){timers.delete(id);}};
 const rig=JSON.parse(fs.readFileSync(path.join(root,'codex-ui/src/components/Brand/nono/rig.json'),'utf8'));
 new Function('require','module','exports','window',code)(id=>id==='react'?hooks:id.endsWith('.css')?{}:id==='./nono-layers'?{nonoLayers:rig.order.map(id=>({id,src:id+'.png',left:0,top:0,width:100,height:100,origin:'50% 50%'}))}:req(id),m,m.exports,mockWindow);
 let activity=initial;
 function render(){cursor=0;tree=m.exports.NonoWelcome({activity});effects.splice(0).forEach(fn=>fn());}
 return {timers,render,typing:()=>tree.props['data-typing'],edit(active=true){activity={serial:activity.serial+1,active};render();render();},expire(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());render();},unmount(){slots.forEach(slot=>slot?.cleanup?.());}};
}
test('home mascot starts still, responds only to input, stops after inactivity and on blur',()=>{
 const h=harness();h.render();assert.equal(h.typing(),false);assert.equal(h.timers.size,0);
 h.edit();assert.equal(h.typing(),true);assert.equal(h.timers.size,1);
 h.edit();assert.equal(h.timers.size,1);h.expire();assert.equal(h.typing(),false);
 h.edit();h.edit(false);assert.equal(h.typing(),false);assert.equal(h.timers.size,0);
 h.edit();h.unmount();assert.equal(h.timers.size,0);
});
test('returning home never replays an old typing event',()=>{
 const h=harness({serial:24,active:true});h.render();assert.equal(h.typing(),false);assert.equal(h.timers.size,0);
});
test('all six supplied raster crops match rig dimensions and remain within the original canvas',()=>{
 const base=path.join(root,'codex-ui/src/components/Brand/nono'),rig=JSON.parse(fs.readFileSync(path.join(base,'rig.json'),'utf8'));
 assert.equal(rig.order.length,6);
 for(const id of rig.order){const data=fs.readFileSync(path.join(base,'parts',id+'.png')),[x,y,w,h]=rig.boxes_xywh[id];assert.equal(data.readUInt32BE(16),w);assert.equal(data.readUInt32BE(20),h);assert.ok(x>=0&&y>=0&&x+w<=rig.canvas[0]&&y+h<=rig.canvas[1]);}
});
