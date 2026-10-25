'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const req=createRequire(path.resolve(root,'codex-ui/package.json'));
const ts=req('typescript');
const React=require(path.join(root,'codex-ui/node_modules/react'));
const {renderToStaticMarkup}=require(path.join(root,'codex-ui/node_modules/react-dom/server'));

function loadTsx(file,resolveExtra=()=>undefined){
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',code)(id=>resolveExtra(id)??(id==='react'?React:req(id)),module,module.exports);
  return module.exports;
}

test('activity grouping summarizes commands and keeps real timestamps',()=>{
  const types=require(path.resolve(root,'codex-ui/src/components/Activity/activity-types.ts'));
  const events=[
    {id:'r',kind:'read',title:'input.txt',status:'completed',startedAt:100,endedAt:150},
    {id:'s1',kind:'shell',title:'echo one',status:'completed',startedAt:200,endedAt:1200},
    {id:'s2',kind:'shell',title:'echo two',status:'completed',startedAt:1300,endedAt:1800},
    {id:'q',kind:'question',title:'Choose',status:'running',startedAt:1900},
  ];
  const groups=types.groupActivities(events);
  assert.equal(groups.length,2);assert.equal(groups[0].type,'group');assert.equal(groups[0].events.length,3);
  assert.equal(types.summarize(groups[0].events),'已读取文件、运行了 2 条命令');
  assert.equal(types.formatDuration(events[1]),'1s');assert.equal(types.formatDuration({...events[1],startedAt:undefined}),'');
  const running=events.map(event=>event.id==='s2'?{...event,status:'running',endedAt:undefined}:event);
  assert.match(types.summarize(running),/正在运行命令（第 2 条）/);
  const {activityEvents}=require(path.resolve(root,'codex-ui/src/components/Activity/activity-events.ts'));
  const snapshot={running:false,permissions:[],forms:[],diff:[],workspace:'G:/fixture',messages:[{id:'m',type:'assistant',time:{created:10},content:[{type:'tool',id:'t',name:'shell',time:{created:20,ran:30,completed:80},state:{status:'completed',input:{command:'echo ok'},content:'ok'}}]}]};
  const [event]=activityEvents(snapshot);assert.equal(event.startedAt,20);assert.equal(event.endedAt,80);
});

test('ActivityStream renders one grouped summary for consecutive commands',()=>{
  const file=path.resolve(root,'codex-ui/src/components/Activity/ActivityStream.tsx');
  const {ActivityStream}=loadTsx(file,id=>{
    if(id==='../../Icons')return {Icon:()=>React.createElement('span')};
    if(id==='./activity-types.ts')return require(path.resolve(root,'codex-ui/src/components/Activity/activity-types.ts'));
    if(id==='./useThrottledValue.ts')return require(path.resolve(root,'codex-ui/src/components/Activity/useThrottledValue.ts'));
    return undefined;
  });
  const events=Array.from({length:5},(_,i)=>({id:'s'+i,kind:'shell',title:'echo '+i,status:i===4?'running':'completed',startedAt:i*1000,endedAt:i===4?undefined:(i+1)*1000}));
  const html=renderToStaticMarkup(React.createElement(ActivityStream,{events}));
  assert.equal((html.match(/strip-act__row--group/g)||[]).length,1);
  assert.match(html,/正在运行命令（第 5 条）/);
  assert.match(html,/echo 4/);
  assert.equal((html.match(/strip-act__item-line/g)||[]).length,5);
});

test('question cards replace native selects with actionable option buttons',()=>{
  const qFile=path.resolve(root,'codex-ui/src/components/Questions/QuestionCard.tsx');
  const q=loadTsx(qFile,id=>id==='../../Icons'?{Icon:()=>React.createElement('span')}:undefined);
  const questions=[
    {id:'where',title:'确认位置',options:[{value:'screens',label:'Pictures\\Screenshots',recommended:true},{value:'desktop',label:'仅桌面'}]},
    {id:'method',title:'整理方式',options:[{value:'month',label:'按月份'},{value:'app',label:'按应用'}],allowCustom:true},
  ];
  const html=renderToStaticMarkup(React.createElement(q.QuestionCard,{questions,onSubmit(){}}));
  assert.ok(!html.includes('<select'));
  assert.match(html,/role="radiogroup"/);assert.match(html,/0 \/ 2/);
  assert.match(html,/Pictures\\Screenshots/);assert.match(html,/其他/);
});

test('QuestionForm adapter keeps dynamic visibility and submits legacy field keys',()=>{
  const qFile=path.resolve(root,'codex-ui/src/components/Questions/QuestionCard.tsx');
  const q=loadTsx(qFile,id=>id==='../../Icons'?{Icon:()=>React.createElement('span')}:undefined);
  const panel=loadTsx(path.resolve(root,'codex-ui/src/components/AgentPanel.tsx'),id=>{
    if(id.endsWith('.css'))return {};
    if(id==='./Questions/QuestionCard')return q;
    return undefined;
  });
  const form={id:'frm',title:'需要确认',fields:[
    {key:'mode',type:'select',title:'方式',required:true,default:'safe',options:[{value:'safe',label:'安全整理'},{value:'fast',label:'快速整理'}]},
    {key:'custom',type:'text',title:'补充',when:[{key:'mode',op:'eq',value:'safe'}]},
    {key:'files',type:'multiselect',title:'文件',options:[{value:'a',label:'A'},{value:'b',label:'B'}]},
  ]};
  const html=renderToStaticMarkup(React.createElement(panel.QuestionForm,{form,onAnswer:async()=>{}}));
  assert.ok(!html.includes('<select'));
  assert.match(html,/1 \/ 3/);assert.match(html,/安全整理/);assert.match(html,/填写内容/);assert.match(html,/提交答复/);
});
