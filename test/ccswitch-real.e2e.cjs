'use strict';
// Explicit real-model acceptance; never run as part of npm test.
const fs = require('node:fs/promises'),path = require('node:path');
const {createCcSwitch} = require('../backend/ccswitch.cjs');
const {createEngine} = require('../backend/agent/engine.cjs');
const {createAgentService} = require('../backend/agent/service.cjs');
const root = path.resolve(__dirname,'..'),workspace = path.join(root,'.runtime','ccswitch-real-acceptance');
let engine,agent,session,lastState;
(async () => {
  await fs.mkdir(workspace,{recursive:true});await fs.writeFile(path.join(workspace,'input.txt'),'STRIP_CC_REAL_INPUT_20261014\n');
  const selected = await createCcSwitch().resolve();
  const textResponse = await fetch('http://127.0.0.1:3060/api/cc-switch/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:'Reply exactly STRIP_CC_TEXT_OK.',stream:false}),signal:AbortSignal.timeout(45000)});
  const raw = await textResponse.text();
  const textPassed = textResponse.ok && raw.includes('STRIP_CC_TEXT_OK');
  console.log('Real text:',textResponse.status,textPassed ? 'passed':'failed');
  if (!textPassed) throw new Error('Real text response failed: '+raw.slice(0,350));
  engine = createEngine({root,...selected,dataDir:path.join(workspace,'engine-data')});
  agent = createAgentService({root:workspace,workspaceBase:workspace,engine});
  ({session} = await agent.handle('POST','/sessions',{workspace,model:{providerID:'strip-local',id:selected.model},title:'CC Switch real tool acceptance'}));
  await agent.handle('POST',`/sessions/${session.id}/prompt`,{text:'Use your file tools to read input.txt in the current project directory, write its exact content to result.txt in that same directory (the source ends with exactly one LF newline; preserve that final newline), and read result.txt again. Do not use a shell or touch other files. Then reply STRIP_CC_AGENT_OK.'});
  const approvals = [],deadline = Date.now()+120000;
  while (Date.now() < deadline) {
    const state = await agent.handle('GET',`/sessions/${session.id}`);lastState = state;
    for (const p of state.permissions) {
      const allowed = ['read','edit'].includes(p.action) && p.resources.length && p.resources.every(r => ['input.txt','result.txt'].includes(r) || [path.join(workspace,'input.txt'),path.join(workspace,'result.txt')].includes(r));
      await agent.handle('POST',`/sessions/${session.id}/permissions`,{requestID:p.id,decision:allowed ? 'once':'reject'});
      approvals.push({action:p.action,resources:p.resources,decision:allowed ? 'once':'reject'});
    }
    const tools = state.messages.flatMap(m => m.content || []).filter(p => p.type === 'tool');
    const text = state.messages.filter(m => m.type === 'assistant').flatMap(m => m.content || []).filter(p => p.type === 'text').map(p => p.text || '').join('\n');
    if (tools.some(p => p.state?.status === 'error')) throw new Error('Real tool error: '+JSON.stringify(tools.filter(p => p.state?.status === 'error')).slice(0,500));
    const content = await fs.readFile(path.join(workspace,'result.txt'),'utf8').catch(() => '');
    if (content === 'STRIP_CC_REAL_INPUT_20261014\n' && tools.filter(p => p.state?.status === 'completed').length >= 3 && text.includes('STRIP_CC_AGENT_OK') && !state.running) {
      const report = {realModel:true,model:selected.model,protocol:'responses',textPassed,tools:tools.map(p => ({name:p.name,status:p.state.status})),approvals,actualContent:content,reply:text,passed:true};
      await fs.writeFile(path.join(workspace,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;
    }
    if (!state.running && text.includes('STRIP_CC_AGENT_OK')) throw new Error('Model finished but exact file content or completed-tool count did not match acceptance requirements.');
    const error = state.messages.find(m => m.error);if (error) throw new Error(JSON.stringify(error.error).slice(0,500));
    await new Promise(resolve => setTimeout(resolve,500));
  }
  throw new Error('Real Agent acceptance timed out.');
})().catch(async error => {await fs.writeFile(path.join(workspace,'verification.json'),JSON.stringify({realModel:true,passed:false,error:error.message,lastState:lastState ? {running:lastState.running,tools:lastState.messages.flatMap(m=>m.content||[]).filter(p=>p.type==='tool').map(p=>({name:p.name,status:p.state?.status})),reply:lastState.messages.filter(m=>m.type==='assistant').flatMap(m=>m.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('\n')} : undefined},null,2));console.error(error.message);process.exitCode=1;}).finally(async () => {
  if (agent && session) await agent.handle('POST',`/sessions/${session.id}/interrupt`,{}).catch(() => {});
  await engine?.close();
});
