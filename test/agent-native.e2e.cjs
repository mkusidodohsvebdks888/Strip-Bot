'use strict';
// The model is deterministic; OpenCode, permissions and filesystem/shell are real.
const http = require('node:http'),fs = require('node:fs/promises'),path = require('node:path'),assert = require('node:assert/strict');
const {createEngine} = require('../backend/agent/engine.cjs');
const {createAgentService} = require('../backend/agent/service.cjs');
const root = path.resolve(__dirname,'..');
const responses = process.argv.includes('--responses');
const ui = process.argv.includes('--ui');
const workspace = path.join(root,'.runtime',ui ? 'unified-ui-acceptance':responses ? 'agent-responses-acceptance':'agent-native-acceptance');
const input = path.join(workspace,'input.txt'),output = path.join(workspace,'result.txt');
const plan = [
  {name:'read',arguments:{path:input}},
  {name:'write',arguments:{path:output,content:'Strip Bot native agent created this file.\n'}},
  {name:'edit',arguments:{path:output,oldString:'created',newString:'updated'}},
  {name:'read',arguments:{path:output}},
  {name:'shell',arguments:{command:'echo STRIP_AGENT_TERMINAL_OK',workdir:workspace}},
];
let engine,step = 0,approvals = [],lastState;
const mock = http.createServer(async (req,res) => {
  let raw = '';for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw),hasTools = body.tools?.length;
  const call = hasTools ? plan[step] : undefined;
  if (call) assert.ok(body.tools.some(t => (t.function?.name || t.name) === call.name),'Requested tool must actually be available');
  if (responses) {
    assert.equal(req.url,'/v1/responses');
    const index = step, id = 'resp_acceptance_'+index;
    const item = call ? {type:'function_call',id:'fc_'+index,call_id:'call_acceptance_'+index,name:call.name,arguments:JSON.stringify(call.arguments),status:'completed'} : {type:'message',id:'msg_'+index,role:'assistant',status:'completed',content:[{type:'output_text',text:'Native execution acceptance complete.',annotations:[]}]};
    if (call) step++;
    const response = {id,object:'response',model:'acceptance',status:'completed',output:[item],usage:{input_tokens:10,output_tokens:10,total_tokens:20}};
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    let sequence_number=0;
    const emit = (type,data) => res.write(`event: ${type}\ndata: ${JSON.stringify({type,sequence_number:sequence_number++,...data})}\n\n`);
    emit('response.created',{response:{...response,status:'in_progress',output:[]}});
    emit('response.output_item.added',{output_index:0,item:call ? {...item,arguments:'',status:'in_progress'}:{...item,content:[],status:'in_progress'}});
    if (call) {
      emit('response.function_call_arguments.delta',{output_index:0,item_id:item.id,delta:item.arguments});
      emit('response.function_call_arguments.done',{output_index:0,item_id:item.id,arguments:item.arguments});
    } else {
      emit('response.content_part.added',{output_index:0,item_id:item.id,content_index:0,part:{type:'output_text',text:'',annotations:[]}});
      emit('response.output_text.delta',{output_index:0,item_id:item.id,content_index:0,delta:item.content[0].text});
      emit('response.output_text.done',{output_index:0,item_id:item.id,content_index:0,text:item.content[0].text});
      emit('response.content_part.done',{output_index:0,item_id:item.id,content_index:0,part:item.content[0]});
    }
    emit('response.output_item.done',{output_index:0,item});emit('response.completed',{response});res.end();return;
  }
  const delta = call ? {role:'assistant',tool_calls:[{index:0,id:'call_acceptance_'+step,type:'function',function:{name:call.name,arguments:JSON.stringify(call.arguments)}}]} : {role:'assistant',content:'Native execution acceptance complete.'};
  if (call) step++;
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  res.write('data: '+JSON.stringify({id:'mock_'+step,object:'chat.completion.chunk',created:1,model:'acceptance',choices:[{index:0,delta,finish_reason:null}]})+'\n\n');
  res.end('data: '+JSON.stringify({id:'mock_'+step,object:'chat.completion.chunk',created:1,model:'acceptance',choices:[{index:0,delta:{},finish_reason:call ? 'tool_calls':'stop'}],usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20}})+'\n\ndata: [DONE]\n\n');
});
(async () => {
  await fs.mkdir(workspace,{recursive:true});await fs.writeFile(input,'Native engine must read this acceptance file.\n');
  await new Promise(resolve => mock.listen(0,'127.0.0.1',resolve));
  engine = createEngine({root,provider:responses ? 'responses':'openai',endpoint:`http://127.0.0.1:${mock.address().port}/v1/${responses ? 'responses':'chat/completions'}`,model:'acceptance',dataDir:path.join(workspace,'engine-data')});
  const endpoint = `http://127.0.0.1:${mock.address().port}/v1/${responses ? 'responses':'chat/completions'}`;
  const agent = createAgentService({root:workspace,workspaceBase:workspace,engine,executable:engine.executable,...ui ? {endpoint,model:'acceptance',provider:responses ? 'responses':'openai',connection:'ccswitch'}:{}});
  if (ui) {
    const {createGateway} = require('../backend/gateway.cjs');
    const ccSwitch = {endpoint,resolve:async()=>({endpoint,model:'acceptance',provider:responses ? 'responses':'openai',apiKey:'PROXY_MANAGED'}),status:async()=>({reachable:true,healthy:true,connection:'ready',endpoint,codex:{found:true,model:'acceptance',provider:'deterministic-fixture',routesThroughCcSwitch:true},note:'Local deterministic test fixture; not a real model.'})};
    const gateway = createGateway({agentService:agent,ccOnly:true,ccSwitch});
    await new Promise(resolve=>gateway.listen(3061,'127.0.0.1',resolve));
    console.log('Unified UI fixture: http://127.0.0.1:3061/ (real engine, simulated model)');
    await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
    gateway.closeAllConnections();await new Promise(resolve=>gateway.close(resolve));return;
  }
  const {session} = await agent.handle('POST','/sessions',{workspace,model:{providerID:'strip-local',id:'acceptance'},title:'Native file and terminal acceptance'});
  await agent.handle('POST',`/sessions/${session.id}/prompt`,{text:'Read input.txt, create result.txt, replace created with updated, read it again, then echo STRIP_AGENT_TERMINAL_OK. Only use the acceptance workspace.'});
  const deadline = Date.now()+60000;
  while (Date.now() < deadline) {
    const state = await agent.handle('GET',`/sessions/${session.id}`);lastState = state;
    for (const permission of state.permissions) {
      // Approval is scoped to this synthetic acceptance session and known actions.
      assert.equal(permission.sessionID,session.id);
      console.log('Approval:',permission.action,JSON.stringify(permission.resources));
      const evidence = JSON.stringify(permission);
      assert.ok(evidence.includes('agent-native-acceptance') || evidence.includes('STRIP_AGENT_TERMINAL_OK') || permission.resources.every(r => ['input.txt','result.txt'].includes(r)),'Unexpected permission target');
      approvals.push({action:permission.action,resources:permission.resources});
      await agent.handle('POST',`/sessions/${session.id}/permissions`,{requestID:permission.id,decision:'once'});
    }
    const tools = state.messages.flatMap(m => m.content || []).filter(p => p.type === 'tool');
    if (tools.some(t => t.state?.status === 'error')) throw new Error('Tool failed: '+JSON.stringify(tools.filter(t => t.state?.status === 'error')));
    if (tools.length >= plan.length && tools.every(t => t.state.status === 'completed') && !state.running) {
      const content = await fs.readFile(output,'utf8');
      assert.equal(content,'Strip Bot native agent updated this file.\n');
      assert.ok(JSON.stringify(tools.find(t => t.name === 'shell')).includes('STRIP_AGENT_TERMINAL_OK'));
      assert.ok(approvals.length > 0,'Permissions must be exercised');
      const report = {engine:'OpenCode 2.0.28',model:'deterministic local mock',sessionID:session.id,tools:tools.map(t => ({name:t.name,status:t.state.status})),approvals,actualFile:output,actualContent:content,passed:true};
      await fs.writeFile(path.join(workspace,'verification.json'),JSON.stringify(report,null,2));
      console.log(JSON.stringify(report,null,2));return;
    }
    await new Promise(resolve => setTimeout(resolve,300));
  }
  throw new Error('Native acceptance timed out: '+JSON.stringify(lastState));
})().catch(async error => {console.error(error.message);if (lastState) await fs.writeFile(path.join(workspace,'failed-snapshot.json'),JSON.stringify(lastState,null,2));process.exitCode=1;}).finally(async () => {await engine?.close();mock.closeAllConnections();mock.close();});
