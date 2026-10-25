'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {activityEvents,activityStatus}=require('../codex-ui/src/components/Activity/activity-events.ts');
const base=()=>({running:false,messages:[],permissions:[],forms:[],diff:[],workspace:'G:/p/fixture'});
test('activity events use stable real tool IDs, preserve commands and exclude private reasoning',()=>{
  const snapshot={...base(),messages:[{id:'new',type:'assistant',content:[{type:'reasoning',text:'PRIVATE_REASONING'},{type:'tool',id:'shell1',name:'shell',state:{status:'completed',input:{command:'echo OK',workdir:'G:/p/fixture'},content:[{type:'text',text:'OK'}]}}]},{id:'old',type:'assistant',content:[{type:'tool',id:'read1',name:'read',state:{status:'running',input:{path:'input.txt'}}}]}]};
  const result=activityEvents(snapshot);assert.deepEqual(result.map(e=>e.id),['old:read1','new:shell1']);
  assert.equal(result[0].status,'running');assert.equal(result[1].type,'command');assert.equal(result[1].detail.output,'OK');assert.equal(result[1].detail.command,'echo OK');assert.ok(!JSON.stringify(result).includes('PRIVATE_REASONING'));
  snapshot.messages[1].content[0].state.status='completed';assert.equal(activityEvents(snapshot)[0].id,result[0].id);
});
test('pending approvals remain pending, errors stay errors and diff lines retain additions/deletions',()=>{
  const snapshot={...base(),permissions:[{id:'per_1',action:'shell',resources:['echo OK'],metadata:{reason:'verify'}}],diff:[{path:'file.txt',additions:1,deletions:1,patch:'--- a/file.txt\n+++ b/file.txt\n-old\n+new'}],messages:[{id:'m1',type:'assistant',error:{message:'failed'},content:[{type:'tool',id:'e',name:'edit',state:{status:'error',error:'Denied'}}]}]};
  const events=activityEvents(snapshot);assert.equal(events.find(e=>e.id==='m1:e').status,'error');assert.equal(events.find(e=>e.id==='permission:per_1').status,'pending');assert.equal(activityStatus(snapshot,false),'pending');
  const diff=events.find(e=>e.id.startsWith('diff:'));assert.equal(diff.add,1);assert.deepEqual(diff.detail.diff.map(l=>l.kind),['context','context','del','add']);
  snapshot.permissions=[];assert.equal(activityStatus(snapshot,false),'error');assert.equal(activityStatus(snapshot,true),'running');
});
test('unknown tool states never become success and activity text is treated as data',()=>{
  const snapshot={...base(),messages:[{id:'m',type:'assistant',content:[{type:'tool',name:'read',state:{status:'cancelled',input:{path:'<script>bad()</script>'},content:'x'.repeat(25000)}}]}]};
  const event=activityEvents(snapshot)[0];assert.equal(event.status,'idle');assert.equal(event.path,'<script>bad()</script>');assert.ok(event.detail.message.length<24500);assert.equal(activityEvents(null).length,0);assert.equal(activityStatus(base(),false),'idle');
});
test('successful edits show actual replacement fragments while failed edits remain errors',()=>{
  const snapshot={...base(),messages:[{id:'m',type:'assistant',content:[{type:'tool',id:'edit',name:'edit',state:{status:'completed',input:{path:'result.txt',oldString:'OLD',newString:'NEW'}}}]}]};
  assert.deepEqual(activityEvents(snapshot)[0].detail.diff,[{kind:'del',text:'OLD'},{kind:'add',text:'NEW'}]);
  snapshot.messages[0].content[0].state.status='error';assert.equal(activityEvents(snapshot)[0].detail.kind,'error');
});

test('interruption merges into same-turn failed command without losing output or command details',()=>{
 const failed={id:'tool-message',type:'assistant',content:[{type:'tool',id:'shell',name:'shell',state:{status:'error',input:{command:'fixture command',cwd:'fixture'},content:'partial output',error:'Expected JSON value at metadata.include'}}]};
 const interrupted={id:'followup',type:'assistant',error:{message:'Step interrupted'},content:[]};
 const events=activityEvents({...base(),messages:[interrupted,failed,{id:'user',type:'user',content:[]}]});
 assert.equal(events.length,1);assert.equal(events[0].defaultOpen,false);
 assert.equal(events[0].detail.kind,'command');assert.equal(events[0].detail.command,'fixture command');
 for(const text of ['partial output','Expected JSON value','Step interrupted'])assert.ok(events[0].detail.output.includes(text));
 assert.match(events[0].subtitle,/JSON/);
 const nextTurn=activityEvents({...base(),messages:[interrupted,{id:'next-user',type:'user',content:[]},failed]});
 assert.equal(nextTurn.length,2);assert.equal(nextTurn[1].title,'执行已中断');
 assert.ok(!nextTurn[0].detail.output.includes('Step interrupted'));
});
