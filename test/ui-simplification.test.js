'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('sidebar is minimal',()=>{
 const s=read('codex-ui/src/components/Sidebar/ToolWorkspace.tsx');
 assert.ok(s.includes("{id:'history',name:'聊天记录'"));
 assert.ok(s.includes("{id:'plugins',name:'插件'"));
 assert.ok(!s.includes("{id:'activity',name:"));
 assert.ok(!s.includes("{id:'backend',name:"));
 assert.ok(!s.includes("{id:'skills',name:"));
 assert.ok(!s.includes('STRIP BOT / 工作区'));
});
test('settings contain essential pages only',()=>{
 const s=read('codex-ui/src/components/ConnectionSettings.tsx');
 assert.ok(!s.includes("id:'performance'"));
 assert.ok(!s.includes("id:'nono'"));
 assert.ok(s.includes("id:'appearance',label:'页面背景'"));
 assert.ok(s.includes("id:'project',label:'项目与目录'"));
});
test('conversation data operations are preserved',()=>{
 const s=read('codex-ui/src/components/Sidebar/ChatHistory.tsx');
 assert.ok(!s.includes('renderHeading('));
 assert.ok(s.includes("pinnedKey = 'strip_codex_sidebar_pinned_v1'"));
 assert.ok(s.includes("projectsKey = 'strip_recent_project_paths_v1'"));
 assert.ok(s.includes('onRemove(id)'));
 assert.ok(s.includes('onOpenProject?.(path)'));
});
