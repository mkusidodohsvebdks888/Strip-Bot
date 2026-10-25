const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const ui=path.resolve(__dirname,'../codex-ui'),req=createRequire(path.join(ui,'package.json'));
const ts=req('typescript'),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const cache=new Map();
function load(file){
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',code)(id=>{
    if(id.endsWith('.css'))return {__esModule:true,default:{root:'root',heading:'heading',subtext:'subtext'}};
    if(/\.(png|jpe?g|webp|svg)$/.test(id))return {__esModule:true,default:'/alpha-eye.png'};
    if(!id.startsWith('.'))return req(id);
    const base=path.resolve(path.dirname(file),id);
    return load(['.tsx','.ts','.js','.mjs'].map(ext=>base+ext).find(candidate=>fs.existsSync(candidate))||base);
  },module,module.exports);
  return module.exports;
}
const {HomeWelcome}=load(path.join(ui,'src/components/EmptyState/HomeWelcome.tsx'));
const html=renderToStaticMarkup(React.createElement(HomeWelcome));
test('home welcome keeps the title and removes the extra prompt chips',()=>{
  assert.ok(html.includes('今天想做点'));
  assert.ok(!html.includes('规划任务'));
  assert.ok(!html.includes('理解代码'));
  assert.ok(!html.includes('修改代码'));
});
test('home welcome uses the interactive Alpha eye mark',()=>{
  assert.ok(html.includes('alpha-eye'));
  assert.ok(html.includes('class="alpha-eye__overlay"'));
  assert.ok(html.includes('aria-label="Strip Bot"'));
});
