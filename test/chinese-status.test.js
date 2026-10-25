const {test}=require('node:test'),assert=require('node:assert/strict');
test('Chinese status messages translate exact known errors and preserve unknown diagnostics',async()=>{
 const {localizeStatusMessage}=await import('../codex-ui/src/components/status-message.mjs');
 assert.equal(localizeStatusMessage('Step interrupted'),'执行步骤已中断。');
 assert.equal(localizeStatusMessage('Failed to fetch'),'连接失败，请检查网络或服务是否运行。');
 assert.equal(localizeStatusMessage('模型已变化'),'模型已变化');
 assert.equal(localizeStatusMessage('echo Step interrupted'),'echo Step interrupted');
});
test('interrupted activity errors display Chinese without rewriting command output',()=>{
 const {activityEvents}=require('../codex-ui/src/components/Activity/activity-events.ts');
 const events=activityEvents({messages:[{id:'a',type:'assistant',error:{message:'Step interrupted'},content:[{type:'tool',id:'t',name:'shell',state:{status:'completed',input:{command:'echo Step interrupted'},content:'Step interrupted'}}]}],permissions:[],diff:[],workspace:'fixture'});
 assert.equal(events.find(e=>e.id==='a:error').title,'执行已中断');
 assert.match(events.find(e=>e.id==='a:error').detail.message,/Step interrupted/);
 assert.equal(events.find(e=>e.id==='a:error').defaultOpen,false);
 assert.equal(events.find(e=>e.id==='a:t').detail.output,'Step interrupted');
});
