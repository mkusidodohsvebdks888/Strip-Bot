'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('codex-ui/src/modules/theme/styles/window-frame.css');
const app=read('codex-ui/src/App.tsx');
const entry=read('codex-ui/src/components/ApiEntry.tsx');
const electron=read('desktop-app/main.cjs');

test('window frame has a responsive rounded rectangle and theme-aware border',()=>{
  assert.match(css,/--strip-window-radius:\s*18px/);
  assert.match(css,/border:\s*1px solid var\(--border-10\)/);
  assert.match(css,/border-radius:\s*var\(--strip-window-radius\)/);
  assert.match(css,/overflow:\s*hidden/);
  assert.match(css,/@media \(max-width:\s*640px\)/);
  assert.match(css,/--strip-window-radius:\s*0px/);
});

test('workbench and API onboarding expose the same desktop caption strip',()=>{
  for(const html of [app,entry]){
    assert.match(html,/className="strip-window-topbar"/);
    assert.match(html,/className="strip-window-topbar__title"/);
  }
  assert.match(css,/html\[data-strip-desktop="true"\] \.strip-window-topbar/);
  assert.match(css,/-webkit-app-region:\s*drag/);
  assert.match(css,/padding:\s*0 160px 0 18px/);
  assert.match(css,/padding-top:\s*var\(--strip-native-titlebar-height\)/);
});

test('native titlebar overlay matches the CSS caption height and stays themed',()=>{
  assert.match(css,/--strip-native-titlebar-height:\s*48px/);
  assert.match(electron,/const STRIP_TITLEBAR_HEIGHT=48;/);
  assert.match(electron,/titleBarOverlay: \{ color: '#faf9f6', symbolColor: '#4a4139', height: STRIP_TITLEBAR_HEIGHT \}/);
  assert.match(electron,/window\.setTitleBarOverlay\(\{color:palette\.color,symbolColor:palette\.symbolColor,height:STRIP_TITLEBAR_HEIGHT\}\)/);
});

test('frame stylesheet is loaded last without overriding component theme tokens',()=>{
  const cssImport="import './modules/theme/styles/window-frame.css';";
  const items=[...app.matchAll(/^import .+;$/gm)].map(x=>x[0]);
  assert.equal(items.at(-1),cssImport);
  assert.match(css,/background:\s*var\(--bg\)/);
  assert.match(css,/border-color:\s*var\(--border-09\)/);
});
