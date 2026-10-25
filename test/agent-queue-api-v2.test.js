'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createAgentService}=require('../backend/agent/service.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<150;i++){const value=await fn();if(value)return value;await sleep(10);}throw Error('Timed out waiting for async queue state');}

test('agent API accepts new commands during execution, exposes pause/resume/cancel and snapshots',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-agent-api-'));
  const events=[];const prompts=[];let id=0,listener;
  const engine={
    ensure:async()=>{},close:async()=>{},subscribe:async callback=>{listener=callback;return()=>{listener=undefined;}},
    request:async(route,body,method)=>{
      if(route==='/api/model')return {data:[{id:'openai/gpt-x',providerID:'openai',modelID:'gpt-x',enabled:true}]};
      if(route==='/api/session')return {data:{id:'ses_apitest'+(++id),title:'API v2 task'}};
      if(route==='/api/session/active')return {data:{}};
      if(route.endsWith('/prompt')){prompts.push({route,text:body.text});return {data:{started:true}};}
      if(route.endsWith('/interrupt'))return {data:{stopped:true}};
      if(route.includes('/message'))return {data:[]};
      if(route.endsWith('/form')||route.endsWith('/permission')||route.endsWith('/diff'))return {data:[]};
      return {data:{ok:true}};
    }
  };
  const service=createAgentService({root,workspaceBase:root,engine,provider:'codex',connection:'codex'});
  t.after(async()=>{await service.close();await fs.rm(root,{recursive:true,force:true});});
  const created=await service.handle('POST','/sessions',{workspace:root,model:{providerID:'openai',id:'gpt-x'}});
  const sessionID=created.session.id;
  const p1=await service.handle('POST',`/sessions/${sessionID}/prompt`,{text:'Task A',provider:'codex'});
  const p2=await service.handle('POST',`/sessions/${sessionID}/prompt`,{text:'Task B',provider:'codex'});
  assert.equal(p1.accepted,true);assert.equal(p2.accepted,true);
  await until(()=>prompts.length===1);
  assert.equal(prompts[0].text,'Task A');
  let snap=await service.handle('GET',`/sessions/${sessionID}`);
  assert.equal(snap.tasks.length,2);assert.equal(snap.queueCount,1);
  const overview=await service.handle('GET','/tasks');
  assert.equal(overview.activeCount,1);
  await service.handle('POST',`/sessions/${sessionID}/pause`,{});
  snap=await service.handle('GET',`/sessions/${sessionID}`);
  assert.equal(snap.queuePaused,true);assert.equal(snap.tasks[0].status,'paused');
  assert.equal(snap.tasks[1].status,'queued');
  const resumed=await service.handle('POST',`/sessions/${sessionID}/resume`,{});
  assert.equal(resumed.paused,false);
  await until(()=>prompts.length===2);
  assert.match(prompts[1].text,/检查当前工作区/);
  listener?.({type:'session.turn.completed',data:{sessionID,status:'completed'}});
  await until(()=>prompts.length===3);
  assert.equal(prompts[2].text,'Task B');
  await service.handle('POST',`/sessions/${sessionID}/tasks/${p2.task.id}/cancel`,{});
  const done=await service.handle('GET',`/sessions/${sessionID}/tasks`);
  assert.deepEqual(done.tasks.map(task=>task.status),['done','cancelled']);
  await assert.rejects(service.handle('POST',`/sessions/${sessionID}/tasks/${p1.task.id.slice(0,-1)}a/cancel`,{}),{status:404});
  events.push('tested');assert.equal(events.length,1);
});
