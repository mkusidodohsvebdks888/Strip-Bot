'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
function harness(storage=new Map()){
 let cursor=0,tree,props;const slots=[],effects=[],listeners=new Map(),selected=[],removed=[],projects=[];
 const hooks={useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,n=>slots[i].value=typeof n==='function'?n(slots[i].value):n];},useRef(init){const i=cursor++;return slots[i]??={current:init};},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||!deps.every((v,j)=>Object.is(v,old.deps[j]))){slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
 const doc={addEventListener(t,fn){if(!listeners.has(t))listeners.set(t,new Set());listeners.get(t).add(fn);},removeEventListener(t,fn){listeners.get(t)?.delete(fn);}};
 const mod={exports:{}},code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../codex-ui/src/components/Sidebar/ChatHistory.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','localStorage','document',code)(id=>id==='react'?hooks:id==='../useAnchoredPopup'?{useAnchoredPopup:()=>({left:60,top:200,maxHeight:300})}:id.startsWith('.')?{Icon:()=>null,ControlIcon:()=>null}:req(id),mod,mod.exports,{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},doc);
 function walk(n,fn){if(Array.isArray(n))return n.forEach(v=>walk(v,fn));if(!n?.props)return;fn(n);walk(n.props.children,fn);}
 function nodes(fn){const out=[];walk(tree,n=>{if(fn(n))out.push(n);});return out;}
 function text(n){if(Array.isArray(n))return n.map(text).join('');if(n?.props)return text(n.props.children);return typeof n==='string'?n:'';}
 return {storage,selected,removed,projects,nodes,text,render(next){props={entries:[],active:'',busy:false,onSelect:id=>selected.push(id),onRemove:id=>removed.push(id),onOpenProject:p=>projects.push(p),...props,...next};cursor=0;tree=mod.exports.ChatHistory(props);walk(tree,n=>{if(n.ref&&typeof n.ref==='object')n.ref.current={contains:()=>false,querySelector:()=>({focus(){}})};});effects.splice(0).forEach(fn=>fn());return tree;},click(node){assert.ok(node);assert.ok(!node.props.disabled);node.props.onClick?.({currentTarget:{dataset:{menuLocation:node.props['data-menu-location']},focus(){},contains:()=>false}});},escape(){for(const fn of listeners.get('keydown')||[])fn({key:'Escape',preventDefault(){}});},outside(){for(const fn of listeners.get('pointerdown')||[])fn({target:{}});}};
}
const entries=[{id:'ses_old',title:'Older',updatedAt:1,description:'',workspace:'G:\\real\\ProjectA'},{id:'ses_new',title:'Newer',updatedAt:20,description:'',workspace:'G:\\real\\ProjectA'},{id:'legacy:chat',title:'Legacy',updatedAt:5,description:''}];
const button=(h,label)=>h.nodes(n=>n.type==='button'&&h.text(n)===label)[0];
test('projects use actual paths, expand real sessions and retain recent ordering',()=>{
 const h=harness();h.render({entries});h.render();
 assert.equal(h.nodes(n=>n.props.className?.includes('strip-cx-project__open')).length,1);
 assert.deepEqual(h.nodes(n=>n.props.className==='strip-cx-thread__main').map(h.text),['Newer','Legacy','Older']);
 h.click(h.nodes(n=>n.props.className==='strip-cx-project__expander')[0]);h.render();
 assert.equal(h.nodes(n=>n.props.className==='strip-cx-project__threads').length,1);
 h.click(h.nodes(n=>n.props.className?.includes('strip-cx-project__open'))[0]);assert.deepEqual(h.projects,['G:\\real\\ProjectA']);
 h.click(button(h,'Newer'));assert.deepEqual(h.selected,['ses_new']);
});
test('one session menu supports pin persistence, unpin, removal callback and dismissal',()=>{
 const h=harness();h.render({entries});h.render();h.click(h.nodes(n=>n.props.className==='strip-cx-project__expander')[0]);h.render();
 h.click(h.nodes(n=>n.props['aria-label']==='管理会话：Newer')[0]);h.render();assert.equal(h.nodes(n=>n.props.className==='strip-cx-menu').length,1);
 h.click(button(h,'置顶会话'));h.render();assert.equal(h.nodes(n=>n.props.className==='strip-cx-menu').length,0);
 const reopened=harness(h.storage);reopened.render({entries});
 assert.ok(reopened.text(reopened.nodes(n=>n.props['aria-label']==='置顶会话')[0]).includes('Newer'));
 reopened.click(reopened.nodes(n=>n.props['aria-label']==='管理会话：Newer')[0]);reopened.render();reopened.click(button(reopened,'取消置顶'));reopened.render();
 assert.ok(!reopened.text(reopened.nodes(n=>n.props['aria-label']==='置顶会话')[0]).includes('Newer'));
 reopened.click(reopened.nodes(n=>n.props['aria-label']==='管理会话：Newer')[0]);reopened.render();reopened.click(button(reopened,'删除会话'));assert.deepEqual(reopened.removed,['ses_new']);
 reopened.render();reopened.click(reopened.nodes(n=>n.props['aria-label']==='管理会话：Newer')[0]);reopened.render();reopened.escape();reopened.render();assert.equal(reopened.nodes(n=>n.props.className==='strip-cx-menu').length,0);
 reopened.click(reopened.nodes(n=>n.props['aria-label']==='管理会话：Newer')[0]);reopened.render();reopened.outside();reopened.render();assert.equal(reopened.nodes(n=>n.props.className==='strip-cx-menu').length,0);
});
test('section folding persists, search reveals matches, busy state blocks destructive actions',()=>{
 const h=harness();h.render({entries});h.render();h.click(h.nodes(n=>n.props.className==='strip-cx-section__heading'&&h.text(n).includes('最近'))[0]);h.render();
 assert.equal(h.nodes(n=>n.props.className==='strip-cx-thread__main').length,0);
 const reopened=harness(h.storage);reopened.render({entries});assert.equal(reopened.nodes(n=>n.props.className==='strip-cx-thread__main').length,0);
 reopened.render({search:'Newer',busy:true});assert.equal(reopened.nodes(n=>n.props.className==='strip-cx-thread__main').length,2);
 assert.equal(button(reopened,'Newer').props.disabled,true);
 reopened.click(reopened.nodes(n=>n.props['aria-label']==='管理会话：Newer')[0]);reopened.render();assert.equal(button(reopened,'删除会话').props.disabled,true);
});



