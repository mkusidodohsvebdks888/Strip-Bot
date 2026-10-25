'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createAstrBotPlugin}=require('../backend/astrbot-plugin.cjs');
const {createGateway}=require('../backend/gateway.cjs');

async function temp(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'astrbot-plugin-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}

test('AstrBot plugin reports services, model and local URLs', async t=>{
  const root=await temp(t);
  await fs.mkdir(path.join(root,'data'),{recursive:true});
  await fs.mkdir(path.join(root,'napcat','config'),{recursive:true});
  await fs.writeFile(path.join(root,'data','cmd_config.json'),JSON.stringify({
    provider:[{id:'function-local',enable:true,model:'qwen3:4b-instruct',provider_source_id:'function-local-source'}],
    provider_sources:[{id:'function-local-source',name:'Function Local (Ollama)',type:'openai_responses',api_base:'http://host.docker.internal:11434/v1'}],
    agent_runner:{config:{model:{provider_id:'function-local'},persona:{persona_id:'default'}}},
  }));
  await fs.writeFile(path.join(root,'napcat','config','webui.json'),JSON.stringify({token:'local-token'}));
  const plugin=createAstrBotPlugin({deployRoot:root,fetchImpl:async()=>new Response('',{status:200}),now:()=>123});
  const status=await plugin.status();
  assert.equal(status.id,'astrbot-desktop');assert.equal(status.services.astrbot.online,true);assert.equal(status.services.napcat.online,true);
  assert.equal(status.model.model,'qwen3:4b-instruct');assert.equal(status.model.providerId,'function-local');assert.equal(status.model.type,'openai_responses');
  assert.match(status.urls.napcat,/token=local-token/);assert.equal(status.checkedAt,123);
});

test('AstrBot plugin returns offline rather than throwing', async t=>{
  const root=await temp(t);
  const plugin=createAstrBotPlugin({deployRoot:root,fetchImpl:async()=>{throw new Error('offline');}});
  const status=await plugin.status();
  assert.equal(status.services.astrbot.online,false);assert.equal(status.services.napcat.online,false);assert.ok(status.configError);
});

test('gateway exposes protected AstrBot status endpoint', async t=>{
  const root=await temp(t);
  const gateway=createGateway({agentRoot:root,astrbotPlugin:{status:async()=>({id:'astrbot-desktop',version:'0.1.0'})},agentService:{close:async()=>{}},accountService:{close:async()=>{}}});
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>gateway.close(resolve)));
  const base='http://127.0.0.1:'+gateway.address().port;
  const ok=await fetch(base+'/api/plugins/astrbot/status');
  assert.equal(ok.status,200);assert.equal((await ok.json()).id,'astrbot-desktop');
  const denied=await fetch(base+'/api/plugins/astrbot/status',{headers:{origin:'https://evil.example'}});
  assert.equal(denied.status,403);
});

test('toolbar and packaged plugin metadata are present', async()=>{
  const root=path.join(__dirname,'..');
  const manifest=JSON.parse(await fs.readFile(path.join(root,'plugins','astrbot-desktop','plugin.json'),'utf8'));
  const tools=await fs.readFile(path.join(root,'codex-ui','src','components','Sidebar','ToolWorkspace.tsx'),'utf8');
  const app=await fs.readFile(path.join(root,'codex-ui','src','App.tsx'),'utf8');
  assert.equal(manifest.id,'astrbot-desktop');assert.match(tools,/id:'astrbot'/);assert.match(app,/AstrBotTool/);
});