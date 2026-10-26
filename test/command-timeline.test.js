'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

/** The UI workflow installs dependencies before this test, so TypeScript is local. */
function loadCommandBatch(){
  const ts=createRequire(path.join(root,'codex-ui','package.json'))('typescript');
  const filename=path.join(root,'codex-ui/src/components/Activity/CommandBatch.tsx');
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    fileName:filename,
    reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}
  });
  const errors=(code.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,'CommandBatch should transpile with no errors');
  const jsx=(component,props)=>({component,props});
  const exports={};
  vm.runInNewContext(code.outputText,{
    exports,
    require(name){
      if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
      if(name==='../../Icons')return {Icon:()=>null};
      if(name==='../ControlIcon')return {ControlIcon:()=>null};
      throw Error('Unexpected runtime import: '+name);
    }
  },{filename});
  return exports;
}
const {groupTimeline,isCommandEvent,CommandBatch}=loadCommandBatch();
const command=(id,status='success',type='command')=>({
  id,type,status,title:'执行 C:\\Windows\\System32\\WindowsPowerShell\\powershell.exe',
  detail:{kind:'command',command:'command '+id,output:'output for '+id}
});
const edit=id=>({id,type:'edit',status:'success',title:'编辑文件',detail:{kind:'diff',diff:[{kind:'add',text:id}]}});
test('groups consecutive commands into a single Codex-style disclosure',()=>{
  const rows=groupTimeline([command('a'),command('b'),command('c')]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].kind,'command-batch');
  assert.equal(rows[0].events.length,3);
  assert.equal(rows[0].events[0].detail.command,'command a');
  assert.equal(rows[0].events[2].detail.output,'output for c');
});
test('does not move, drop or merge commands across file edits',()=>{
  const input=[command('a'),command('b','error','error'),edit('file'),command('c'),command('d')];
  const rows=groupTimeline(input);
  assert.equal(rows.length,3);
  assert.equal(rows[0].kind,'command-batch');
  assert.equal(rows[1].kind,'event');
  assert.equal(rows[1].event,input[2]);
  assert.equal(rows[2].kind,'command-batch');
  assert.equal(rows[0].events[1],input[1]);
  assert.equal(rows[2].events[0],input[3]);
  assert.equal(rows[2].events[1],input[4]);
});
test('single commands and failed shell events retain their original details',()=>{
  assert.equal(isCommandEvent(command('failed','error','error')),true);
  assert.equal(isCommandEvent(edit('file')),false);
  const input=[command('failure','error','error'),edit('file'),command('success')];
  const rows=groupTimeline(input);
  assert.equal(rows.length,3);
  assert.equal(rows[0].kind,'event');
  assert.equal(rows[0].event,input[0]);
  assert.equal(rows[0].event.detail.output,'output for failure');
  assert.equal(rows[2].event.id,'success');
  assert.equal(groupTimeline([]).length,0);
});
test('summary calls out failures but keeps long commands hidden until expanded',()=>{
  const output=CommandBatch({events:[command('a'),command('b','error','error')],opened:false,toggle:()=>{},children:'private logs'});
  const serialized=JSON.stringify(output);
  assert.match(serialized,/运行了 2 条命令/);
  assert.match(serialized,/1 条失败/);
  assert.doesNotMatch(serialized,/private logs/);
  const opened=CommandBatch({events:[command('a'),command('b','error','error')],opened:true,toggle:()=>{},children:'private logs'});
  assert.match(JSON.stringify(opened),/private logs/);
});
test('render pipeline groups both turn and tail events but retains permissions',()=>{
  const source=read('codex-ui/src/components/Activity/UnifiedConversationStream.tsx');
  const styles=read('codex-ui/src/components/Activity/codex-command-timeline.css');
  assert.match(source,/renderTimeline\(streamEvents\)/);
  assert.match(source,/renderTimeline\(remainder\)/);
  assert.match(source,/data-command=\{command\?'true':undefined\}/);
  assert.match(source,/<strong>\{title\}<\/strong>/);
  assert.match(source,/onDecide=\{onDecide\}/);
  assert.match(source,/onApproveAll=\{onApproveAll\}/);
  assert.match(source,/onAnswer=\{answer=>onAnswer\(form.id,answer\)\}/);
  assert.match(styles,/strip-stream-command-batch/);
  assert.match(styles,/prefers-reduced-motion:reduce/);
});
