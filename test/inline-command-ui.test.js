const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
function harness(exportName,initialProps){
 let cursor=0,tree;const slots=[];
 const hooks={useEffect(){},useRef:v=>({current:v}),useState(init){const i=cursor++;slots[i]??={value:typeof init==='function'?init():init};return [slots[i].value,n=>slots[i].value=typeof n==='function'?n(slots[i].value):n];}};
 const file=path.resolve(__dirname,'../codex-ui/src/components/Workspace/WorkspaceActions.tsx'),m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',code)(id=>id==='react'?hooks:id.endsWith('.css')?{}:id==='../../Icons'?{Icon:()=>null}:req(id),m,m.exports);
 const props={...initialProps};
 function walk(n,fn){if(Array.isArray(n))return n.forEach(v=>walk(v,fn));if(!n?.props)return;fn(n);walk(n.props.children,fn);}
 const nodes=fn=>{const out=[];walk(tree,n=>{if(fn(n))out.push(n);});return out;};
 return {props,nodes,render(){cursor=0;tree=m.exports[exportName](props);return tree;}};
}
test('chat workspace never renders command history; output lives only in the floating palette',()=>{
 const workspace=harness('WorkspaceActions',{session:'ses_A',snapshot:null,onError(){}});
 assert.equal(workspace.render(),null);
 const palette=harness('CommandPalette',{open:true,session:'ses_A',workspace:'G:/fixture',executing:false,agentRunning:false,disabledReason:undefined,results:[{id:'ses_A:1',command:'echo test',stdout:'OUTPUT_FIXTURE',stderr:'',exitCode:0,durationMs:10,status:'done'}],onClose(){},onRun:async()=>true,onError(){}});
 palette.render();assert.equal(palette.nodes(n=>n.type==='pre').length,0);
 let toggle=palette.nodes(n=>n.props.className==='strip-workflow-run-toggle')[0];assert.equal(toggle.props['aria-expanded'],false);toggle.props.onClick();palette.render();assert.equal(palette.nodes(n=>n.type==='pre').length,1);
 palette.props.session='ses_B';palette.props.results=[];palette.render();assert.equal(palette.nodes(n=>n.type==='pre').length,0);
 palette.props.open=false;assert.equal(palette.render(),null);
});
test('file diff expands and stays scoped to its session',()=>{
 const h=harness('WorkspaceActions',{session:'ses_A',snapshot:{workspace:'G:/fixture',diff:[{path:'a.txt',patch:'PATCH_FIXTURE'}]},onError(){}});h.render();
 h.nodes(n=>n.type==='button'&&n.props['aria-expanded']===false)[0].props.onClick();h.render();assert.equal(h.nodes(n=>n.props.className==='strip-workflow-patch').length,1);
 h.props.session='ses_B';h.render();assert.equal(h.nodes(n=>n.props.className==='strip-workflow-patch').length,0);
});