const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
function harness(overrides={}){
 let cursor=0,tree,cancelled=0;const slots=[],effects=[],changes=[],commits=[];
 const hooks={useCallback:fn=>fn,useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];},useRef(init){const i=cursor++;return slots[i]??={current:init};},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>!Object.is(v,slots[i].deps[j]))){slots[i]={deps};effects.push(fn);}}};
 const file=path.resolve(__dirname,'../codex-ui/src/components/ModelSwitcher/EnergySlider.tsx'),m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','requestAnimationFrame','cancelAnimationFrame',code)(id=>id==='react'?hooks:id.endsWith('.css')?{}:req(id),m,m.exports,()=>1,()=>{});
 const props={value:2,label:'推理与响应',valueText:'均衡',supported:[true,true,true,true,true],onChange(v){changes.push(v);props.value=v;},onCommit(v){commits.push(v);},onCancel(){cancelled++;props.value=2;},...overrides};
 function walk(n,fn){if(Array.isArray(n))return n.forEach(v=>walk(v,fn));if(!n?.props)return;fn(n);walk(n.props.children,fn);}
 const h={props,changes,commits,render(){cursor=0;tree=m.exports.EnergySlider(props);effects.splice(0).forEach(fn=>fn());},input(){let found;walk(tree,n=>{if(n.type==='input')found=n.props;});return found;},root(){return tree.props;},cancelled:()=>cancelled,
 down(){h.input().onPointerDown({pointerId:1,currentTarget:{setPointerCapture(){}}});},move(v){h.input().onChange({target:{value:String(v)}});h.render();},up(v){h.input().onPointerUp({currentTarget:{value:String(v)}});h.render();},key(key){let prevented=false;h.input().onKeyDown({key,preventDefault(){prevented=true;}});h.render();return prevented;}};
 h.render();return h;
}
test('energy slider previews continuous travel, commits once on release and supports rollback',()=>{
 const h=harness();h.down();h.move(3.7);assert.equal(h.input().value,3.7);assert.deepEqual(h.commits,[]);assert.equal(h.root().style['--energy-progress'],'92.5%');
 h.up(3.7);h.input().onLostPointerCapture();h.render();assert.deepEqual(h.commits,[4]);assert.equal(h.input().value,4);
 h.props.value=2;h.render();h.render();assert.equal(h.input().value,2);
});
test('energy pointer cancellation and blur restore the starting level without applying requests',()=>{
 for(const cancel of ['onPointerCancel','onBlur','onLostPointerCapture']){
  const h=harness();h.down();h.move(.8);h.input()[cancel]();h.render();h.render();
  assert.deepEqual(h.commits,[]);assert.equal(h.input().value,2);assert.equal(h.cancelled(),1);
 }
});
test('energy keyboard skips unsupported levels, never submits and disabled gestures cannot commit',()=>{
 const h=harness({supported:[true,false,true,false,true]});assert.equal(h.key('ArrowRight'),true);assert.deepEqual(h.commits,[4]);
 h.key('Home');assert.deepEqual(h.commits,[4,0]);h.key('End');assert.deepEqual(h.commits,[4,0,4]);
 assert.equal(h.key('Enter'),true);assert.deepEqual(h.commits,[4,0,4]);
 const blocked=harness({disabled:true});blocked.down();blocked.move(4);blocked.up(4);blocked.key('End');assert.deepEqual(blocked.commits,[]);
 const unsupported=harness({supported:[true,true,true,true,false],snapToSupported:false});unsupported.down();unsupported.move(4);unsupported.up(4);unsupported.render();assert.deepEqual(unsupported.commits,[]);assert.equal(unsupported.input().value,2);
});

test('updated energy slider snaps to supported levels and rejects an entirely unavailable range',()=>{
 const h=harness({supported:[true,false,true,false,false]});h.down();h.move(3.9);h.up(3.9);assert.deepEqual(h.commits,[2]);assert.equal(h.input().value,2);
 const none=harness({supported:[false,false,false,false,false]});none.down();none.move(4);none.up(4);assert.deepEqual(none.commits,[]);assert.equal(none.cancelled(),1);
});

test('rejected keyboard feedback never replaces the input container and disabled mid-drag cancels',()=>{
 const h=harness({supported:[true,false,true,false,false]});h.key('End');h.key('ArrowRight');
 const container=h.root().children.props;assert.equal(container['data-shake'],true);
 assert.equal(h.root().children.key,null,'animation must preserve keyboard focus and pointer capture');
 const active=harness();active.down();active.move(4);active.props.disabled=true;active.render();active.render();assert.deepEqual(active.commits,[]);assert.equal(active.input().value,2);assert.equal(active.cancelled(),1);
});
