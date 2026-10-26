'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Codex-style left rail links to live modules without duplicating the search/new-chat controls',()=>{
  const s=read('codex-ui/src/components/Sidebar/ToolWorkspace.tsx');
  for(const id of ['history','backend','skills','plugins','integrations','github-tools','astrbot']){
    assert.ok(s.includes("id:'"+id+"'"),id+' must remain an accessible tool view');
  }
  assert.ok(s.includes('strip-tool-panel__workspace-trigger'),'workspace selector exists');
  assert.ok(s.includes('strip-tool-panel__header-actions'),'search and hide are in panel header');
  assert.ok(!s.includes('STRIP BOT / 工作区'),'avoid redundant explanatory labels');
});

test('settings contain the essential pages',()=>{
  const s=read('codex-ui/src/components/ConnectionSettings.tsx');
  assert.ok(!s.includes("id:'performance'"));
  assert.ok(!s.includes("id:'nono'"));
  assert.ok(s.includes("id:'appearance',label:'页面背景'"));
  assert.ok(s.includes("id:'project',label:'项目与目录'"));
});

test('history keeps pinned and project preferences, new-chat and destructive action confirmation',()=>{
  const s=read('codex-ui/src/components/Sidebar/ChatHistory.tsx');
  assert.ok(s.includes("pinnedKey='strip_codex_sidebar_pinned_v1'"));
  assert.ok(s.includes("projectsKey='strip_recent_project_paths_v1'"));
  assert.ok(s.includes("sectionsKey='strip_codex_sidebar_sections_v2'"));
  assert.ok(s.includes("renderHeading('pinned'"));
  assert.ok(s.includes("renderHeading('projects'"));
  assert.ok(s.includes("renderHeading('recent'"));
  assert.ok(s.includes('strip-cx-split'));
  assert.ok(s.includes('onRemove(id)'));
  assert.ok(s.includes('onOpenProject?.(path)'));
  assert.ok(s.includes('onNew'));
});

test('conversation rows do not duplicate the same recent item between top and bottom',()=>{
  const s=read('codex-ui/src/components/Sidebar/ChatHistory.tsx');
  assert.match(s,/recentEntries=visible\.filter\(entry=>!pinned\.includes\(entry\.id\)\)/);
  assert.match(s,/recentEntries\.slice\(0,QUICK_RECENT_LIMIT\)/);
  assert.match(s,/recentEntries\.slice\(QUICK_RECENT_LIMIT,QUICK_RECENT_LIMIT\+recentLimit\)/);
});

test('desktop menu and conversation header delegate all actions and preserve native titlebar controls',()=>{
  const s=read('codex-ui/src/App.tsx');
  const menu=read('codex-ui/src/components/Window/TopCommandBar.tsx');
  const css=read('codex-ui/src/styles/codex-reference-layout.css');
  assert.ok(s.includes('<TopCommandBar'));
  assert.ok(s.includes('strip-workspace-heading'));
  assert.ok(s.includes('onNew={newChat}'));
  assert.ok(s.includes('<SkillsTool/>'));
  assert.ok(s.includes('<BackendProjectsTool'));
  assert.ok(menu.includes("label:'文件'"));
  assert.ok(menu.includes("label:'编辑'"));
  assert.ok(menu.includes("label:'视图'"));
  assert.ok(menu.includes("label:'帮助'"));
  assert.ok(menu.includes('onToggleSidebar'));
  assert.ok(menu.includes('onSearch'));
  assert.ok(menu.includes('onNewChat'));
  assert.ok(css.includes('strip-cx-split'));
  assert.ok(css.includes('strip-tool-rail'));
  assert.ok(css.includes('strip-workspace-heading'));
  assert.ok(css.includes('154px'),'native OS controls retain their titlebar space');
});
