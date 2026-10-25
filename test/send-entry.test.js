const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs'),Module=require('node:module');
const root=path.resolve(__dirname,'..');
const ts=require(path.join(root,'codex-ui/node_modules/typescript'));
const React=require(path.join(root,'codex-ui/node_modules/react'));
const {renderToStaticMarkup}=require(path.join(root,'codex-ui/node_modules/react-dom/server'));
function loadHook(){
  const filename=path.join(root,'codex-ui/src/state/useUnifiedConversation.ts');
  const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
  return mod.exports.useUnifiedConversation;
}
test('API entry starts a fresh conversation rather than restoring an incompatible old model session',()=>{
  const values={'strip_unified_active_v1':JSON.stringify('ses_oldmodel'),'strip_cc_agent_sessions_v1':'[]'};
  global.localStorage={getItem:key=>values[key] || null};
  try{
    const useConversation=loadHook();
    const Probe=()=>React.createElement('span',null,useConversation('direct','new-model','',true).active || 'new-conversation');
    assert.equal(renderToStaticMarkup(React.createElement(Probe)),'<span>new-conversation</span>');
    assert.equal(values.strip_unified_active_v1,JSON.stringify('ses_oldmodel'));
  }finally{delete global.localStorage;}
});
