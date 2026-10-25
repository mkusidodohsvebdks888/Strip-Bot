'use strict';
// Codex CLI app-server adapter for Strip Bot's existing /api/agent snapshots.
// No shell for RPC or model-generated commands; Codex controls its own sandbox.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');
const {spawn} = require('node:child_process');
const {randomBytes} = require('node:crypto');
const {createIntegrationRegistry} = require('../integrations.cjs');
const {startBridge} = require('./deepseek-bridge.cjs');

const ID = /^ses_[a-f0-9]{20}$/;
const maxOutput = 160000;
const limited = (s, limit = maxOutput) => String(s ?? '').slice(0, limit);
const statusOf = status => status === 'completed' ? 'completed' : ['failed','declined'].includes(status) ? 'error' : 'running';
const err = (code, message) => Object.assign(new Error(message), {status:code});
const asData = data => ({data});
const inline = v => JSON.stringify(v);

// On Windows npm exposes a .cmd shim. Execute the installed JS entrypoint with
// Node instead of passing untrusted TOML arguments through cmd.exe / shell:true.
async function executableFor(root, override) {
  const local = path.join(root,'agent-runtime','node_modules','@openai','codex','bin','codex.js');
  const globalNpm = process.env.APPDATA && path.join(process.env.APPDATA,'npm','node_modules','@openai','codex','bin','codex.js');
  const candidates = [override,local,globalNpm].filter(Boolean);
  for (const entry of candidates) {
    if (!path.isAbsolute(entry)) continue;
    try {await fs.access(entry);} catch {continue;}
    if (entry.endsWith('.js')) return {command:process.execPath,prefix:[entry]};
    if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(entry)) throw err(400,'请使用 Codex 原生 .exe 或在 agent-runtime 安装 @openai/codex，不允许经 cmd.exe 执行动态配置。');
    return {command:entry,prefix:[]};
  }
  if (process.platform !== 'win32') return {command:override || 'codex',prefix:[]};
  if (override && !path.isAbsolute(override)) return {command:override,prefix:[]};
  throw err(503,'未安装 Codex CLI。请执行：cd agent-runtime && npm install；或设置 STRIPBOT_CODEX_BIN 为 codex.exe 的完整路径。');
}

function customProvider(endpoint, provider, model, apiKey) {
  if (provider === 'codex' || provider === 'opencode') return null;
  let url;
  try {url = new URL(endpoint);} catch {throw err(400,'Codex 需要有效的模型 API 地址。');}
  if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname.toLowerCase()) || url.protocol !== 'http:' || url.username || url.password || url.search || url.hash) throw err(400,'自定义模型接口仅支持本机 HTTP 模型代理。');
  const mode = /\/responses\/?$/.test(url.pathname) ? 'native' : /\/chat\/completions\/?$/.test(url.pathname) ? 'chat' : null;
  if (!mode) throw err(422,'模型接口必须是 /v1/responses 或 /v1/chat/completions。');
  if (!model || typeof model !== 'string') throw err(400,'模型名称无效。');
  const base = new URL(url.href);
  base.pathname = base.pathname.replace(/\/(responses|chat\/completions)\/?$/,'');
  if (!apiKey) throw err(400,'代理模型缺少 API Key。');
  return {model,baseUrl:base.href.replace(/\/$/,''),key:apiKey,mode,upstreamEndpoint:url.href};
}

