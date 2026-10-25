'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {taskPlanFromEvents,taskStatusFromActivity,applyTaskEvent,isEdgeLit,currentTaskEvents}=require('../codex-ui/src/components/Activity/task-flow-plan.ts');

test('task flow maps real activity events to stable nodes and linear edges',()=>{
  const events=[
    {id:'m1:read',type:'read',status:'success',title:'读取与处理 · read',subtitle:'已完成',path:'input.txt'},
    {id:'m1:grep',type:'search',status:'running',title:'搜索与查找 · grep',subtitle:'执行中'},
    {id:'m1:error',type:'error',status:'error',title:'执行失败',subtitle:'命令失败'},
    {id:'m1:idle',type:'command',status:'idle',title:'执行命令 · shell',subtitle:'已停止或状态未知'},
    {id:'m1:pending',type:'edit',status:'pending',title:'修改文件 · edit',subtitle:'等待执行'},
    {id:'permission:per_1',type:'approval',status:'pending',title:'需要你确认'},
  ];
  const plan=taskPlanFromEvents(events);
  assert.deepEqual(plan.nodes.map(n=>n.id),['m1:read','m1:grep','m1:error','m1:idle','m1:pending']);
  assert.deepEqual(plan.nodes.map(n=>n.status),['completed','running','failed','cancelled','pending']);
  assert.equal(plan.nodes[0].description,'已完成');
  assert.equal(plan.edges.length,4);
  assert.deepEqual(plan.edges.map(e=>[e.from,e.to]),[['m1:read','m1:grep'],['m1:grep','m1:error'],['m1:error','m1:idle'],['m1:idle','m1:pending']]);
  assert.equal(taskStatusFromActivity('unknown'),'pending');
});

test('task flow aggregates events from multiple assistant messages in the current user turn',()=>{
  const turns=[
    {message:{type:'user'},events:[]},
    {message:{type:'assistant'},events:[{id:'old',type:'read',status:'success',title:'上一轮'}]},
    {message:{type:'user'},events:[]},
    {message:{type:'assistant'},events:[{id:'read',type:'read',status:'success',title:'读取'}]},
    {message:{type:'assistant'},events:[{id:'write',type:'edit',status:'running',title:'写入'}]},
  ];
  assert.deepEqual(currentTaskEvents(turns).map(event=>event.id),['read','write']);
  assert.deepEqual(currentTaskEvents([], [{id:'tail',type:'edit',status:'success',title:'差异'}]).map(event=>event.id),['tail']);
});

test('task flow applies execution updates and only lights completed/running links',()=>{
  const plan={nodes:[{id:'a',title:'A',status:'completed'},{id:'b',title:'B',status:'pending'},{id:'c',title:'C',status:'pending'}],edges:[{id:'e1',from:'a',to:'b'},{id:'e2',from:'b',to:'c'}]};
  assert.equal(isEdgeLit('completed','completed'),true);
  assert.equal(isEdgeLit('completed','running'),true);
  assert.equal(isEdgeLit('running','completed'),true);
  assert.equal(isEdgeLit('completed','pending'),false);
  assert.equal(isEdgeLit('running','pending'),false);
  assert.equal(isEdgeLit('failed','completed'),false);
  const next=applyTaskEvent(plan,{taskId:'b',status:'running'});
  assert.equal(next.nodes.find(n=>n.id==='b').status,'running');
  assert.equal(plan.nodes.find(n=>n.id==='b').status,'pending');
});

test('the real conversation stream exposes the flow toggle without removing records',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../codex-ui/src/components/Activity/UnifiedConversationStream.tsx'),'utf8');
  assert.match(source,/import \{TaskFlow\} from '\.\/TaskFlow'/);
  assert.match(source,/taskPlanFromEvents\(show\(currentTaskEvents\(activity\.turns,activity\.tail\)\)\)/);
  assert.match(source,/aria-controls="strip-task-flow"/);
  assert.match(source,/strip-stream-task-flow/);
  assert.match(source,/strip-stream-steps/);
  const app=fs.readFileSync(path.resolve(__dirname,'../codex-ui/src/App.tsx'),'utf8');
  assert.ok(app.indexOf("import './styles/task-flow.css'") > app.indexOf("import './styles/claude-theme.css'"));
  assert.ok(app.indexOf("import './styles/task-flow.css'") > app.indexOf("import './styles/readability.css'"));
});
