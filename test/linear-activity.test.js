'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {linearActivity}=require('../codex-ui/src/components/Activity/activity-events.ts');
const snapshot=()=>({workspace:'C:/src',running:false,messages:[],diff:[],permissions:[],forms:[]});

test('linear stream keeps user messages and tools in original conversation order',()=>{
  const data={...snapshot(),messages:[
    {id:'assistant-late',type:'assistant',text:'操作已完成',content:[{type:'tool',id:'shell',name:'shell',state:{status:'completed',input:{command:'echo OK'},content:'OK'}}]},
    {id:'user',type:'user',text:'请读取',content:[]},
    {id:'assistant-old',type:'assistant',content:[{type:'reasoning',text:'PRIVATE'}, {type:'tool',id:'read',name:'read',state:{status:'completed',input:{path:'a.ts'}}}]}
  ]};
  const rows=linearActivity(data);
  assert.deepEqual(rows.turns.map(row=>row.message.id),['assistant-old','user','assistant-late']);
  assert.deepEqual(rows.turns.map(row=>row.events.map(event=>event.id)),[['assistant-old:read'],[],['assistant-late:shell']]);
  assert.deepEqual(rows.tail,[]);
  assert.ok(!JSON.stringify(rows.turns.flatMap(row=>row.events)).includes('PRIVATE'));
});

test('diff summaries and pending approvals have a separate tail without fictitious timestamps',()=>{
  const data={...snapshot(),messages:[{id:'m:1',type:'assistant',content:[{type:'tool',name:'edit',state:{status:'completed',input:{path:'a.ts'}}}]}],diff:[{path:'a.ts',patch:'+hello'}],permissions:[{id:'p1',action:'read',resources:['a.ts']}]};
  const result=linearActivity(data);
  assert.equal(result.turns[0].events.length,1);
  assert.equal(result.turns[0].events[0].sourceMessageId,'m:1');
  assert.equal(result.tail.filter(event=>event.type==='edit').length,1);
  assert.equal(result.tail.filter(event=>event.type==='approval').length,1);
  assert.equal(result.turns[0].events[0].status,'success');
});

test('empty or disconnected snapshots generate empty content rather than synthetic events',()=>{
  assert.deepEqual(linearActivity(null),{turns:[],tail:[]});
  assert.deepEqual(linearActivity(snapshot()),{turns:[],tail:[]});
});
