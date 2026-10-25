'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const cssRequire=createRequire(path.resolve(__dirname,'../codex-ui/package.json'));
const postcss=cssRequire('postcss');
test('theme styles have balanced blocks before bundling so desktop styles stay outside mobile queries',()=>{
 const root=path.resolve(__dirname,'../codex-ui/src/modules/theme/styles');
 for(const name of fs.readdirSync(root).filter(name=>name.endsWith('.css'))){
  assert.doesNotThrow(()=>postcss.parse(fs.readFileSync(path.join(root,name),'utf8'),{from:name}),name);
 }
});
