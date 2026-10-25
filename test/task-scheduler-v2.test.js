'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createTaskScheduler,overlaps}=require('../backend/agent/task-scheduler.cjs');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('pause keeps overlapping workspace locked until interruption completes, including a pending launch',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-pause-lock-'));
  let launchReady, interrupted, finishInterrupt;
  const startGate=new Promise(r=>{launchReady=r;});
  const stopGate=new Promise(r=>{finishInterrupt=r;});
  const calls=[];
  const scheduler=createTaskScheduler({root,getEngine:()=>({request:async(route)=>{
    calls.push(route);
    if(route.endsWith('/interrupt')){interrupted=true;await stopGate;}
  }}),onBeforeStart:async task=>{if(task.sessionID==='ses_a')await startGate;}});
  t.after(async()=>{launchReady();finishInterrupt();await scheduler.close();await fs.rm(root,{recursive:true,force:true});});
  await scheduler.submit({sessionID:'ses_a',workspace:root,text:'first'});
  await until(async()=>(await scheduler.state('ses_a')).running);
  const pausing=scheduler.pause('ses_a');
  await scheduler.submit({sessionID:'ses_b',workspace:path.join(root,'nested'),text:'second'});
  await sleep(25);assert.equal(calls.length,0);
  launchReady();await until(()=>interrupted);
  assert.equal((await scheduler.state('ses_a')).running,true);
  assert.equal((await scheduler.state('ses_b')).running,false);
  finishInterrupt();await pausing;
  await until(()=>calls.some(route=>route.includes('/ses_b/prompt')));
  assert.equal((await scheduler.state('ses_a')).tasks[0].status,'paused');
});
async function until(fn){for(let i=0;i<100;i++){const value=await fn();if(value)return value;await sleep(10);}throw Error('timeout');}
function setup(root,maxParallel=3){
  const calls=[];const active=new Set();let scheduler;
  const engine={request:async(route,body)=>{
    calls.push({route,body});const m=/\/ses_([^/]+)\/(prompt|interrupt)$/.exec(route);
    if(m){if(m[2]==='prompt')active.add(m[1]);else active.delete(m[1]);}
    return {data:{started:true}};
  }};
  scheduler=createTaskScheduler({root,getEngine:()=>engine,maxParallel});
  const submit=(sessionID,workspace,text)=>scheduler.submit({sessionID,workspace,text});
  const complete=(sessionID,status='completed')=>scheduler.onEvent({type:'session.turn.completed',data:{sessionID,status}});
  return {scheduler,calls,submit,complete};
}

test('queue dispatches in order within a session, parallel across disjoint workspaces',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-queue-'));
  const a=path.join(root,'a'),b=path.join(root,'b');await Promise.all([fs.mkdir(a),fs.mkdir(b)]);
  const {scheduler,submit,calls,complete}=setup(root,2);t.after(async()=>{await scheduler.close();await fs.rm(root,{recursive:true,force:true});});
  await submit('ses_a',a,'step 1');await submit('ses_a',a,'step 2');await submit('ses_b',b,'other');
  await until(()=>calls.filter(x=>x.route.endsWith('/prompt')).length===2);
  assert.deepEqual(calls.filter(x=>x.route.endsWith('/prompt')).map(x=>x.body.text),['step 1','other']);
  complete('ses_a');
  await until(()=>calls.filter(x=>x.route.endsWith('/prompt')).length===3);
  assert.equal(calls.filter(x=>x.route.endsWith('/prompt'))[2].body.text,'step 2');
  complete('ses_a');complete('ses_b');
  await until(async()=>!(await scheduler.overview()).activeCount);
  assert.equal((await scheduler.state('ses_a')).tasks.every(x=>x.status==='done'),true);
});

test('workspace overlap blocks parallel writes even in separate sessions',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-conflict-'));
  const a=path.join(root,'same');await fs.mkdir(a);const {scheduler,submit,calls,complete}=setup(root,3);t.after(async()=>{await scheduler.close();await fs.rm(root,{recursive:true,force:true});});
  assert.equal(overlaps(a,path.join(a,'sub')),true);assert.equal(overlaps(a,path.join(root,'independent')),false);
  await submit('ses_a',a,'write first');await submit('ses_b',a,'write second');
  await until(()=>calls.filter(x=>x.route.endsWith('/prompt')).length===1);
  await sleep(30);assert.equal(calls.filter(x=>x.route.endsWith('/prompt')).length,1);
  complete('ses_a');await until(()=>calls.filter(x=>x.route.endsWith('/prompt')).length===2);
  complete('ses_b');
});

