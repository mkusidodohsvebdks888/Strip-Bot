'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const ui=read('codex-ui/src/components/Sidebar/BuiltinPluginsTool.tsx');
const css=read('codex-ui/src/components/Sidebar/builtin-plugins.css');
const rail=read('codex-ui/src/components/Sidebar/ToolWorkspace.tsx');
const layout=read('codex-ui/src/styles/left-tool-workspace.css');
test('plugin UI exposes search, category groups and filters without changing gateway routes',()=>{
 assert.match(ui,/type Filter='all'\|'enabled'\|'disabled'/);
 assert.match(ui,/type="search"/);
 assert.match(ui,/spm-group__title/);
 assert.match(ui,/aria-pressed=\{filter===option.id\}/);
 assert.match(ui,/visible\.filter\(item=>item\.category===category\.id\)/);
 assert.match(ui,/\.toLocaleLowerCase\(\)\.includes\(search\)/);
});
test('plugin UI keeps explicit confirmation for toggles and running external tools',()=>{
 assert.match(ui,/window\.confirm\(/);
 assert.match(ui,/\/api\/plugins\/bundled\/enable/);
 assert.match(ui,/\/api\/plugins\/bundled\/execute/);
 assert.match(ui,/confirmed:true/);
 assert.match(ui,/role="switch"/);
 assert.match(ui,/aria-expanded=\{open\}/);
 assert.match(ui,/role="alert"/);
 assert.match(ui,/role="status"/);
});
test('plugin panel uses scoped design tokens and independent width',()=>{
 assert.match(ui,/import '\.\/builtin-plugins\.css'/);
 assert.match(css,/\.strip-plugin-manager\{/);
 assert.match(css,/var\(--card-bg\)/);
 assert.match(css,/var\(--border-10\)/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(rail,/strip-tool-panel--plugins/);
 assert.match(layout,/@media\(min-width:901px\)/);
 assert.match(layout,/flex:0 0 352px/);
});
