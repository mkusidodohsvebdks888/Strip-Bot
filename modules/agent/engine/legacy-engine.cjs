'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const {spawn} = require('node:child_process');
const {randomBytes} = require('node:crypto');
const {proxyEnvironment} = require('./proxy.cjs');
const {readEvents}=require('./event-stream.cjs');
const {createIntegrationRegistry}=require('../../integrations/mcp/index.cjs');

/** Private authenticated OpenCode sidecar; never expose its password to the UI. */
function createEngine({root,apiKey = '',endpoint = 'http://127.0.0.1:3010/v1/chat/completions',model = 'chatgpt',provider = 'openai',dataDir = path.join(root,'.runtime','opencode'),configHome = path.join(dataDir,'config'),executable = path.join(root,'agent-runtime','node_modules','@opencode','cli','bin','opencode.exe'),expectedVersion = '2.1.1'} = {}) {
  let child,baseUrl,starting;
  const password = randomBytes(32).toString('hex');
  const subscriptions=new Set();
  const headers = {Authorization:'Basic '+Buffer.from(`opencode:${password}`).toString('base64'),'Content-Type':'application/json'};
  async function request(route,body,method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(baseUrl+route,{method,headers,body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    const raw = await response.text();
    let data; try {data = raw ? JSON.parse(raw) : null;} catch {data = null;}
    if (!response.ok) {const error = new Error(data?.message || data?.error?.message || `OpenCode HTTP ${response.status}`);error.status = response.status;throw error;}
    return data;
  }
  async function start() {
    await fs.access(executable).catch(() => {throw new Error('OpenCode 引擎未安装，请运行 agent-runtime 的 npm install。');});
    const configDir = path.join(configHome,'opencode');
    await fs.mkdir(configDir,{recursive:true});
    // Native OpenCode OpenAI auth reads credentials from the *isolated* XDG data
    // directory below. Never proxy an OAuth token through CC Switch.
    const nativeOpenAI = provider === 'opencode';
    const config = {update:'disable',share:'disabled',snapshots:true,permissions:[{action:'*',resource:'*',effect:'ask'}]};
    // Load explicitly enabled external MCP projects into the isolated OpenCode config.
    // OpenCode 2.x expects mcp.servers; do not copy credentials to the renderer.
    const servers = await createIntegrationRegistry({root}).asMcpServers();
    if (Object.keys(servers).length) config.mcp = {servers};
    // Enabled SKILL.md bundles are published as an explicit Skills source.
    const skillsDir=path.join(root,'.runtime','skills-enabled');
    await fs.mkdir(skillsDir,{recursive:true});
    config.skills = [skillsDir];
    if (!nativeOpenAI) {
      const url = new URL(endpoint);
      url.pathname = url.pathname.replace(/\/(chat\/completions|responses)\/?$/,'');
      config.providers = {'strip-local':{name:'Strip Bot 本机模型',package:provider === 'responses' ? '@opencode/ai/providers/openai-compatible/responses':'@opencode/ai/providers/openai-compatible',env:['STRIPBOT_AGENT_API_KEY'],settings:{baseURL:url.href.replace(/\/$/,''),apiKey:'{env:STRIPBOT_AGENT_API_KEY}'},models:{[model]:{name:model,capabilities:{tools:true,input:['text'],output:['text']},limit:{context:64000,output:8000}}}}};
      config.model = {providerID:'strip-local',model};
    }
    await fs.writeFile(path.join(configDir,'opencode.json'),JSON.stringify(config,null,2));
    const port = await new Promise((resolve,reject) => {
      const socket = net.createServer();socket.once('error',reject);socket.listen(0,'127.0.0.1',() => {const port = socket.address().port;socket.close(() => resolve(port));});
    });
    baseUrl = `http://127.0.0.1:${port}`;
    const childEnv = {...process.env,
      XDG_DATA_HOME:path.join(dataDir,'data'),XDG_CACHE_HOME:path.join(dataDir,'cache'),XDG_CONFIG_HOME:configHome,XDG_STATE_HOME:path.join(dataDir,'state'),
      OPENCODE_CONFIG_DIR:configDir,OPENCODE_SERVER_PASSWORD:password,
      OPENCODE_CONFIG_PROJECT_DISABLE:'1',
    };
    // The native provider needs its own catalog and OAuth account, not a dummy
    // proxy secret. Keep the legacy local provider isolated as before.
    if (nativeOpenAI) {
      Object.assign(childEnv,await proxyEnvironment(dataDir));
      delete childEnv.OPENCODE_DISABLE_MODELS_FETCH;
      delete childEnv.STRIPBOT_AGENT_API_KEY;
      delete childEnv.OPENAI_API_KEY; // Do not accidentally replace OAuth with API-key auth.
      delete childEnv.OPENAI_BASE_URL;
      delete childEnv.OPENCODE_DB; // Force database under the isolated XDG data root.
      delete childEnv.OPENCODE_CONFIG;
    } else {
      childEnv.OPENCODE_DISABLE_MODELS_FETCH = '1';
      childEnv.STRIPBOT_AGENT_API_KEY = apiKey || 'local';
    }
    child = spawn(executable,['serve','--stdio','--hostname','127.0.0.1','--port',String(port)],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe'],env:childEnv});
    let failure;
    child.once('error',error => {failure = error;});
    // Drain output, but do not persist configuration/credentials printed by dependencies.
    child.stdout.resume();child.stderr.resume();
    for (let i = 0; i < 100; i++) {
      if (failure) throw failure;
      if (child.exitCode !== null) throw new Error(`OpenCode 启动失败（退出码 ${child.exitCode}）。`);
      try {const info = await request('/api/info');if (expectedVersion === '*' || info.version === expectedVersion) return info;} catch {}
      await new Promise(resolve => setTimeout(resolve,200));
    }
    child.kill();throw new Error('OpenCode 启动超时。');
  }
  return {async ensure() {
    if (child && child.exitCode === null && baseUrl && !starting) return;
    if (!starting) starting = start().finally(() => {starting = null;});
    return starting;
  },request,async subscribe(onEvent,onDisconnect) {
    const controller=new AbortController();subscriptions.add(controller);
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(baseUrl+'/api/event',{headers,signal:controller.signal});
      if(!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('OpenCode event stream unavailable');
      clearTimeout(timer);
      void readEvents(response.body,onEvent).catch(()=>{}).finally(()=>{subscriptions.delete(controller);onDisconnect();});
      return ()=>controller.abort();
    }catch(error){clearTimeout(timer);subscriptions.delete(controller);controller.abort();throw error;}
  },async close() {
    for(const controller of subscriptions)controller.abort();subscriptions.clear();
    const owned = child;child = null;
    if (owned && owned.exitCode === null) await new Promise(resolve => {
      const timer = setTimeout(() => {owned.kill();resolve();},1000);
      owned.once('exit',() => {clearTimeout(timer);resolve();});owned.stdin.end();
    });
  },executable};
}
module.exports = {createEngine};
