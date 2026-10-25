const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');const req=createRequire(path.resolve(__dirname,'../codex-ui/package.json'));const postcss=req('postcss');
test('light composer leaves fixed model and response popups in viewport coordinates',()=>{
 // These popups use getBoundingClientRect coordinates. A filtered ancestor
 // makes position:fixed local to that ancestor and moves them below the window.
 let filter='none',webkit='none';
 for(const name of ['theme.css','claude-theme.css','codex-composer-refresh.css','composer-layout-fix.css','claude-codex-composer.css']){
  postcss.parse(fs.readFileSync(path.resolve(__dirname,'../codex-ui/src/styles',name),'utf8')).walkRules(rule=>{
   if(!rule.selector.split(',').some(s=>s.trim()==='.strip-app[data-theme="light"] .strip-codex-composer__panel' || s.trim()==='.strip-app[data-appearance] .strip-codex-composer__panel'))return;
   rule.walkDecls(d=>{if(d.prop==='backdrop-filter')filter=d.value;if(d.prop==='-webkit-backdrop-filter')webkit=d.value;});
  });
 }
 assert.equal(filter,'none','composer blur changes fixed popup coordinate space');assert.equal(webkit,'none');
});
