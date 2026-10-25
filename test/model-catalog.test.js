const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const ui=path.resolve(__dirname,'../codex-ui'),requireUI=createRequire(path.join(ui,'package.json')),ts=requireUI('typescript');
function moduleFrom(relative,overrides={}){
 const file=path.join(ui,'src',relative),module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(id=>{if(id in overrides)return overrides[id];if(id==='../model-vendors')return moduleFrom('components/model-vendors.ts');throw Error(id);},module,module.exports);return module.exports;
}
test('model catalog merges native, CC Switch and direct identities while keeping reasoning capabilities',async()=>{
 const originalFetch=global.fetch,originalStorage=global.localStorage;
 global.localStorage={getItem:()=>null};
 global.fetch=async route=>({ok:true,json:async()=>({
 '/api/connection/account/status':{connected:true,models:[{id:'gpt-shared',name:'GPT Shared',variants:[{id:'high',effort:'high'}]}]},
 '/api/cc-switch/status':{healthy:true,codex:{model:'gpt-shared'}},
 '/api/connection/status':{configured:true,baseUrl:'https://example.test/v1',model:'gpt-shared',reasoningEnabled:true},
 })[route]});
 try{
 const {loadCatalog}=moduleFrom('components/ModelSwitcher/model-catalog.ts',{'../api-models':{discoverModels:async()=>({models:[{id:'gpt-shared',name:'Shared API'},{id:'deepseek-test',name:'DeepSeek'}]})}});
 const result=await loadCatalog(),shared=result.models.find(m=>m.id==='gpt-shared');
 assert.equal(result.models.length,2);assert.deepEqual(shared.routes.map(r=>r.id),['opencode','ccswitch','direct']);
 assert.equal(shared.routes.find(r=>r.id==='opencode').variants[0].id,'high');
 assert.equal(shared.routes.find(r=>r.id==='direct').variants.length,5);assert.deepEqual(result.errors,[]);
 }finally{global.fetch=originalFetch;global.localStorage=originalStorage;}
});
