'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const ui=path.resolve(__dirname,'../codex-ui'),requireUI=createRequire(path.join(ui,'package.json'));
const ts=requireUI('typescript'),React=requireUI('react');
const file=path.join(ui,'src/components/useAnchoredPopup.ts');
const source=fs.readFileSync(file,'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('require','module','exports',code)(id=>{
  if(id==='react')return React;
  throw new Error('Unexpected dependency: '+id);
},mod,mod.exports);
const {calculatePopupPlacement}=mod.exports;

test('popup stays beside a right-edge button and inside the viewport',()=>{
  const box=calculatePopupPlacement(
    {left:1080,right:1160,top:720,bottom:760},
    {width:320,height:260},
    {width:1200,height:900},
    {width:320,align:'end',gap:9,margin:12},
  );
  assert.equal(box.left,840);
  assert.ok(box.left>=12 && box.left+320<=1188);
  assert.ok(box.top>=12);
  assert.ok(box.maxHeight>0);
});

test('popup opens downward when there is not enough room above',()=>{
  const box=calculatePopupPlacement(
    {left:80,right:180,top:40,bottom:76},
    {width:300,height:240},
    {width:900,height:600},
    {width:300,align:'start',gap:8,margin:12},
  );
  assert.equal(box.left,80);
  assert.equal(box.top,84);
  assert.ok(box.maxHeight>=240);
});

test('popup clamps to both horizontal edges and never returns negative height',()=>{
  const left=calculatePopupPlacement(
    {left:0,right:20,top:120,bottom:150},
    {width:320,height:200},
    {width:280,height:300},
    {width:320,align:'end',gap:8,margin:12},
  );
  assert.equal(left.left,12);
  assert.ok(left.top>=12);
  assert.ok(left.maxHeight>=0);

  const right=calculatePopupPlacement(
    {left:260,right:279,top:20,bottom:40},
    {width:300,height:180},
    {width:280,height:260},
    {width:300,align:'start',gap:8,margin:12},
  );
  assert.equal(right.left,12);
  assert.ok(right.maxHeight>=0);
});