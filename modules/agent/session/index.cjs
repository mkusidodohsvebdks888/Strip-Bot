'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {createEngine} = require('../engine/codex-engine.cjs');
const {createTaskScheduler} = require('../scheduler/index.cjs');
const {gitPreflight} = require('../safety/git-preflight.cjs');
const {snapshot} = require('../safety/worktree-snapshot.cjs');
const {compareSnapshot} = require('../safety/worktree-diff.cjs');
const {restoreSnapshotFile} = require('../safety/worktree-restore.cjs');
const {createModelMetrics}=require('../metrics/index.cjs');
const {httpError,requireLocalUrl} = require('../../core/providers/index.cjs');
const {readChangedFile,runManualCommand,MAX_PROMPT_CHARS,MAX_FILE_BYTES} = require('../workspace/index.cjs');
// Compatibility format for the existing renderer; the runtime now uses Codex CLI.
const catalogID = m => typeof m.id === 'string' ? m.id.replace(new RegExp('^'+m.providerID+'/'),'') : m.modelID;

function createAgentService({root,allowNative = true,directApiKey=()=>'',apiKey,endpoint,model,provider = 'openai',connection:initialConnection = 'local',executable,engineFactory = createEngine,engine = engineFactory({root,apiKey,endpoint,model,provider,executable}),workspaceBase = path.dirname(root),backendRegistry = require('../../integrations/backends/index.cjs').createBackendRegistry({root})} = {}) {
  let configured = {endpoint,model,provider},connection = initialConnection,started = false;
  const autoApprovalSessions=new Set(); // Process-local; never persist authority in history.
  const metrics=createModelMetrics();let watching=false;
  const scheduler=createTaskScheduler({root,getEngine:()=>engine,onBeforeStart:async task=>{
    const preflight=await gitPreflight(task.workspace);
    const captured=await snapshot({workspace:task.workspace,root,taskID:task.id});
    preflight.snapshot=captured;
    // Fail closed when a Git project cannot be snapshotted. Non-Git workspaces remain supported.
    if(preflight.git && !captured.available){
      const error=new Error('执行前快照不可用：'+(captured.reason||'unknown')+'。为保护现有修改，已阻止任务启动。');
      error.status=409;
      throw error;
    }
    await ensure();metrics.begin(task.sessionID,owned?.[task.sessionID]?.model?.id,({codex:'Codex CLI · ChatGPT',ccswitch:'CC Switch',direct:'API 连接'})[connection] || 'Codex CLI');
    return preflight;
  }});
  const ensure = async () => {await engine.ensure();started = true;if(!watching && engine.subscribe){const source=engine;watching=true;try{await source.subscribe(event=>{if(source===engine){scheduler.onEvent(event);if(owned?.[event?.data?.sessionID])metrics.event(event);}},()=>{if(source===engine){watching=false;metrics.disconnect();}});}catch{watching=false;metrics.disconnect();}}};
  const sameConfig = (a,b) => ['endpoint','model','provider','connection'].every(key => a?.[key] === b?.[key]);
  const currentConfig = () => ({...configured,connection});
  const file = path.join(root,'.runtime','agent-sessions.json');
  let owned,writeQueue = Promise.resolve();
  const activeManualCommands=new Set();
  const manualPromises=new Set();
  const load = async () => {
    if (owned) return;
    try {owned = JSON.parse(await fs.readFile(file,'utf8'));} catch {owned = {};}
  };
  const save = () => {writeQueue = writeQueue.catch(() => {}).then(async () => {await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(owned));await fs.rename(file+'.tmp',file);});return writeQueue;};
  async function workspace(value) {
    const base = await fs.realpath(workspaceBase);
    const target = await fs.realpath(typeof value === 'string' ? value : root).catch(() => {throw httpError(400,'项目目录不存在。');});
    const relative = path.relative(base,target);
    if ((relative.startsWith('..'+path.sep) || relative === '..' || path.isAbsolute(relative)) && !await backendRegistry.allowed(target)) throw httpError(403,'项目不在默认工作区或已授权的本地后端目录内。请先通过「本地后端」连接。');
    if (!(await fs.stat(target)).isDirectory()) throw httpError(400,'项目路径必须是目录。');
    return target;
  }
  async function session(id) {
    await load();
    if (typeof id !== 'string' || !/^ses_[a-zA-Z0-9]+$/.test(id) || !owned[id]) throw httpError(404,'当前 Strip Bot 没有这个 Agent 会话。');
    return id;
  }
  async function configure(body) {
        const native = ['codex','opencode'].includes(body.provider);
        const endpoint = native ? '' : requireLocalUrl(body.endpoint).href;
        if (!native && (!['openai','responses'].includes(body.provider) || typeof body.model !== 'string' || !body.model.trim() || body.model.length > 150)) throw httpError(400,'Agent 需要有效模型接口。');
        const nextConnection = native ? 'codex' : ['ccswitch','direct'].includes(body.connection) ? body.connection:'local';
        const model = native ? '' : body.model;
        if (configured.endpoint === endpoint && configured.model === model && configured.provider === (native ? 'codex' : body.provider) && connection === nextConnection) return {ok:true,connection};
        if (await scheduler.hasOutstanding()) throw httpError(409,'仍有排队、暂停或执行中的任务，请先完成或取消，再更换模型接口。');
        if (started) {
          const active = await engine.request('/api/session/active');
          if (Object.keys(active.data || {}).length) throw httpError(409,'请停止正在运行的 Agent 任务，再更换模型接口。');
        }
        autoApprovalSessions.clear();await engine.close();configured = {endpoint,model,provider:native?'codex':body.provider};
        connection = nextConnection;
        started = false;watching=false;
        engine = engineFactory({root,apiKey:native ? '' : connection === 'direct' ? await directApiKey():connection === 'ccswitch' ? 'PROXY_MANAGED':apiKey,...configured,executable});
        return {ok:true,connection};

  }
  const service = {
    close:() => engine.close(),
    async handle(method,route,body = {}) {
      if (route === '/tasks' && method === 'GET') return scheduler.overview();
      if (route === '/status' && method === 'GET') {
        const result = engine.checkInstallation ? await engine.checkInstallation() : {installed:await fs.access(engine.executable).then(()=>true,()=>false),version:'unknown'};
        return {...result,taskScheduler:await scheduler.overview(),engine:'Codex CLI (app-server)',bridge:engine.bridgeInfo?.() || {mode:'none',enabled:false},workspace:root,workspaceBase,limits:{promptChars:MAX_PROMPT_CHARS,attachmentBytes:MAX_FILE_BYTES,manualCommandSeconds:30}};
      }
      if (route === '/configure' && method === 'POST') return configure(body);
      if (route === '/sessions' && method === 'POST' && body.configuration) {
        await configure(body.configuration);
        if (connection !== 'codex') body = {...body,model:{providerID:'strip-local',id:configured.model}};
      }
      const existingID = /^\/sessions\/(ses_[a-zA-Z0-9]+)/.exec(route)?.[1];
      if (existingID && !started) {
        await session(existingID);
        if (owned[existingID].configuration?.provider) await configure(owned[existingID].configuration);
      }
      await ensure();
      if (route === '/models' && method === 'GET') {
        const result = await engine.request('/api/model?directory='+encodeURIComponent(root));
        const list = Array.isArray(result?.data) ? result.data : [];
        const expected = connection === 'codex' ? 'openai':'strip-local';
        return {connection,models:list.filter(m => m.providerID === expected && m.enabled !== false).map(m => ({id:catalogID(m),providerID:m.providerID,name:m.name || m.id}))};
      }
      if (route === '/sessions' && method === 'POST') {
        if(body.approvalMode!==undefined && !['ask','allow-all'].includes(body.approvalMode))throw httpError(400,'无效的审批模式。');
        if(body.approvalMode==='allow-all' && body.confirmApprovalMode!==true)throw httpError(400,'请先确认当前会话自动批准。');
        const directory = await workspace(body.workspace);
        const native = connection === 'codex',expected = native ? 'openai':'strip-local';
        if (!body.model || body.model.providerID !== expected || typeof body.model.id !== 'string' || !/^[\w.\-/:]{1,150}$/.test(body.model.id) || (configured.model && body.model.id !== configured.model)) throw httpError(400,'请选择当前连接的可用模型。');
        if (!native && body.reasoningVariant) throw httpError(400,'此渠道尚未声明推理强度能力。');
        if (native) {
          const available = await engine.request('/api/model');
          const entry=available.data?.find(m=>m.providerID === 'openai' && catalogID(m) === body.model.id && m.enabled !== false);
          if(body.model.variant!==undefined && !entry?.variants?.some(v=>v.id===body.model.variant && typeof v.settings?.reasoningEffort==='string')) throw httpError(400,'当前模型不支持此推理强度，请重新选择。');
          if (!entry) throw httpError(400,'Codex 模型不可用，请在 Codex CLI 登录 ChatGPT 账号或使用 API Key 后刷新模型。');
        }
        const result = await engine.request('/api/session',{title:typeof body.title === 'string' ? body.title.slice(0,100) : 'Strip Bot Agent',agent:'build',model:body.model,location:{directory},permissions:[{action:'*',resource:'*',effect:'ask'}]});
        await load();owned[result.data.id] = {workspace:directory,createdAt:Date.now(),configuration:currentConfig(),model:body.model,followCurrent:body.followCurrent === true};await save();
        if(body.approvalMode==='allow-all')autoApprovalSessions.add(result.data.id);
        return {session:{...result.data,model:body.model}};
      }
      const diffTask = /^\/sessions\/(ses_[a-zA-Z0-9]+)\/tasks\/(tsk_[a-f0-9]{20})\/diff$/.exec(route);
      if(diffTask && method==='GET'){
        const id=await session(diffTask[1]);
        const state=await scheduler.state(id);
        const task=state.tasks.find(entry=>entry.id===diffTask[2]);
        if(!task)throw httpError(404,'任务不存在或不属于当前会话。');
        if(!task.preflight?.snapshot?.available)throw httpError(409,'该任务没有可用的执行前快照。');
        return compareSnapshot({root,workspace:owned[id].workspace,taskID:task.id});
      }
      const restoreTask = /^\/sessions\/(ses_[a-zA-Z0-9]+)\/tasks\/(tsk_[a-f0-9]{20})\/restore$/.exec(route);
      if(restoreTask && method==='POST'){
        const id=await session(restoreTask[1]);
        const state=await scheduler.state(id);
        const task=state.tasks.find(entry=>entry.id===restoreTask[2]);
        if(!task)throw httpError(404,'任务不存在或不属于当前会话');
        if(!['done','failed','cancelled'].includes(task.status))throw httpError(409,'任务尚未结束，禁止恢复');
        if(await scheduler.hasOutstanding())throw httpError(409,'仍有任务正在执行或等待，请先处理队列');
        if(!task.preflight?.snapshot?.available)throw httpError(409,'该任务没有可用快照');
        return restoreSnapshotFile({root,workspace:owned[id].workspace,taskID:task.id,filePath:body.filePath,expectedHash:body.expectedHash,confirmed:body.confirmed});
      }
      const cancelTask = /^\/sessions\/(ses_[a-zA-Z0-9]+)\/tasks\/(tsk_[a-f0-9]{20})\/cancel$/.exec(route);
      if(cancelTask && method==='POST'){await session(cancelTask[1]);return scheduler.cancel(cancelTask[1],cancelTask[2]);}
      const match = /^\/sessions\/(ses_[a-zA-Z0-9]+)(?:\/(prompt|interrupt|pause|resume|tasks|permissions|forms|approval-mode|approve-all|command))?$/.exec(route);
      if (!match) throw httpError(404,'Unknown Agent route');
      const id = await session(match[1]),action = match[2],upstream = '/api/session/'+id;
      if (!action && method === 'DELETE') {
        await scheduler.assertEmpty(id);
        if(activeManualCommands.has(id))throw httpError(409,'手动命令正在运行，请结束后再删除。');
        const active=await engine.request('/api/session/active');
        if(active.data?.[id])throw httpError(409,'会话正在运行，请先停止再删除。');
        // Delete in Codex before dropping Strip Bot ownership: errors leave the index intact.
        await engine.request(upstream,undefined,'DELETE');
        autoApprovalSessions.delete(id);
        await scheduler.forget(id);
        delete owned[id];
        await save();
        return {ok:true,sessionID:id,deleted:true};
      }
      if (!action && method === 'GET') {
        const [messages,permissions,active,diff,forms] = await Promise.all([
          engine.request(upstream+'/message?limit=100'),engine.request(upstream+'/permission'),engine.request('/api/session/active'),engine.request(upstream+'/diff'),engine.request(upstream+'/form'),
        ]);
        const tasks=await scheduler.state(id);
        return {sessionID:id,tasks:tasks.tasks,queuePaused:tasks.paused,queueCount:tasks.queued,maxParallel:tasks.maxParallel,parallelRunning:tasks.activeCount,approvalMode:autoApprovalSessions.has(id)?'allow-all':'ask',workspace:owned[id].workspace,connection:owned[id].configuration?.connection,connectionRevision:/\/proxy\/([a-f0-9]+)\//.exec(owned[id].configuration?.endpoint || '')?.[1],model:owned[id].model,configurationChanged:owned[id].configuration ? !sameConfig(owned[id].configuration,currentConfig()):false,messages:messages.data,permissions:permissions.data.filter(p=>p.sessionID===id),running:Boolean(active.data?.[id]),manualRunning:activeManualCommands.has(id),diff:diff.data,forms:forms.data,metrics:metrics.snapshot(id,messages.data || [],owned[id].model?.id,({codex:'Codex CLI · ChatGPT',ccswitch:'CC Switch',direct:'API 连接'})[owned[id].configuration?.connection] || 'Codex CLI')};
      }
      if(action==='tasks' && method==='GET') return scheduler.state(id);
      if (action === 'command' && method === 'POST') {
        if (activeManualCommands.has(id)) throw httpError(409,'已有手动命令正在运行。');
        if (await scheduler.hasOutstanding()) throw httpError(409,'请先完成或取消执行队列，再运行手动命令。');
        const active=await engine.request('/api/session/active');
        if (active.data?.[id])throw httpError(409,'AI 正在执行任务，请结束后再运行手动命令。');
        const [permissions,forms]=await Promise.all([engine.request(upstream+'/permission'),engine.request(upstream+'/form')]);
        if(permissions.data?.some(item=>item.sessionID===id) || forms.data?.some(item=>item.sessionID===id))throw httpError(409,'请先处理会话中的审批或问题。');
        // Shell access is opt-in per click, independent of Agent auto-approvals.
        activeManualCommands.add(id);
        const workspace=owned[id].workspace;
        // Reserve while serialized, execute outside the queue so polling stays responsive.
        return {runManual:async()=>{
          try{return await runManualCommand({workspace,command:body.command,confirmed:body.confirmed,timeoutMs:body.timeoutMs ?? 30000});}
          finally{activeManualCommands.delete(id);}
        }};
      }
      if (action === 'prompt' && method === 'POST') {
        if(activeManualCommands.size)throw httpError(409,'手动命令正在运行，请结束后再发送任务。');
        if((body.provider==='direct') !== (owned[id].configuration?.connection==='direct'))throw httpError(409,'此会话属于另一种连接，请新建对话。');
        if(body.provider==='direct' && body.routeEndpoint!==owned[id].configuration?.endpoint)throw httpError(409,'API 配置已变化，请新建对话。');
        if (!allowNative && ['codex','opencode'].includes(owned[id].configuration?.provider)) throw httpError(410,'此账号授权会话仅供查看，请新建 CC Switch 对话。');
        if (body.provider && !['codex','opencode'].includes(body.provider) && ['codex','opencode'].includes(owned[id].configuration?.provider)) throw httpError(409,'此会话使用 ChatGPT 账号，请切换连接或新建对话。');
        if (['codex','opencode'].includes(body.provider) && !['codex','opencode'].includes(owned[id].configuration?.provider)) throw httpError(409,'这是旧代理会话，请新建 Codex CLI 对话。');
        if (!owned[id].configuration?.model && connection === 'ccswitch') throw httpError(409,'旧任务缺少模型绑定信息，请新建任务。');
        if (owned[id].configuration && !sameConfig(owned[id].configuration,currentConfig())) throw httpError(409,'此任务绑定的模型配置已改变，请新建任务。旧任务记录仍可查看。');
        if (owned[id].followCurrent && body.routeModel && owned[id].model?.id !== body.routeModel) throw httpError(409,'CC Switch 当前模型已改变，请新建任务以使用新模型。');
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > MAX_PROMPT_CHARS) throw httpError(400,`任务内容不能为空或超过 ${MAX_PROMPT_CHARS} 字符。`);
        return scheduler.submit({sessionID:id,workspace:owned[id].workspace,text:body.text});
      }
      if(action==='pause' && method==='POST'){autoApprovalSessions.delete(id);return scheduler.pause(id);}
      if(action==='resume' && method==='POST')return scheduler.resume(id);
      if(action==='interrupt' && method==='POST') {
        autoApprovalSessions.delete(id);
        const result=await scheduler.stop(id);metrics.finish(id);return result;
      }
      if(action==='approval-mode' && method==='POST'){
        if(!['ask','allow-all'].includes(body.mode) || (body.mode==='allow-all' && body.confirmed!==true))throw httpError(400,'请明确确认当前会话自动批准。');
        if(body.mode==='allow-all')autoApprovalSessions.add(id);else autoApprovalSessions.delete(id);
        return {mode:body.mode,sessionID:id};
      }
      if(action==='approve-all' && method==='POST'){
        if(body.automatic===true ? !autoApprovalSessions.has(id) : body.confirmed!==true)throw httpError(400,'当前会话未授权批量批准。');
        if(!Array.isArray(body.requestIDs) || !body.requestIDs.length || body.requestIDs.length>200 || !body.requestIDs.every(value=>typeof value==='string' && /^per_[a-zA-Z0-9]+$/.test(value)))throw httpError(400,'请提供当前待审批请求。');
        const pending=await engine.request(upstream+'/permission'),wanted=new Set(body.requestIDs);
        const approved=[],failures=[];
        for(const p of pending.data){
          if(p.sessionID!==id || !wanted.has(p.id))continue;
          try{await engine.request(upstream+'/permission/'+p.id+'/reply',{decision:'once'});approved.push(p.id);}
          catch(error){if(error.status===404)continue;failures.push({id:p.id,message:error.message || '批准失败'});autoApprovalSessions.delete(id);break;}
        }
        return {sessionID:id,approved,failures,approvalMode:autoApprovalSessions.has(id)?'allow-all':'ask'};
      }
      if (action === 'permissions' && method === 'POST') {
          if(body.decision==='reject')autoApprovalSessions.delete(id);
          if (!/^per_[a-zA-Z0-9]+$/.test(body.requestID || '') || !['once','always','reject'].includes(body.decision)) throw httpError(400,'无效的审批决定。');
        const pending = await engine.request(upstream+'/permission');
          const permission = pending.data.find(p => p.id === body.requestID && p.sessionID === id);
          if (!permission) throw httpError(404,'审批请求不属于当前会话或已结束。');
          if (body.decision === 'always') {
            if (!Array.isArray(permission.save) || !permission.save.length || !permission.save.every(rule => typeof rule === 'string' && rule.trim())) throw httpError(400,'引擎未提供可保存的授权规则。');
            if (body.confirmed !== true || body.confirmedAction !== permission.action || JSON.stringify(body.confirmedRules) !== JSON.stringify(permission.save)) throw httpError(400,'请重新核对并确认项目授权规则。');
          }
          // The engine owns persistence and matching; never forward caller-supplied rules.
        return engine.request(upstream+'/permission/'+body.requestID+'/reply',{decision:body.decision});
      }
      if (action === 'forms' && method === 'POST') {
        if (!/^frm_[a-zA-Z0-9]+$/.test(body.formID || '') || !body.answer || typeof body.answer !== 'object') throw httpError(400,'无效的问题答复。');
        const forms = await engine.request(upstream+'/form');
        if (!forms.data.some(form => form.id === body.formID && form.sessionID === id)) throw httpError(404,'问题不属于当前会话或已结束。');
        return engine.request(upstream+'/form/'+body.formID+'/reply',{answer:body.answer});
      }
      throw httpError(405,'Method not allowed');
    },
  };
  let queue = Promise.resolve();
  return {reloadIntegrations() {
    const result=queue.then(async()=>{
      if(activeManualCommands.size)throw httpError(409,'手动命令正在运行，请结束后再应用工具配置。');
      if (await scheduler.hasOutstanding())throw httpError(409,'仍有待处理任务，请先完成或取消，再重载工具。');
      if (!started) return {ok:true,reloaded:false,message:'已保存；首次启动 Agent 时将加载工具和 Skills。'};
      const active=await engine.request('/api/session/active');
      if (Object.keys(active.data || {}).length) throw httpError(409,'当前存在正在执行的任务，请先结束任务再应用工具配置。');
      await engine.close();started=false;watching=false;autoApprovalSessions.clear();
      await ensure();return {ok:true,reloaded:true,message:'工具和 Skills 已重新加载；原自动批准已恢复为逐次批准。'};
    });queue=result.catch(()=>{});return result;
  },async downloadOutput(id,relativePath) {
    await session(id);
    await ensure();
    const result=await engine.request('/api/session/'+id+'/diff');
    return readChangedFile(owned[id].workspace,relativePath,result.data);
  },close:async () => {autoApprovalSessions.clear();await queue;await scheduler.close();await Promise.allSettled([...manualPromises]);await engine.close();},handle(...args) {
    const result = queue.then(() => service.handle(...args));queue = result.catch(() => {});
    return result.then(plan=>{
      if(typeof plan?.runManual!=='function')return plan;
      const task=plan.runManual();manualPromises.add(task);
      task.then(()=>manualPromises.delete(task),()=>manualPromises.delete(task));return task;
    });
  }};
}
module.exports = {createAgentService};

