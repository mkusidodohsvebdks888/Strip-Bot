'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createModelMetrics,historicalMetrics}=require('../backend/agent/model-metrics.cjs');
const {readEvents}=require('../backend/agent/event-stream.cjs');

test('real event timing uses per-request boundaries, final engine usage and estimated visible throughput',()=>{
  let time=0;const meter=createModelMetrics({now:()=>time,wall:()=>10000+time});
  meter.begin('ses_a','gpt-test','CC Switch');
  const emit=(type,data={})=>meter.event({type,data:{sessionID:'ses_a',assistantMessageID:'m1',...data}});
  emit('session.step.started',{started:10000});
  time=500;emit('session.reasoning.delta',{delta:'PRIVATE_REASONING'});
  time=900;emit('session.text.delta',{delta:'你好'});
  time=1900;emit('session.text.delta',{delta:'abcd'});
  let value=meter.snapshot('ses_a',[]);assert.equal(value.ttftMs,500);assert.equal(value.tokensPerSecond,3);assert.equal(value.outputTokens,3);assert.equal(value.source,'observed');
  time=2000;emit('session.step.streamed');
  time=60000;emit('session.step.ended',{tokens:{input:12,output:9,reasoning:20,cache:{read:8,write:0}}});
  value=meter.snapshot('ses_a',[]);assert.equal(value.elapsedMs,2000);assert.equal(value.tokensPerSecond,3);assert.equal(value.outputTokens,9);assert.equal(value.inputTokens,20);assert.equal(value.source,'engine');assert.ok(!JSON.stringify(value).includes('PRIVATE_REASONING'));
  // The next tool-follow-up request resets timing and counts.
  emit('session.step.started',{assistantMessageID:'m2',started:70000});
  value=meter.snapshot('ses_a',[]);assert.equal(value.outputTokens,null);assert.equal(value.ttftMs,null);assert.equal(value.tokensPerSecond,null);
});

test('metric sessions, event IDs, missing usage, disconnections and interruptions remain distinct',()=>{
  let time=0;const meter=createModelMetrics({now:()=>time,wall:()=>time});
  meter.begin('a','a','API');meter.begin('b','b','API');
  const event={id:'e1',type:'session.step.started',data:{sessionID:'a',assistantMessageID:'m',started:0}};
  meter.event(event);time=100;meter.event({id:'e2',type:'session.text.delta',data:{sessionID:'a',assistantMessageID:'m',delta:'abcd'}});meter.event(event);
  assert.equal(meter.snapshot('a',[]).outputTokens,1);assert.equal(meter.snapshot('b',[]).outputTokens,null);
  meter.event({type:'session.text.delta',data:{sessionID:'a',assistantMessageID:'old',delta:'wrong'}});assert.equal(meter.snapshot('a',[]).outputTokens,1);
  time=1000;meter.disconnect();const partial=meter.snapshot('a',[]);assert.equal(partial.source,'partial');assert.equal(partial.tokensPerSecond,null);assert.equal(partial.ttftMs,null);assert.deepEqual(partial.history,[]);
  meter.finish('a');assert.equal(meter.snapshot('a',[]).status,'error');
});

test('historical usage never fabricates TTFT, speed or trend; new requests never inherit prior usage',()=>{
  const messages=[{id:'old',type:'assistant',model:{id:'gpt-test'},time:{created:10,streamed:200,completed:5000},tokens:{input:50,output:20,cache:{read:5}}}];
  const previous=historicalMetrics(messages,'x','OpenCode');assert.equal(previous.outputTokens,20);assert.equal(previous.inputTokens,55);assert.equal(previous.elapsedMs,190);assert.equal(previous.ttftMs,null);assert.equal(previous.tokensPerSecond,null);assert.deepEqual(previous.history,[]);
  const meter=createModelMetrics({now:()=>1000,wall:()=>1000});meter.begin('a','new','OpenCode');assert.equal(meter.snapshot('a',messages).outputTokens,null);
  const updated=meter.snapshot('a',[{id:'new',type:'assistant',time:{created:1000,streamed:1100},tokens:{input:6,output:2}}]);assert.equal(updated.outputTokens,2);assert.equal(updated.source,'partial');assert.equal(updated.tokensPerSecond,null);
  assert.equal(historicalMetrics([{type:'assistant'}],'x','API').outputTokens,null);
});

test('SSE parser preserves split UTF-8, CRLF frames, comments and fragmented JSON',async()=>{
  const expected={id:'e',type:'session.text.delta',data:{sessionID:'a',delta:'你好'}};
  const bytes=Buffer.from(': heartbeat\r\n\r\ndata: '+JSON.stringify(expected)+'\r\n\r\n');
  const received=[];await readEvents((async function*(){for(const byte of bytes)yield Buffer.from([byte]);})(),event=>received.push(event));assert.deepEqual(received,[expected]);
  await assert.rejects(readEvents((async function*(){yield Buffer.from('data: bad\n\n');})(),()=>{}),/Malformed/);
});

test('Agent snapshots expose only metrics for owned sessions and use the native event subscription',async t=>{
  const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
  const {createAgentService}=require('../backend/agent/service.cjs');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-meter-service-'));
  let emit,subscriptions=0;const started=Date.now();
  const factory=()=>({executable:__filename,ensure:async()=>{},close:async()=>{},subscribe:async callback=>{emit=callback;subscriptions++;},request:async(route)=>{
    if(route==='/api/session/active')return {data:{}};
    if(route==='/api/session')return {data:{id:'ses_meter',title:'fixture'}};
    if(route.endsWith('/prompt')){
      for(const [type,extra] of [['session.step.started',{started}],['session.text.delta',{delta:'OK'}],['session.step.streamed',{}],['session.step.ended',{tokens:{input:10,output:2}}]])emit({type,data:{sessionID:'ses_meter',assistantMessageID:'m',...extra}});
      return {data:{}};
    }
    if(route.includes('/message'))return {data:[{id:'m',type:'assistant',time:{created:started,streamed:Date.now()},tokens:{input:10,output:2}}]};
    return {data:[]};
  }});
  const agent=createAgentService({root,workspaceBase:root,engineFactory:factory});t.after(async()=>{await agent.close();await fs.rm(root,{recursive:true,force:true});});
  await agent.handle('POST','/sessions',{workspace:root,configuration:{provider:'responses',connection:'ccswitch',endpoint:'http://127.0.0.1:15721/v1/responses',model:'gpt-test'}});
  await agent.handle('POST','/sessions/ses_meter/prompt',{text:'hello'});
  const result=await agent.handle('GET','/sessions/ses_meter');assert.equal(result.metrics.source,'engine');assert.equal(result.metrics.outputTokens,2);assert.equal(result.metrics.inputTokens,10);assert.equal(result.metrics.provider,'CC Switch');assert.equal(subscriptions,1);
  await assert.rejects(agent.handle('GET','/sessions/ses_foreign'),{status:404});
});
