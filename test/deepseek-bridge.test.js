'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {startBridge,responsesToChat,responseFromChat} = require('../backend/agent/deepseek-bridge.cjs');
const {createEngine,customProvider}=require('../backend/agent/codex-engine.cjs');
const {EventEmitter}=require('node:events');
const {PassThrough,Writable}=require('node:stream');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs/promises');

async function fakeServer(handler) {
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const data of req)raw+=data;
    const value={req, body:JSON.parse(raw||'{}')};requests.push(value);
    handler(value,res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/chat/completions`,requests,close:()=>new Promise(resolve=>server.close(resolve))};
}
async function callBridge(bridge,body,{token=bridge.token,method='POST'}={}) {
  return fetch(bridge.baseUrl+'/responses',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
}
function sendJson(res,obj,status=200) {
  res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));
}
function streamChunks(res,chunks) {
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  for(const chunk of chunks)res.write('data: '+JSON.stringify(chunk)+'\n\n');
  res.end('data: [DONE]\n\n');
}
function collectEvents(text) {
  return text.split(/\n\n/).filter(Boolean).map(part=>JSON.parse(part.split('\n').find(line=>line.startsWith('data:')).slice(5).trim()));
}

test('chat fallback converts ordinary content and function tool calls; validates auth', async t=>{
  const fake=await fakeServer(({req,body},res)=>sendJson(res,{id:'chat_1',choices:[{index:0,finish_reason:'tool_calls',message:{role:'assistant',content:'准备运行',tool_calls:[{id:'call_abc',type:'function',function:{name:'shell',arguments:'{"cmd":"echo hi"}'}}]}}],usage:{prompt_tokens:11,completion_tokens:5,total_tokens:16}}));
  t.after(()=>fake.close());
  const bridge=await startBridge({upstreamUrl:fake.url,upstreamKey:'fake-upstream-secret',model:'deepseek-flash'});t.after(()=>bridge.close());
  const unauthorized=await callBridge(bridge,{model:'deepseek-flash',input:'Hi'},{token:'wrong'});
  assert.equal(unauthorized.status,401);
  const response=await callBridge(bridge,{model:'deepseek-flash',input:[{role:'user',content:[{type:'input_text',text:'帮我执行测试'}]}],tools:[{type:'function',name:'shell',description:'run command',parameters:{type:'object',properties:{cmd:{type:'string'}}}}]});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.output[0].content[0].text,'准备运行');
  assert.equal(body.output[1].type,'function_call');
  assert.equal(body.output[1].call_id,'call_abc');
  assert.deepEqual(body.usage,{input_tokens:11,output_tokens:5,total_tokens:16,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}});
  assert.equal(fake.requests.length,1);
  assert.equal(fake.requests[0].req.headers.authorization,'Bearer fake-upstream-secret');
  assert.equal(fake.requests[0].body.thinking.type,'disabled');
  assert.equal(fake.requests[0].body.tools[0].function.name,'shell');
});

test('Chat stream translates text and partial tool arguments into Responses SSE',async t=>{
  const fake=await fakeServer((_,res)=>streamChunks(res,[
    {choices:[{delta:{role:'assistant',content:'你'},finish_reason:null}]},
    {choices:[{delta:{content:'好',tool_calls:[{index:0,id:'call_123',type:'function',function:{name:'get_info',arguments:'{"id"'}}]},finish_reason:null}]},
    {choices:[{delta:{tool_calls:[{index:0,function:{arguments:':42}'}}]},finish_reason:null}]},
    {choices:[{delta:{},finish_reason:'tool_calls'}]},
    {choices:[],usage:{prompt_tokens:12,completion_tokens:8,total_tokens:20}},
  ]));t.after(()=>fake.close());
  const bridge=await startBridge({upstreamUrl:fake.url,upstreamKey:'key',model:'deepseek-flash'});t.after(()=>bridge.close());
  const response=await callBridge(bridge,{model:'deepseek-flash',input:'Hi',stream:true,tools:[{type:'function',name:'get_info',parameters:{type:'object',properties:{id:{type:'integer'}}}}]});
  assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const events=collectEvents(await response.text());
  assert.equal(events[0].type,'response.created');
  assert.equal(events.at(-1).type,'response.completed');
  assert.equal(events.filter(e=>e.type==='response.output_text.delta').map(e=>e.delta).join(''),'你好');
  assert.equal(events.filter(e=>e.type==='response.function_call_arguments.delta').map(e=>e.delta).join(''),'{"id":42}');
  const tool=events.at(-1).response.output.find(item=>item.type==='function_call');
  assert.equal(tool.name,'get_info');assert.equal(tool.call_id,'call_123');
  assert.equal(events.at(-1).response.usage.total_tokens,20);
  assert.equal(events.every((event,i)=>event.sequence_number===i),true);
});

test('custom apply_patch is translated both directions, including tool return',async t=>{
  const fake=await fakeServer((_,res)=>sendJson(res,{choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id:'apply_1',function:{name:'apply_patch',arguments:JSON.stringify({patch:'*** Begin Patch\n*** End Patch'})}}]}}]}));t.after(()=>fake.close());
  const bridge=await startBridge({upstreamUrl:fake.url,upstreamKey:'key',model:'deepseek-flash'});t.after(()=>bridge.close());
  const response=await callBridge(bridge,{model:'deepseek-flash',input:'apply',tools:[{type:'custom',name:'apply_patch',description:'write changes'}]});
  const result=await response.json();
  assert.equal(result.output[0].type,'custom_tool_call');
  assert.equal(result.output[0].input,'*** Begin Patch\n*** End Patch');
  assert.equal(fake.requests[0].body.tools[0].function.name,'apply_patch');
  const followup=responsesToChat({model:'deepseek-flash',input:[{type:'custom_tool_call',name:'apply_patch',call_id:'apply_1',input:'*** Begin Patch\n*** End Patch'},{type:'custom_tool_call_output',call_id:'apply_1',output:'Success'},{role:'user',content:'Continue'}]},'deepseek-flash');
  assert.equal(followup.messages[0].tool_calls[0].id,'apply_1');
  assert.equal(followup.messages[1].role,'tool');
});

test('unsupported image and previous response are rejected instead of silently dropped',async t=>{
  const fake=await fakeServer((_,res)=>sendJson(res,{choices:[]}));t.after(()=>fake.close());
  const bridge=await startBridge({upstreamUrl:fake.url,upstreamKey:'key',model:'deepseek-flash'});t.after(()=>bridge.close());
  const image=await callBridge(bridge,{model:'deepseek-flash',input:[{role:'user',content:[{type:'input_image',image_url:'data:image/png;base64,AAAA'}]}]});
  assert.equal(image.status,422);
  const previous=await callBridge(bridge,{model:'deepseek-flash',input:'Hi',previous_response_id:'resp_1'});
  assert.equal(previous.status,422);
  const wrong=await callBridge(bridge,{model:'not-this-model',input:'Hi'});
  assert.equal(wrong.status,400);
  assert.equal(fake.requests.length,0);
});

test('upstream errors preserve HTTP status and no API credentials are returned',async t=>{
  const fake=await fakeServer((_,res)=>sendJson(res,{error:{message:'Invalid model'}},429));t.after(()=>fake.close());
  const bridge=await startBridge({upstreamUrl:fake.url,upstreamKey:'private-upstream-key',model:'deepseek-flash'});t.after(()=>bridge.close());
  const response=await callBridge(bridge,{model:'deepseek-flash',input:'Hi'});
  assert.equal(response.status,429);
  assert.doesNotMatch(await response.text(),/private-upstream-key/);
});

test('nonstream utility maps incomplete reason and usage',()=>{
  const result=responseFromChat({choices:[{finish_reason:'length',message:{role:'assistant',content:'partial'}}]},'deepseek-flash');
  assert.equal(result.status,'incomplete');assert.equal(result.incomplete_details.reason,'max_output_tokens');
});

test('Codex CLI adapter starts localhost chat-to-responses bridge without passing original API key to Codex',async t=>{
  const fake=await fakeServer((_,res)=>sendJson(res,{choices:[{finish_reason:'stop',message:{role:'assistant',content:'OK'}}]}));t.after(()=>fake.close());
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'stripbridge-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const binary=path.join(root,'fakecodex');await fs.writeFile(binary,'fake');
  const log=[];
  function spawnMock(command,args,opts){
    log.push({command,args,opts});
    const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;child.killed=false;
    child.kill=()=>{child.exitCode=0;child.killed=true;child.emit('close',0);};
    child.stdin=new Writable({write(chunk,_,callback){
      const data=JSON.parse(chunk.toString().trim());
      if(data.method==='initialize')setImmediate(()=>child.stdout.write(JSON.stringify({jsonrpc:'2.0',id:data.id,result:{}})+'\n'));
      callback();
    }});return child;
  }
  const engine=createEngine({root,endpoint:fake.url,provider:'openai',model:'deepseek-flash',apiKey:'private-upstream-key',spawnProcess:spawnMock,executable:binary});
  t.after(()=>engine.close());
  await engine.ensure();
  const args=log[0].args.join(' ');
  assert.match(args,/model_providers\.strip_local\.wire_api/);
  assert.match(args,/127\.0\.0\.1/);
  assert.equal(engine.bridgeInfo().mode,'chat-to-responses');
  assert.equal(engine.bridgeInfo().active,true);
  assert.notEqual(log[0].opts.env.STRIPBOT_AGENT_API_KEY,'private-upstream-key');
  const baseArg=log[0].args.find(x=>x.includes('model_providers.strip_local.base_url='));
  const baseUrl=JSON.parse(baseArg.split('=',2)[1]);
  const answer=await fetch(baseUrl+'/responses',{method:'POST',headers:{Authorization:'Bearer '+log[0].opts.env.STRIPBOT_AGENT_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'deepseek-flash',input:'hi'})});
  assert.equal((await answer.json()).status,'completed');
  await engine.close();assert.equal(engine.bridgeInfo().active,false);
});

test('local response native provider remains passthrough (no bridge port)',()=>{
  assert.equal(customProvider('http://127.0.0.1:5000/v1/responses','responses','deepseek-flash','x').mode,'native');
  assert.equal(customProvider('http://127.0.0.1:5000/v1/chat/completions','openai','deepseek-flash','x').mode,'chat');
  assert.throws(()=>customProvider('https://example.com/v1/responses','responses','deepseek-flash','x'),{status:400});
});

test('namespace tools with duplicate short names round-trip through distinct Chat aliases',async t=>{
  const tools=['alpha','beta'].map(name=>({type:'namespace',name,tools:[{type:'function',name:'lookup',parameters:{type:'object',properties:{}}}]}));
  const converted=responsesToChat({model:'deepseek-flash',input:'test',tools},'deepseek-flash');
  const aliases=converted.tools.map(tool=>tool.function.name);
  assert.notEqual(aliases[0],aliases[1]);assert.ok(aliases.every(name=>/^[a-zA-Z0-9_-]{1,64}$/.test(name)));
  const replay=responsesToChat({model:'deepseek-flash',tools,input:[{type:'function_call',namespace:'beta',name:'lookup',call_id:'call_ns',arguments:'{}'},{type:'function_call_output',call_id:'call_ns',output:'ok'}]},'deepseek-flash');
  assert.equal(replay.messages[0].tool_calls[0].function.name,aliases[1]);
  const fake=await fakeServer((_,res)=>streamChunks(res,[{choices:[{delta:{tool_calls:[{index:0,id:'call_ns',function:{name:aliases[1],arguments:'{}'}}]},finish_reason:'tool_calls'}]}]));t.after(()=>fake.close());
  const bridge=await startBridge({upstreamUrl:fake.url,upstreamKey:'key',model:'deepseek-flash'});t.after(()=>bridge.close());
  const events=collectEvents(await (await callBridge(bridge,{model:'deepseek-flash',input:'test',tools,stream:true})).text());
  const item=events.at(-1).response.output[0];assert.equal(item.namespace,'beta');assert.equal(item.name,'lookup');assert.equal(item.call_id,'call_ns');
});
