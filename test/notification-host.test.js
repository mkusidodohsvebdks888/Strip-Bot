const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json')),ts=req('typescript');
async function harness(){
 const issue=await import('../codex-ui/src/components/issue-presentation.mjs');
 const status=await import('../codex-ui/src/components/status-message.mjs');
 let value,tree;
 const file=path.resolve(__dirname,'../codex-ui/src/components/NotificationHost.tsx'),m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(id=>{
  if(id==='react')return {useState(init){value??=init();return [value,update=>value=update(value)];}};
  if(id.endsWith('.css'))return {};
  if(id==='./issue-presentation.mjs')return issue;
  if(id==='./status-message.mjs')return status;
  if(id==='../Icons')return {Icon:()=>null};
  return req(id);
 },m,m.exports);
 function walk(n,fn){if(Array.isArray(n))return n.forEach(v=>walk(v,fn));if(!n?.props)return;fn(n);walk(n.props.children,fn);}
 function nodes(predicate){const out=[];walk(tree,n=>{if(predicate(n))out.push(n);});return out;}
 return {render(items,scope='conversation'){tree=m.exports.NotificationHost({items,scope});},nodes,error:m.exports.errorNotification};
}
test('notifications show one at a time and retain dismissed occurrences across polling gaps',async()=>{
 const h=await harness(),one={id:'m1',title:'请求提示',message:'error one'},two={id:'m2',title:'请求提示',message:'error two'};
 h.render([one,two]);assert.equal(h.nodes(n=>n.type==='section').length,1);
 h.nodes(n=>n.type==='button')[0].props.onClick();h.render([one,two]);
 assert.deepEqual(h.nodes(n=>n.type==='p').map(n=>n.props.children),['error two']);
 h.nodes(n=>n.type==='button')[0].props.onClick();h.render([]);h.render([one,two]);
 assert.equal(h.nodes(n=>n.type==='section').length,0);
 h.render([{...one,id:'new-turn'}]);assert.equal(h.nodes(n=>n.type==='section').length,1);
 h.render([one],'other-conversation');assert.equal(h.nodes(n=>n.type==='section').length,1);
});
test('notifications localize network errors and keep original diagnostics collapsed',async()=>{
 const h=await harness(),item=h.error('network',{message:'Failed to fetch'});
 assert.match(item.message,/连接失败/);assert.match(item.detail,/Failed to fetch/);
 h.render([item]);assert.equal(h.nodes(n=>n.type==='details')[0].props.open,undefined);
 assert.equal(h.nodes(n=>n.type==='summary')[0].props.children,'技术详情');
});
