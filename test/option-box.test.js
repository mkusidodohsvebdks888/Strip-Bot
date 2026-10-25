'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const ui=path.resolve(__dirname,'../codex-ui');
const requireUI=createRequire(path.join(ui,'package.json'));
const ts=requireUI('typescript'),React=requireUI('react');
const {renderToStaticMarkup}=requireUI('react-dom/server');
const file=path.join(ui,'src/components/OptionBox/OptionBox.tsx');
const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const mod={exports:{}};
new Function('require','module','exports',code)(id=>id.endsWith('.css')?{}:id==='../../Icons'?{Icon:()=>null}:requireUI(id),mod,mod.exports);
const render=props=>renderToStaticMarkup(React.createElement(mod.exports.OptionBox,props));
test('OptionBox renders themed single-choice options and tones',()=>{
 const html=render({title:'继续方式',badge:'需要确认',options:[{id:'patch',label:'最小修改',tone:'primary'},{id:'discard',label:'放弃',tone:'danger'}],onSelect(){}});
 assert.ok(html.includes('继续方式'));assert.ok(html.includes('需要确认'));
 assert.ok(html.includes('strip-option--primary'));assert.ok(html.includes('strip-option--danger'));
 assert.ok(html.includes('strip-option-box__badge'));
});
test('OptionBox renders a confirm footer for multiple selection',()=>{
 const html=render({title:'选择文件',multiple:true,confirmLabel:'应用',options:[{id:'a',label:'A'},{id:'b',label:'B'}],onSelect(){},onCancel(){}});
 assert.ok(html.includes('应用'));
 assert.ok(html.includes('取消'));
});