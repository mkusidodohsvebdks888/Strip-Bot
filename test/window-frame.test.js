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
const reference=read('codex-ui/src/styles/codex-reference-layout.css');
const commandBar=read('codex-ui/src/components/Window/TopCommandBar.tsx');

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
    assert.match(html,/className="strip-window-topbar__title(?: [^"]*)?"/);
  }
  assert.match(css,/html\[data-strip-desktop="true"\] \.strip-window-topbar/);
  assert.match(css,/-webkit-app-region:\s*drag/);
  assert.match(reference,/padding:\s*0 154px 0 14px/);
  assert.match(commandBar,/className="strip-top-commandbar"/);
  assert.match(commandBar,/onToggleSidebar/);
  assert.match(css,/padding-top:\s*var\(--strip-native-titlebar-height\)/);
});

test('native titlebar overlay matches the CSS caption height and stays themed',()=>{
  assert.match(css,/--strip-native-titlebar-height:\s*48px/);
  assert.match(electron,/const STRIP_TITLEBAR_HEIGHT=48;/);
  assert.match(electron,/titleBarOverlay: \{ color: '#eef2f6', symbolColor: '#52606d', height: STRIP_TITLEBAR_HEIGHT \}/);
  assert.match(electron,/window\.setTitleBarOverlay\(\{color:palette\.color,symbolColor:palette\.symbolColor,height:STRIP_TITLEBAR_HEIGHT\}\)/);
});

test('frame stylesheet precedes final screenshot layout without losing theme tokens',()=>{
  const frameImport="import './modules/theme/styles/window-frame.css';";
  const referenceImport="import './styles/codex-reference-layout.css';";
  const items=[...app.matchAll(/^import .+;$/gm)].map(x=>x[0]);
  assert.ok(items.includes(frameImport));
  assert.equal(items.at(-1),referenceImport);
  assert.ok(items.indexOf(referenceImport)>items.indexOf(frameImport));
  assert.match(css,/background:\s*var\(--bg\)/);
  assert.match(css,/border-color:\s*var\(--border-09\)/);
  assert.match(reference,/var\(--sidebar-bg\)/);
  assert.match(reference,/var\(--border-10\)/);
});
