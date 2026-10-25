'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {Writable,PassThrough}=require('node:stream');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createEngine,customProvider}=require('../backend/agent/codex-engine.cjs');

function mockProcess(log,exitCode=0) {
  return function mockSpawn(command,args){
    log.push({command,args});
    const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;child.killed=false;
    child.kill=()=>{child.killed=true;child.exitCode=0;child.emit('close',0);};
    let buffer='',approvalId=100;
    const emit=m=>setImmediate(()=>child.stdout.write(JSON.stringify(m)+'\n'));
    const handle=m=>{
      log.push({request:m});
      if(!m.method)return;
      if(!m.id)return;
      let result={};
      if(m.method==='model/list')result={data:[{id:'gpt-codex',model:'gpt-codex',displayName:'Codex test',supportedReasoningEfforts:[{reasoningEffort:'low'},{reasoningEffort:'high'}]}]};
      if(m.method==='thread/start')result={thread:{id:'thr_local_123'}};
      if(m.method==='thread/resume')result={thread:{id:'thr_local_123'}};
      if(m.method==='turn/start'){
        result={turn:{id:'turn_local',status:'inProgress'}};
        emit({method:'item/started',params:{threadId:'thr_local_123',turnId:'turn_local',item:{id:'item_1',type:'commandExecution',command:'npm test',cwd:m.params.cwd,status:'inProgress',exitCode:null}}});
        emit({id:approvalId++,method:'item/commandExecution/requestApproval',params:{threadId:'thr_local_123',turnId:'turn_local',itemId:'item_1',reason:'测试允许执行',command:'npm test',cwd:m.params.cwd}});
      }
      emit({id:m.id,result});
    };
    child.stdin=new Writable({write(chunk,_,done){buffer+=chunk.toString('utf8');let pos;while((pos=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,pos);buffer=buffer.slice(pos+1);const m=JSON.parse(line);if(m.id&&!m.method){log.push({reply:m});if(m.result?.decision==='accept'){
      emit({method:'item/commandExecution/outputDelta',params:{threadId:'thr_local_123',itemId:'item_1',delta:'ok\n'}});
      emit({method:'item/completed',params:{threadId:'thr_local_123',item:{id:'item_1',type:'commandExecution',command:'npm test',cwd:os.tmpdir(),status:'completed',aggregatedOutput:'ok\n',exitCode}}});
      emit({method:'item/agentMessage/delta',params:{threadId:'thr_local_123',itemId:'item_reply',delta:'测试完成'}});
      emit({method:'item/completed',params:{threadId:'thr_local_123',item:{id:'item_reply',type:'agentMessage',text:'测试完成'}}});
      emit({method:'turn/completed',params:{threadId:'thr_local_123',turn:{id:'turn_local',status:'completed'}}});
    }}else handle(m);}done();}});
    return child;
  };
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async fn=>{for(let i=0;i<100;i++){const value=await fn();if(value)return value;await delay(10);}throw new Error('mock timed out');};

test('Codex app-server bridge keeps sessions, approvals, tool events and model list',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-codex-test-'));const bin=path.join(root,'codex-test-bin');await fs.writeFile(bin,'mock');
  t.after(async()=>fs.rm(root,{recursive:true,force:true}));
  const calls=[];const engine=createEngine({root,executable:bin,spawnProcess:mockProcess(calls),provider:'codex'});t.after(()=>engine.close());
  const models=(await engine.request('/api/model')).data;
  assert.equal(models[0].providerID,'openai');assert.equal(models[0].variants[1].settings.reasoningEffort,'high');
  const create=await engine.request('/api/session',{title:'迁移测试',location:{directory:root},model:{id:'gpt-codex',providerID:'openai'}});
  const id=create.data.id;assert.match(id,/^ses_[a-f0-9]{20}$/);
  await engine.request('/api/session/'+id+'/prompt',{text:'执行 npm test'});
  const permission=await until(async()=>{const r=await engine.request('/api/session/'+id+'/permission');return r.data[0];});
  assert.equal(permission.action,'shell');assert.equal(permission.resources[0],'npm test');
  const pendingMessages=(await engine.request(`/api/session/${id}/message`)).data;
  assert.equal(pendingMessages[0].content[0].state.status,'running');
  assert.equal(pendingMessages[0].content[0].state.error,undefined);
  await engine.request(`/api/session/${id}/permission/${permission.id}/reply`,{decision:'once'});
  await until(async()=>Object.keys((await engine.request('/api/session/active')).data).length===0);
  const messages=(await engine.request(`/api/session/${id}/message?limit=100`)).data;
  assert.equal(messages[0].type,'assistant');assert.equal(messages[0].text,'测试完成');
  assert.equal(messages[0].content[0].state.status,'completed');
  assert.equal(messages[0].content[0].state.error,undefined);
  assert.match(messages[0].content[0].state.content,/ok/);
  assert.equal(messages[1].text,'执行 npm test');
  assert.equal(calls.filter(call=>call.reply?.result?.decision==='accept').length,1);
  await engine.close();
  const saved=JSON.parse(await fs.readFile(path.join(root,'.runtime','codex-sessions',id+'.json'),'utf8'));
  assert.equal(saved.threadId,'thr_local_123');assert.equal(saved.active,false);
  assert.equal(calls.find(call=>call.request?.method==='turn/start').request.params.approvalPolicy,'on-request');
  saved.messages[0].content[0].state.error='Exit code: null';
  await fs.writeFile(path.join(root,'.runtime','codex-sessions',id+'.json'),JSON.stringify(saved));
  // A persisted thread belongs to the old process and must be resumed in the new one.
  const restarted=createEngine({root,executable:bin,spawnProcess:mockProcess(calls),provider:'codex'});
  t.after(()=>restarted.close());
  assert.equal((await restarted.request(`/api/session/${id}/message`)).data[0].content[0].state.error,undefined);
  await restarted.request('/api/session/'+id+'/prompt',{text:'继续'});
  assert.equal(calls.filter(call=>call.request?.method==='thread/resume').length,1);
});

test('a real nonzero command exit remains an error',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-codex-exit-'));const bin=path.join(root,'mock-bin');await fs.writeFile(bin,'mock');
  const engine=createEngine({root,executable:bin,spawnProcess:mockProcess([],2),provider:'codex'});
  t.after(async()=>{await engine.close();await fs.rm(root,{recursive:true,force:true});});
  const id=(await engine.request('/api/session',{location:{directory:root}})).data.id;
  await engine.request(`/api/session/${id}/prompt`,{text:'command'});
  const permission=await until(async()=>(await engine.request(`/api/session/${id}/permission`)).data[0]);
  await engine.request(`/api/session/${id}/permission/${permission.id}/reply`,{decision:'once'});
  await until(async()=>!(await engine.request('/api/session/active')).data[id]);
  const tool=(await engine.request(`/api/session/${id}/message`)).data[0].content[0];
  assert.equal(tool.state.status,'error');assert.equal(tool.state.error,'Exit code: 2');
});

test('custom Codex provider accepts local Responses or Chat Completions endpoints',()=>{
  assert.equal(customProvider('http://127.0.0.1:5000/v1/responses','responses','my-model','abc').baseUrl,'http://127.0.0.1:5000/v1');
  assert.equal(customProvider('http://127.0.0.1:5000/v1/chat/completions','openai','model','x').mode,'chat');
  assert.throws(()=>customProvider('https://example.com/v1/responses','responses','model','x'),{status:400});
  assert.equal(customProvider('', 'codex', '', ''),null);
});
