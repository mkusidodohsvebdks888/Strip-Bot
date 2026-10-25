'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createEngine}=require('../backend/agent/engine.cjs');
const {createAgentService}=require('../backend/agent/service.cjs');

test('grep permission without literal remains JSON-valid and can be approved',{timeout:30000},async t=>{
  const root=path.resolve(__dirname,'..');
  const workspace=path.join(root,'.runtime','grep-permission-repro');
  const input=path.join(workspace,'input.txt');
  let step=0, engine, mock;
  t.after(async()=>{await engine?.close();mock?.closeAllConnections?.();mock?.close?.();});

  mock=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=JSON.parse(raw||'{}');
    const tool=step===0&&body.tools?.length?{name:'grep',arguments:{pattern:'STRIP_GREP_OK',path:input}}:null;
    if(tool)step++;
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    if(tool){
      const delta={role:'assistant',tool_calls:[{index:0,id:'call_grep_permission',type:'function',function:{name:tool.name,arguments:JSON.stringify(tool.arguments)}}]};
      res.write('data: '+JSON.stringify({id:'mock_grep',object:'chat.completion.chunk',created:1,model:'acceptance',choices:[{index:0,delta,finish_reason:null}]})+'\n\n');
      res.end('data: '+JSON.stringify({id:'mock_grep',object:'chat.completion.chunk',created:1,model:'acceptance',choices:[{index:0,delta:{},finish_reason:'tool_calls'}]})+'\n\ndata: [DONE]\n\n');
      return;
    }
    const delta={role:'assistant',content:'Grep permission acceptance complete.'};
    res.write('data: '+JSON.stringify({id:'mock_done',object:'chat.completion.chunk',created:1,model:'acceptance',choices:[{index:0,delta,finish_reason:null}]})+'\n\n');
    res.end('data: '+JSON.stringify({id:'mock_done',object:'chat.completion.chunk',created:1,model:'acceptance',choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
  });
  await fs.mkdir(workspace,{recursive:true});
  await fs.writeFile(input,'STRIP_GREP_OK\n','utf8');
  await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
  const endpoint=`http://127.0.0.1:${mock.address().port}/v1/chat/completions`;
  engine=createEngine({root,provider:'openai',endpoint,model:'acceptance',dataDir:path.join(workspace,'engine-data'),...(process.env.OPENCODE_EXE?{executable:process.env.OPENCODE_EXE}:{}),expectedVersion:process.env.OPENCODE_VERSION||'2.1.1'});
  const agent=createAgentService({root:workspace,workspaceBase:workspace,endpoint,model:'acceptance',provider:'openai',connection:'ccswitch',engine,executable:engine.executable});
  const {session}=await agent.handle('POST','/sessions',{workspace,model:{providerID:'strip-local',id:'acceptance'},title:'grep permission regression'});
  await agent.handle('POST',`/sessions/${session.id}/prompt`,{text:'Use grep without the literal option, then report completion.'});

  let state, approved=false;
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
    state=await agent.handle('GET',`/sessions/${session.id}`);
    if(state.permissions.length){
      const permission=state.permissions.find(item=>item.action==='grep');
      assert.ok(permission,'grep permission must be present');
      assert.equal(typeof permission.metadata,'object');
      assert.ok(!('literal' in permission.metadata)||permission.metadata.literal===null||typeof permission.metadata.literal==='boolean');
      await agent.handle('POST',`/sessions/${session.id}/permissions`,{requestID:permission.id,decision:'once'});
      approved=true;
    }
    const tools=(state.messages||[]).flatMap(message=>message.content||[]).filter(part=>part.type==='tool');
    if(approved&&!state.running&&tools.some(tool=>tool.name==='grep'&&tool.state?.status==='completed'))return;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.fail('grep permission flow timed out: '+JSON.stringify(state));
});
