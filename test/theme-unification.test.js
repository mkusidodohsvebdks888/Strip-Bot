'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../codex-ui/src');
const styles=fs.readFileSync(path.join(root,'modules/theme/styles/unified-modules.css'),'utf8');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const state=fs.readFileSync(path.join(root,'modules/theme/state/useAppearance.ts'),'utf8');
const choices=['warm','white','mist','dark','graphite'];

test('theme switching has one root palette for every available appearance',()=>{
 for(const palette of choices){
   const start=styles.indexOf('html[data-strip-palette="'+palette+'"] {');
   assert.notEqual(start,-1,'missing root palette: '+palette);
   const end=styles.indexOf('}',start);
   const block=styles.slice(start,end);
   for(const token of ['--bg','--sidebar-bg','--card-bg','--fg','--muted','--accent','--border-10','--surface-search']){
     assert.ok(block.includes(token+':'),palette+' missing '+token);
   }
   assert.ok(block.includes('color-scheme: '+(['dark','graphite'].includes(palette)?'dark':'light')+';'),palette+' system colors');
 }
});
test('workspace, plugins, settings and external popup use the same CSS tokens',()=>{
 const selectors=['.strip-app[data-appearance]','.strip-api-entry[data-appearance]','.strip-tool-rail','.strip-tool-panel',
  '.strip-ext-card','.strip-connection-card','.strip-tool-content','.strip-account-menu','.strip-tool-more__menu'];
 for(const selector of selectors)assert.ok(styles.includes(selector),'missing module: '+selector);
 assert.match(styles,/\.strip-account-menu\s*\{[\s\S]*?--fg:\s*inherit/);
 assert.match(styles,/\.strip-ext-card[^}]*\}[\s\S]*?background-color:\s*var\(--card-bg\)/);
});
test('global synchronization stylesheet loads after all other theme and layout styles',()=>{
 const name="import './modules/theme/styles/unified-modules.css';";
 assert.ok(app.includes(name));
 const lastImport=[...app.matchAll(/^import .+;$/gm)].at(-1)?.[0];
 assert.equal(lastImport,name);
 assert.match(state,/document\.documentElement\.dataset\.stripPalette=appearance/);
 assert.match(state,/window\.addEventListener\?\.\('storage',sync\)/);
});