function createEngine({root,apiKey='',endpoint='',model='',provider='codex',executable=process.env.STRIPBOT_CODEX_BIN,spawnProcess=spawn,readModelCatalog} = {}) {
  if (!root) throw new TypeError('Codex root is required');
  const folder=path.join(root,'.runtime','codex-sessions');
  const native=provider==='codex'||provider==='opencode';
  let config,configError;
  try{config=customProvider(endpoint,provider,model,apiKey);}catch(error){configError=error;}
  let child,starting,initialized=false,sequence=0,closing=false,startedAt=0,localBridge=null;
  const pending=new Map(),sessions=new Map(),listeners=new Set(),notificationListeners=new Set();
  let lastFailure;
  const running = () => child && child.exitCode===null && initialized && !child.killed;
  const notify = (method,params) => {
    for(const callback of notificationListeners){try{callback(method,params);}catch{/* observer errors must not break RPC */}}
  };
  const dispatch=(event)=>{for(const callback of listeners){try{callback(event);}catch{/* ignore observer errors */}}};
  const send=(message)=>{
    if(!child || child.stdin.destroyed) throw err(503,'Codex 服务尚未启动或连接已经断开。');
    child.stdin.write(JSON.stringify(message)+'\n');
  };
  const respond=(id,result)=>send({jsonrpc:'2.0',id,result});
  const rpc=(method,params={},timeoutMs=20000)=>new Promise((resolve,reject)=>{
    if(!child || child.stdin.destroyed)return reject(err(503,'Codex app-server 尚未就绪。'));
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(err(504,'Codex RPC 超时：'+method));},timeoutMs);
    pending.set(id,{resolve,reject,timer});
    try{send({jsonrpc:'2.0',id,method,params});}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
  });
  async function readSession(id){
    if(!ID.test(id))throw err(410,'这是旧 OpenCode 会话。原记录保留，但无法用 Codex 继续执行；请新建 Codex 会话。');
    if(sessions.has(id))return sessions.get(id);
    let data;
    try{data=JSON.parse(await fs.readFile(path.join(folder,id+'.json'),'utf8'));}
    catch(error){if(error.code==='ENOENT')throw err(404,'未找到 Codex 会话记录。');throw error;}
    if(data.id!==id || typeof data.threadId!=='string')throw err(500,'Codex 会话索引损坏。');
    // Older builds attached an error to every command whose initial exit code
    // was null. A completed command snapshot is authoritative over that marker.
    for(const message of data.messages || [])for(const entry of message.content || []){
      if(entry.name==='bash' && entry.state?.status==='completed' && entry.state.error==='Exit code: null')delete entry.state.error;
    }
    data.active=false;data.currentTurn=null;data.pending=[];data.forms=[];data.loaded=false;
    sessions.set(id,data);return data;
  }
  async function saveSession(session){
    await fs.mkdir(folder,{recursive:true});
    const file=path.join(folder,session.id+'.json');
    const data={...session,active:false,currentTurn:null,pending:[],forms:[],ignoredTurns:undefined};
    // Save snapshots only. Never persist requested command permissions or tokens.
    const serializable=JSON.stringify(data);
    const temp=file+'.tmp';
    await fs.writeFile(temp,serializable,{mode:0o600});await fs.rename(temp,file);
  }
  let saves=Promise.resolve();
  function persist(s){
    saves=saves.catch(()=>{}).then(()=>saveSession(s));
    return saves;
  }
  const findSession=threadId=>[...sessions.values()].find(s=>s.threadId===threadId);
  function assistant(s){return s.messages.find(m=>m.id===s.assistantId);}
  function tool(s,item){
    const a=assistant(s);if(!a)return null;
    const name=item.type==='commandExecution'?'bash':item.type==='fileChange'?'apply_patch':item.type==='webSearch'?'websearch':item.type==='mcpToolCall'?`mcp.${item.server||'server'}.${item.tool||'tool'}`:item.type==='collabToolCall'?'agent':'read';
    let existing=a.content.find(t=>t.id===item.id);
    if(!existing){
      let input = item.type==='commandExecution'?{command:item.command,cwd:item.cwd}:item.type==='fileChange'?{path:item.changes?.[0]?.path,changes:item.changes}:item.type==='webSearch'?{query:item.query}:item.type==='mcpToolCall'?item.arguments:{...item};
      existing={id:item.id||'tool_'+randomBytes(6).toString('hex'),type:'tool',name,time:{created:Date.now()},state:{status:'running',input,content:''}};
      a.content.push(existing);
    }
    existing.state.status=statusOf(item.status);
    if(item.type==='commandExecution'){
      existing.state.input={command:item.command,cwd:item.cwd};
      if(item.aggregatedOutput !== undefined)existing.state.content=limited(item.aggregatedOutput);
      delete existing.state.error;
      if(Number.isInteger(item.exitCode) && item.exitCode !== 0){existing.state.status='error';existing.state.error=`Exit code: ${item.exitCode}`;}
    }
    if(item.type==='fileChange'){
      existing.state.input={path:item.changes?.[0]?.path,changes:item.changes};
      existing.state.content=limited((item.changes||[]).map(c=>c.diff||c.path).join('\n'));
      for(const c of item.changes||[]){
        if(typeof c.path==='string')s.diffMap[c.path]={path:c.path,patch:limited(c.diff||'')};
      }
    }
    if(item.type==='mcpToolCall'){
      existing.state.input=item.arguments;existing.state.content=limited(item.result && JSON.stringify(item.result));
      if(item.error)existing.state.error=limited(typeof item.error==='string'?item.error:JSON.stringify(item.error));
    }
    if(item.status==='failed'||item.status==='declined')existing.state.error ||= `Codex 工具${item.status==='declined'?'被拒绝':'执行失败'}`;
    if(['completed','failed','declined'].includes(item.status))existing.time.completed=Date.now();
    return existing;
  }
  function onNotification(method,p){
    notify(method,p);
    const s=findSession(p?.threadId);if(!s)return;
    if(p.turnId && s.currentTurn && p.turnId!==s.currentTurn)return;
    if(method==='turn/started'){
      s.active=true;s.currentTurn=p.turn?.id||s.currentTurn;
    }
    else if(method==='item/started'||method==='item/completed'||method==='item/updated'){
      const item=p.item;if(!item)return;
      if(item.type==='agentMessage'){
        const a=assistant(s);if(a){
          s.parts ||= {};s.parts[item.id]=item.text||s.parts[item.id]||'';
          a.text=Object.values(s.parts).filter(Boolean).join('\n\n');
        }
      }
      else if(['commandExecution','fileChange','mcpToolCall','webSearch','collabToolCall','dynamicToolCall'].includes(item.type))tool(s,item);
    }
    else if(method==='item/agentMessage/delta'){
      const a=assistant(s);if(a && typeof p.delta==='string'){
        s.parts ||= {};const key=p.itemId||'partial';
        s.parts[key]=(s.parts[key]||'')+p.delta;a.text=Object.values(s.parts).filter(Boolean).join('\n\n');
        dispatch({type:'session.text.delta',data:{sessionID:s.id,delta:p.delta}});
      }
    }
    else if(method==='item/commandExecution/outputDelta'){
      const a=assistant(s);const t=a?.content.find(t=>t.id===p.itemId);
      if(t && typeof p.delta==='string')t.state.content=limited((t.state.content||'')+p.delta);
    }
    else if(method==='turn/diff/updated' && typeof p.diff==='string'){
      s.latestDiff=limited(p.diff,500000);
    }
    else if(method==='serverRequest/resolved'){
      // A request can be cancelled by Codex (e.g. when the turn ends) before
      // the user clicks Approve. Do not leave a stale approval in the UI.
      s.pending=s.pending.filter(item=>String(item.rpcId)!==String(p.requestId));
      s.forms=s.forms.filter(item=>String(item.rpcId)!==String(p.requestId));
    }
    else if(method==='thread/tokenUsage/updated'){
      const a=assistant(s);if(a){const usage=p.tokenUsage?.last||p.tokenUsage?.total||p.tokenUsage||{};
        a.tokens={input:usage.inputTokens??usage.input_tokens??null,output:usage.outputTokens??usage.output_tokens??null};
      }
    }
    else if(method==='error'){
      const a=assistant(s);if(a)a.error=p.error?.message||'Codex execution error';
    }
    else if(method==='turn/completed'){
      if(s.currentTurn && p.turn?.id && p.turn.id!==s.currentTurn)return;
      const a=assistant(s);s.active=false;s.currentTurn=null;
      s.pending=[];s.forms=[];
      if(a){a.time.completed=Date.now();
        if(p.turn?.status==='failed')a.error=p.turn.error?.message||'Codex 执行失败';
        else if(p.turn?.status==='interrupted')a.error='任务已停止';
      }
      dispatch({type:'session.turn.completed',data:{sessionID:s.id,status:p.turn?.status||'failed',error:p.turn?.error?.message}});
      void persist(s).catch(()=>{});
    }
    // In-progress snapshots stay in memory, and a completed turn is flushed to disk.
  }
  function onServerRequest(msg){
    const p=msg.params||{},s=findSession(p.threadId),method=msg.method;
    if(s && ['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(method)){
      const permission={id:'per_'+randomBytes(8).toString('hex'),sessionID:s.id,action:method.includes('fileChange')?'edit':'shell',resources:[p.command||p.grantRoot||p.networkApprovalContext?.host||'查看操作详情'],metadata:{reason:p.reason||'',cwd:p.cwd||s.workspace,network:p.networkApprovalContext,commandActions:p.commandActions},rpcId:msg.id,kind:method};
      s.pending.push(permission);return;
    }
    if(s && method==='item/tool/requestUserInput' && Array.isArray(p.questions)){
      const form={id:'frm_'+randomBytes(8).toString('hex'),sessionID:s.id,rpcId:msg.id,title:'Codex 需要更多信息',fields:p.questions.map((q,i)=>({key:String(q.id||'q'+i),type:'string',title:q.header||q.question||'问题',description:q.question||'',options:(q.options||[]).map(o=>({value:o.label,label:o.label}))}))};
      s.forms.push(form);return;
    }
    // No implicit approval for unknown permissions, app requests or dynamic tools.
    try{send({jsonrpc:'2.0',id:msg.id,error:{code:-32601,message:'Strip Bot 未开放此类型的工具请求；请使用受支持的审批方式。'}});}catch{}
    if(s){const a=assistant(s);if(a)a.error='有暂不支持的 Codex 工具请求已被拒绝：'+method;}
  }
  function onLine(line){
    if(line.length>2_000_000)return;
    let data;try{data=JSON.parse(line);}catch{return;}
    if(Object.prototype.hasOwnProperty.call(data,'id') && !data.method){
      const task=pending.get(data.id);if(!task)return;
      pending.delete(data.id);clearTimeout(task.timer);
      if(data.error)task.reject(err(502,limited(data.error.message||'Codex RPC failed',1000)));
      else task.resolve(data.result??{});
    }else if(data.method && Object.prototype.hasOwnProperty.call(data,'id'))onServerRequest(data);
    else if(data.method)onNotification(data.method,data.params||{});
  }
  async function spawnAppServer(){
    if(configError)throw configError;
    const binary=await executableFor(root,executable);
    if(localBridge){await localBridge.close();localBridge=null;}
    if(config?.mode==='chat'){
      localBridge=await startBridge({upstreamUrl:config.upstreamEndpoint,upstreamKey:config.key,model:config.model,mode:'chat'});
    }
    const agentBaseUrl=localBridge?.baseUrl || config?.baseUrl;
    const agentKey=localBridge?.token || config?.key;
    const args=[...binary.prefix];
    if(config){
      args.push('-c','model_provider="strip_local"',
        '-c','features.apps=false','-c','features.plugins=false','-c','features.multi_agent=false',
        '-c','model_providers.strip_local.name="Strip Bot Local"',
        '-c','model_providers.strip_local.wire_api="responses"',
        '-c','model_providers.strip_local.base_url='+inline(agentBaseUrl),
        '-c','model_providers.strip_local.env_key="STRIPBOT_AGENT_API_KEY"');
    }
    const mcp=await createIntegrationRegistry({root}).asMcpServers();
    for(const [id,value] of Object.entries(mcp)){
      if(!/^[a-z][a-z0-9_-]{1,39}$/.test(id))continue;
      if(value.type==='local'){
        args.push('-c',`mcp_servers.${id}.command=${inline(value.command[0])}`);
        args.push('-c',`mcp_servers.${id}.args=${inline(value.command.slice(1))}`);
        if(value.cwd)args.push('-c',`mcp_servers.${id}.cwd=${inline(value.cwd)}`);
      }else if(value.type==='remote')args.push('-c',`mcp_servers.${id}.url=${inline(value.url)}`);
    }
    if(localBridge)args.push('-c','web_search="disabled"');
    args.push('app-server');
    // The standard Codex HOME is preserved: existing `codex login` works.
    // Never forward credentials to the web UI, logs, or custom MCP config.
    const env={...process.env};
    if(config)env.STRIPBOT_AGENT_API_KEY=agentKey;
    if(localBridge){env.NO_PROXY=[env.NO_PROXY, '127.0.0.1', 'localhost', '::1'].filter(Boolean).join(',');env.no_proxy=env.NO_PROXY;}
    child=spawnProcess(binary.command,args,{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe'],env,shell:false});
    startedAt=Date.now();initialized=false;closing=false;
    const reader=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
    reader.on('line',onLine);
    let stderr='';
    child.stderr.on('data',chunk=>{stderr=limited(stderr+chunk.toString('utf8'),1500);});
    function fail(error){
      if(closing)return;
      if(localBridge){const old=localBridge;localBridge=null;void old.close().catch(()=>{});}
      lastFailure=err(503,'Codex app-server 已断开：'+error.message);
      initialized=false;
      for(const [id,task] of pending){pending.delete(id);clearTimeout(task.timer);task.reject(lastFailure);}
      for(const s of sessions.values()){s.loaded=false;if(!s.active)continue;const a=assistant(s);if(a){a.error='Codex app-server 已断开';a.time.completed=Date.now();}s.active=false;s.pending=[];s.forms=[];void persist(s).catch(()=>{});}
      dispatch({type:'session.disconnected',data:{}});
    }
    child.once('error',error=>fail(error));
    child.once('close',code=>fail(new Error(`退出码 ${code??'unknown'}`)));
    try{
      await rpc('initialize',{clientInfo:{name:'stripbot_desktop',title:'Strip Bot Desktop',version:'1.0.0'}},12000);
      send({jsonrpc:'2.0',method:'initialized',params:{}});
      initialized=true;lastFailure=null;
    }catch(error){child.kill();if(localBridge){const old=localBridge;localBridge=null;await old.close();}throw err(503,'无法启动 Codex CLI：'+error.message+'。请检查已安装的 Codex CLI 版本和登录状态。');}
  }
  async function ensure(){
    if(running())return;
    if(!starting)starting=spawnAppServer().finally(()=>{starting=null;});
    return starting;
  }
  async function checkInstallation(){
    try{
      const binary=await executableFor(root,executable);
      const version=await new Promise((resolve,reject)=>{
        const proc=spawnProcess(binary.command,[...binary.prefix,'--version'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});
        let text='';const timeout=setTimeout(()=>{proc.kill();reject(err(504,'Codex --version 超时'));},4000);
        proc.stdout.on('data',chunk=>{text+=limited(chunk,200)});
        proc.once('error',e=>{clearTimeout(timeout);reject(e)});
        proc.once('close',code=>{clearTimeout(timeout);code===0?resolve(text.trim()):reject(new Error('codex --version failed'));});
      });
      return {installed:true,version};
    }catch(error){return {installed:false,version:'',message:error.message};}
  }
  function configModels(result){
    if(config)return [{id:'strip-local/'+config.model,providerID:'strip-local',modelID:config.model,name:config.model,enabled:true,variants:[]}];
    return (result?.data||[]).filter(m=>!m.hidden).map(m=>({id:'openai/'+(m.model||m.id),providerID:'openai',modelID:m.model||m.id,name:m.displayName||m.model||m.id,enabled:true,variants:(m.supportedReasoningEfforts||[]).map(v=>({id:v.reasoningEffort,settings:{reasoningEffort:v.reasoningEffort}}))}));
  }
  async function createSession(body){
    const work=body.location?.directory||root;
    const opts={cwd:work};
    if(body.model?.id)opts.model=body.model.id;
    const result=await rpc('thread/start',opts,30000);
    if(!result?.thread?.id)throw err(502,'Codex 未返回 thread ID。');
    const id='ses_'+randomBytes(10).toString('hex');
    const s={id,threadId:result.thread.id,workspace:work,model:body.model,title:body.title||'Codex',createdAt:Date.now(),messages:[],diffMap:{},active:false,currentTurn:null,pending:[],forms:[],loaded:true};
    sessions.set(id,s);await persist(s);
    return asData({id,title:s.title});
  }
  async function request(route,body,method=body===undefined?'GET':'POST'){
    await ensure();
    if(route.startsWith('/api/model')){
      const catalog=config?{data:[]}:await rpc('model/list',{limit:100,includeHidden:false});
      return asData(configModels(catalog));
    }
    if(route==='/api/session/active'){
      return asData(Object.fromEntries([...sessions.values()].filter(s=>s.active).map(s=>[s.id,{status:'busy'}])));
    }
    if(route==='/api/session' && method==='POST')return createSession(body||{});
    const m=/^\/api\/session\/(ses_[a-zA-Z0-9]+)(?:\/(.*))?$/.exec(route);
    if(!m)throw err(404,'Codex 不支持此路由：'+route);
    const s=await readSession(m[1]);const action=m[2]||'';
    if(method==='DELETE' && !action){
      if(s.active)throw err(409,'任务运行时不能删除。');
      await rpc('thread/delete',{threadId:s.threadId});
      sessions.delete(s.id);await saves.catch(()=>{});
      await fs.rm(path.join(folder,s.id+'.json'),{force:true});
      return asData({ok:true});
    }
    if(action.startsWith('message') && method==='GET')return asData(s.messages.slice(0,100));
    if(action==='diff' && method==='GET')return asData(Object.values(s.diffMap));
    if(action==='permission' && method==='GET')return asData(s.pending.map(({rpcId,kind,...visible})=>visible));
    if(action==='form' && method==='GET')return asData(s.forms.map(({rpcId,...visible})=>visible));
    if(action==='prompt' && method==='POST'){
      if(s.active)throw err(409,'当前 Codex 任务正在运行。');
      const prompt=String(body?.text||'');if(!prompt.trim())throw err(400,'请填写任务内容。');
      // Codex resumes its own stored thread; UI history is separately persisted.
      if(!s.loaded){await rpc('thread/resume',{threadId:s.threadId},30000);s.loaded=true;}
      const now=Date.now();const userId='msg_'+randomBytes(9).toString('hex'),assistantId='msg_'+randomBytes(9).toString('hex');
      s.messages.unshift({id:userId,type:'user',text:prompt,time:{created:now}});
      s.messages.unshift({id:assistantId,type:'assistant',text:'',content:[],time:{created:now},model:s.model});
      s.assistantId=assistantId;s.parts={};s.diffMap={};s.pending=[];s.forms=[];s.active=true;
      const input=[{type:'text',text:prompt}];
      // Explicitly-mentioned skills are supplied with the documented skill input.
      const folderSkills=path.join(root,'.runtime','skills-enabled');
      for(const [,name] of prompt.matchAll(/\$([a-z][a-z0-9-]{1,80})/g)){
        const skillFile=path.join(folderSkills,name,'SKILL.md');
        if(path.dirname(skillFile)!==path.join(folderSkills,name))continue;
        try{if((await fs.stat(skillFile)).isFile())input.push({type:'skill',name,path:skillFile});}catch{}
      }
      try{
        const result=await rpc('turn/start',{
          threadId:s.threadId,input,cwd:s.workspace,model:s.model?.id||undefined,
          ...(s.model?.variant?{effort:s.model.variant}:{}),
          approvalPolicy:'on-request',sandboxPolicy:{type:'workspaceWrite',writableRoots:[s.workspace],networkAccess:false},
        },30000);
        s.currentTurn=result.turn?.id||s.currentTurn;
        await persist(s);
        return asData({started:true,turnId:s.currentTurn});
      }catch(error){s.active=false;const a=assistant(s);if(a){a.error=error.message;a.time.completed=Date.now();}await persist(s);throw error;}
    }
    if(action==='interrupt' && method==='POST'){
      const turnId=s.active?s.currentTurn:null;
      if(turnId){
        // The interrupt RPC acknowledges the request, not completion. Keep the
        // workspace reserved until the matching turn has actually ended.
        let timer,listener;
        const completed=new Promise((resolve,reject)=>{
          listener=event=>{if(event.type==='session.turn.completed' && event.data?.sessionID===s.id)resolve();else if(event.type==='session.disconnected')reject(err(503,'Codex 连接已断开。'));};
          listeners.add(listener);
          timer=setTimeout(()=>reject(err(504,'尚未确认任务中断；工作区仍被锁定，请稍后重试。')),15000);
        });
        completed.catch(()=>{});
        try{await rpc('turn/interrupt',{threadId:s.threadId,turnId});await completed;}
        finally{clearTimeout(timer);listeners.delete(listener);}
      }
      if(!turnId){
        s.active=false;s.currentTurn=null;
        for(const p of s.pending)respond(p.rpcId,{decision:'cancel'});
        s.pending=[];s.forms=[];
      }
      void persist(s).catch(()=>{});
      return asData({stopped:true});
    }
    const reply=action.match(/^permission\/(per_[a-zA-Z0-9]+)\/reply$/);
    if(reply && method==='POST'){
      const index=s.pending.findIndex(p=>p.id===reply[1]);if(index<0)throw err(404,'审批请求已失效。');
      if(body?.decision==='always')throw err(400,'Codex 当前会话授权不是永久规则，请选择仅允许本次。');
      if(!['once','reject'].includes(body?.decision))throw err(400,'审批决定无效。');
      const [approval]=s.pending.splice(index,1);
      respond(approval.rpcId,{decision:body.decision==='once'?'accept':'decline'});
      return asData({ok:true});
    }
    const form=action.match(/^form\/(frm_[a-zA-Z0-9]+)\/reply$/);
    if(form && method==='POST'){
      const index=s.forms.findIndex(p=>p.id===form[1]);if(index<0)throw err(404,'问题已经结束。');
      const [record]=s.forms.splice(index,1);
      const answers=Object.fromEntries(Object.entries(body?.answer||{}).map(([key,value])=>[key,{answers:Array.isArray(value)?value.map(String):[String(value??'')]}]));
      respond(record.rpcId,{answers});return asData({ok:true});
    }
    throw err(404,'Codex 不支持此路由：'+route);
  }
  async function close(){
    closing=true;
    for(const s of sessions.values()){
      s.loaded=false;
      if(s.active && s.currentTurn && child && !child.stdin.destroyed){try{await rpc('turn/interrupt',{threadId:s.threadId,turnId:s.currentTurn},1500);}catch{}}
      s.active=false;s.pending=[];s.forms=[];await persist(s);
    }
    await saves.catch(()=>{});
    initialized=false;
    const current=child;child=null;
    if(localBridge){const old=localBridge;localBridge=null;await old.close();}
    if(current && current.exitCode===null){current.stdin.end();setTimeout(()=>{if(current.exitCode===null)current.kill();},750).unref?.();}
    for(const task of pending.values()){clearTimeout(task.timer);task.reject(err(503,'Codex app-server 已关闭。'));}
    pending.clear();
    // The service re-subscribes after integration reload. Old event observers
    // must not be retained or metrics and updates can be counted twice.
    listeners.clear();
    notificationListeners.clear();
  }
  return {ensure,request,rpc:async(...args)=>{await ensure();return rpc(...args);},
    subscribe:async(onEvent,onDisconnect)=>{listeners.add(onEvent);return()=>{listeners.delete(onEvent);onDisconnect?.();};},
    onNotification(callback){notificationListeners.add(callback);return()=>notificationListeners.delete(callback);},
    checkInstallation,close,bridgeInfo:()=>({mode:config?.mode==='chat'?'chat-to-responses':config?.mode==='native'?'responses-native':'none',enabled:!!config,active:!!localBridge}),executable:executable||path.join(root,'agent-runtime','node_modules','@openai','codex','bin','codex.js'),native};
}
module.exports={createEngine,customProvider,executableFor};
