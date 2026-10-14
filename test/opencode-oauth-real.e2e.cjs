'use strict';
// Explicit real-account acceptance. Never included in npm test; only scoped fixtures are approved.
const fs=require('node:fs/promises'),path=require('node:path');
const {createEngine}=require('../backend/agent/engine.cjs');
const {createAgentService}=require('../backend/agent/service.cjs');
const root=path.resolve(__dirname,'..'),workspace=path.join(root,'.runtime','oauth-real-acceptance');
const model=process.env.STRIP_OAUTH_TEST_MODEL || 'gpt-5.5';
let engine,agent,session,last;
const report={realModel:true,connection:'OpenCode native OpenAI OAuth',model,passed:false,approvals:[]};
const assistantText=s=>s.messages.filter(m=>m.type==='assistant').flatMap(m=>m.content || []).filter(c=>c.type==='text').map(c=>c.text || '').join('\n');
async function waitFor(marker,allowTools=false) {
  const deadline=Date.now()+180000;
  while(Date.now()<deadline) {
    last=await agent.handle('GET','/sessions/'+session.id);
    for(const p of last.permissions || []) {
      const files=['input.txt','result.txt'];
      const allowed=allowTools && p.resources.length>0 && (
        ['read','edit'].includes(p.action) && p.resources.every(r=>files.includes(r) || files.some(f=>path.normalize(r)===path.join(workspace,f))) ||
        p.action==='shell' && p.resources.every(r=>r==='echo STRIP_NATIVE_SHELL_OK')
      );
      report.approvals.push({action:p.action,resources:p.resources,decision:allowed?'once':'reject'});
      console.log('Permission:',p.action,allowed?'approved scoped fixture':'rejected');
      await agent.handle('POST','/sessions/'+session.id+'/permissions',{requestID:p.id,decision:allowed?'once':'reject'});
      if(!allowed)throw new Error('Model requested an operation outside the explicit acceptance scope.');
    }
    const error=last.messages.find(m=>m.error);
    if(error)throw new Error(JSON.stringify(error.error).slice(0,500));
    const text=assistantText(last);
    if(!last.running && text.includes(marker))return text;
    if(!last.running && text && !last.permissions.length)throw new Error('Model finished without expected acceptance marker.');
    await new Promise(resolve=>setTimeout(resolve,800));
  }
  throw new Error('Native OAuth model acceptance timed out.');
}
(async()=>{
  await fs.mkdir(workspace,{recursive:true});
  await fs.writeFile(path.join(workspace,'input.txt'),'STRIP_NATIVE_INPUT\n');
  engine=createEngine({root,provider:'opencode'});
  agent=createAgentService({root:workspace,workspaceBase:workspace,provider:'opencode',connection:'opencode',engine});
  const available=await agent.handle('GET','/models');
  if(!available.models.some(m=>m.id===model))throw new Error('Requested real model is not in the authenticated catalog.');
  ({session}=await agent.handle('POST','/sessions',{workspace,model:{providerID:'openai',id:model},title:'Native OAuth real acceptance'}));
  report.sessionID=session.id;
  await agent.handle('POST','/sessions/'+session.id+'/prompt',{provider:'opencode',text:'Reply exactly STRIP_NATIVE_TEXT_OK. Do not use tools.'});
  report.textReply=await waitFor('STRIP_NATIVE_TEXT_OK');report.textPassed=true;
  console.log('Real native text: passed');
  await agent.handle('POST','/sessions/'+session.id+'/prompt',{provider:'opencode',text:'In the current project directory only: use read to read input.txt; use write to create result.txt with exactly STRIP_NATIVE_CREATED followed by one LF newline; use edit to replace CREATED with UPDATED in result.txt; use read to read result.txt; then use shell to execute exactly echo STRIP_NATIVE_SHELL_OK in the current project directory. Use separate tools in this order, do not use shell for files, and do not touch any other file. Finally reply exactly STRIP_NATIVE_TOOLS_OK.'});
  report.toolReply=await waitFor('STRIP_NATIVE_TOOLS_OK',true);
  report.actualContent=await fs.readFile(path.join(workspace,'result.txt'),'utf8');
  const tools=last.messages.flatMap(m=>m.content || []).filter(c=>c.type==='tool');
  report.tools=tools.map(c=>({name:c.name,status:c.state?.status}));
  const shell=tools.find(c=>c.name==='shell' && c.state?.status==='completed');
  report.shellPassed=Boolean(shell && JSON.stringify(shell.state.content).includes('STRIP_NATIVE_SHELL_OK'));
  report.passed=report.actualContent==='STRIP_NATIVE_UPDATED\n' && report.shellPassed && tools.filter(c=>c.state?.status==='completed').length>=5 && !tools.some(c=>c.state?.status==='error');
  if(!report.passed)throw new Error('Real output or completed tools did not match acceptance requirements.');
  console.log('Real native file and shell tools: passed');
})().catch(error=>{report.error=error.message;console.error(error.message);process.exitCode=1;}).finally(async()=>{
  if(agent && session)await agent.handle('POST','/sessions/'+session.id+'/interrupt',{}).catch(()=>{});
  await engine?.close();
  await fs.mkdir(workspace,{recursive:true});
  await fs.writeFile(path.join(workspace,'verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
});
