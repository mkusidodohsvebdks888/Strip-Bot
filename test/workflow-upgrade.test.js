'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const http=require('node:http');
const {createAgentService}=require('../backend/agent/service.cjs');
const {createGateway}=require('../backend/gateway.cjs');
const {readChangedFile,runManualCommand,MAX_PROMPT_CHARS}=require('../backend/agent/workspace-actions.cjs');

test('download only real changed files in current workspace and reject traversal and symlinks',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-workflow-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const file=path.join(root,'changed.txt');await fs.writeFile(file,'updated');
  const changes=[{path:'changed.txt'}];
  assert.equal((await readChangedFile(root,'changed.txt',changes)).bytes.toString(),'updated');
  assert.equal((await readChangedFile(root,'changed.txt',[{path:file}])).bytes.toString(),'updated');
  await assert.rejects(readChangedFile(root,'../elsewhere.txt',changes),{status:403});
  await assert.rejects(readChangedFile(root,'not-changed.txt',changes),{status:403});
  await assert.rejects(readChangedFile(root,'/etc/passwd',changes),{status:400});
  if(process.platform==='win32'){
    const jail=path.join(root,'workspace');await fs.mkdir(jail);
    await fs.symlink(root,path.join(jail,'link'),'junction');
    await assert.rejects(readChangedFile(jail,'link/changed.txt',[{path:'link/changed.txt'}]),{status:403});
  }else{
    await fs.symlink(file,path.join(root,'link.txt'));
    await assert.rejects(readChangedFile(root,'link.txt',[{path:'link.txt'}]),{status:403});
  }
  await assert.rejects(readChangedFile(root,'.RUNTIME/secrets.txt',[{path:'.RUNTIME/secrets.txt'}]),{status:403});
  await assert.rejects(readChangedFile(root,'changed.txt:secret',[{path:'changed.txt:secret'}]),{status:403});
});

test('manual commands must be explicitly confirmed and have bounded output/time',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-cmd-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await assert.rejects(runManualCommand({workspace:root,command:'node -v'}),{status:400});
  await assert.rejects(runManualCommand({workspace:root,command:'echo test',confirmed:true,timeoutMs:999999}),{status:400});
  const result=await runManualCommand({workspace:root,command:'node -p "process.cwd()"',confirmed:true,timeoutMs:10000});
  assert.equal(result.exitCode,0);
  assert.ok(result.stdout.trim()===root,`cwd: ${result.stdout}`);
});

test('manual output is bounded and timeout terminates the launched process tree',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-command-limits-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.writeFile(path.join(root,'large.cjs'),"process.stdout.write('x'.repeat(200000));setInterval(()=>{},1000);");
  const large=await runManualCommand({workspace:root,command:'node large.cjs',confirmed:true,timeoutMs:5000});
  assert.equal(large.truncated,true);assert.ok(Buffer.byteLength(large.stdout)+Buffer.byteLength(large.stderr)<=128*1024);
  await fs.writeFile(path.join(root,'later.cjs'),"setTimeout(()=>require('node:fs').writeFileSync('late.txt','BAD'),2300);setInterval(()=>{},1000);");
  const stopped=await runManualCommand({workspace:root,command:'node later.cjs',confirmed:true,timeoutMs:1000});
  assert.equal(stopped.timedOut,true);assert.ok(stopped.durationMs<5000);
  await new Promise(resolve=>setTimeout(resolve,1600));
  await assert.rejects(fs.access(path.join(root,'late.txt')));
});

test('manual commands leave polling responsive and block conflicting prompts, deletion and second commands',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-command-session-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.writeFile(path.join(root,'pause.cjs'),"setTimeout(()=>process.stdout.write('DONE'),1200)");
  const engine={executable:__filename,ensure:async()=>{},close:async()=>{},request:async route=>{
    if(route==='/api/session')return {data:{id:'ses_manual',title:'manual'}};
    if(route==='/api/session/active')return {data:{}};
    return {data:[]};
  }};
  const agent=createAgentService({root,workspaceBase:root,engine});t.after(()=>agent.close());
  await agent.handle('POST','/sessions',{workspace:root,model:{id:'model',providerID:'strip-local'}});
  const task=agent.handle('POST','/sessions/ses_manual/command',{command:'node pause.cjs',confirmed:true});
  const snapshot=await agent.handle('GET','/sessions/ses_manual');assert.equal(snapshot.manualRunning,true);
  await assert.rejects(agent.reloadIntegrations(),{status:409});
  for(const [method,route,body] of [['POST','/sessions/ses_manual/prompt',{text:'hello'}],['DELETE','/sessions/ses_manual',{}],['POST','/sessions/ses_manual/command',{command:'echo no',confirmed:true}]])await assert.rejects(agent.handle(method,route,body),{status:409});
  assert.equal((await task).stdout,'DONE');
  assert.equal((await agent.handle('GET','/sessions/ses_manual')).manualRunning,false);
});

test('agent prompt accepts extended length, still rejects oversized prompts',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-long-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  let submitted=[];
  const engine={executable:__filename,ensure:async()=>{},close:async()=>{},request:async(route,body)=>{
    if(route==='/api/session')return {data:{id:'ses_long',title:'long'}};
    if(route==='/api/session/active')return {data:{}};
    if(route.endsWith('/prompt')){submitted.push(body.text);return {data:{}};}
    return {data:[]};
  }};
  const agent=createAgentService({root,workspaceBase:root,engine});t.after(()=>agent.close());
  await agent.handle('POST','/sessions',{workspace:root,model:{id:'model',providerID:'strip-local'}});
  await agent.handle('POST','/sessions/ses_long/prompt',{text:'x'.repeat(200000)});
  assert.equal(submitted[0].length,200000);
  await assert.rejects(agent.handle('POST','/sessions/ses_long/prompt',{text:'x'.repeat(MAX_PROMPT_CHARS+1)}),{status:400});
});

test('local gateway allows file output but rejects external origins and unknown paths',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-gateway-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.writeFile(path.join(root,'ok.txt'),'result');
  const agent={close:async()=>{},handle:async()=>({}),downloadOutput:async(id,name)=>{
    assert.equal(id,'ses_file');return readChangedFile(root,name,[{path:'ok.txt'}]);
  }};
  const gateway=createGateway({agentService:agent});await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>gateway.close(resolve)));
  const base=`http://127.0.0.1:${gateway.address().port}`;
  const ok=await fetch(base+'/api/agent/sessions/ses_file/output?path=ok.txt');
  assert.equal(ok.status,200);assert.equal(await ok.text(),'result');
  assert.match(ok.headers.get('content-disposition'),/attachment/);
  assert.equal((await fetch(base+'/api/agent/sessions/ses_file/output?path=..%2Fbad.txt')).status,403);
  assert.equal((await fetch(base+'/api/agent/sessions/ses_file/output?path=ok.txt',{headers:{origin:'https://evil.example'}})).status,403);
});