test('pause interrupts current turn, persists queue and resumes using a checkpoint-aware new turn',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-pause-'));
  const workspace=path.join(root,'project');await fs.mkdir(workspace);
  const {scheduler,submit,calls,complete}=setup(root,2);t.after(async()=>{await scheduler.close();await fs.rm(root,{recursive:true,force:true});});
  const first=await submit('ses_a',workspace,'update README');await submit('ses_a',workspace,'run unit tests');
  await until(()=>calls.some(x=>x.route.endsWith('/prompt')));
  await scheduler.pause('ses_a');
  let state=await scheduler.state('ses_a');assert.equal(state.paused,true);
  assert.equal(state.tasks[0].status,'paused');assert.equal(state.tasks[1].status,'queued');
  assert.equal(calls.filter(x=>x.route.endsWith('/interrupt')).length,1);
  await sleep(20);assert.equal(calls.filter(x=>x.route.endsWith('/prompt')).length,1);
  await scheduler.resume('ses_a');
  await until(()=>calls.filter(x=>x.route.endsWith('/prompt')).length===2);
  assert.match(calls.filter(x=>x.route.endsWith('/prompt'))[1].body.text,/检查当前工作区/);
  complete('ses_a');await until(()=>calls.filter(x=>x.route.endsWith('/prompt')).length===3);
  assert.equal(calls.filter(x=>x.route.endsWith('/prompt'))[2].body.text,'run unit tests');
  complete('ses_a');state=await scheduler.state('ses_a');assert.equal(state.tasks[0].id,first.task.id);
});

test('individual cancellation, stop and ownership errors do not run rejected tasks',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-stop-'));
  const {scheduler,submit,calls}=setup(root,1);t.after(async()=>{await scheduler.close();await fs.rm(root,{recursive:true,force:true});});
  const first=await submit('ses_a',root,'A');const second=await submit('ses_a',root,'B');
  await until(()=>calls.filter(x=>x.route.endsWith('/prompt')).length===1);
  await assert.rejects(scheduler.cancel('ses_b',second.task.id),{status:404});
  await scheduler.cancel('ses_a',second.task.id);await scheduler.stop('ses_a');
  assert.equal((await scheduler.state('ses_a')).tasks[0].status,'cancelled');
  assert.equal((await scheduler.state('ses_a')).tasks[1].status,'cancelled');
  assert.equal((await scheduler.state('ses_a')).paused,true);
  await scheduler.resume('ses_a');await sleep(20);
  assert.equal(calls.filter(x=>x.route.endsWith('/prompt')).length,1);
  assert.equal(first.task.preview,'A');
});

test('restart never auto-runs an interrupted task; explicit resume is required',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-recover-'));
  const one=setup(root,1);await one.submit('ses_a',root,'modify files');
  await until(()=>one.calls.some(x=>x.route.endsWith('/prompt')));
  await one.scheduler.close();
  const two=setup(root,1);t.after(async()=>{await two.scheduler.close();await fs.rm(root,{recursive:true,force:true});});
  let state=await two.scheduler.state('ses_a');assert.equal(state.tasks[0].status,'paused');
  assert.equal(state.paused,true);await sleep(25);assert.equal(two.calls.length,0);
  await two.scheduler.resume('ses_a');await until(()=>two.calls.some(x=>x.route.endsWith('/prompt')));
  assert.match(two.calls[0].body.text,/检查当前工作区/);two.complete('ses_a');
});

test('engine failure pauses later tasks and bounds active parallelism',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-fail-'));
  const {scheduler,submit,calls,complete}=setup(root,1);t.after(async()=>{await scheduler.close();await fs.rm(root,{recursive:true,force:true});});
  await submit('ses_a',root,'failing task');await submit('ses_a',root,'next task');
  await until(()=>calls.length===1);complete('ses_a','failed');
  await sleep(25);let state=await scheduler.state('ses_a');
  assert.equal(state.paused,true);assert.equal(state.tasks[0].status,'failed');
  assert.equal(state.tasks[1].status,'queued');assert.equal(calls.length,1);
  await scheduler.resume('ses_a');await until(()=>calls.length===2);complete('ses_a');
});
