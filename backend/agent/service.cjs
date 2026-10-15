'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {createEngine} = require('./engine.cjs');
const {httpError,requireLocalUrl} = require('../providers.cjs');
// OpenCode model IDs identify local variants; modelID is only the upstream slug.
const catalogID = m => typeof m.id === 'string' ? m.id.replace(new RegExp('^'+m.providerID+'/'),'') : m.modelID;

function createAgentService({root,allowNative = true,apiKey,endpoint,model,provider = 'openai',connection:initialConnection = 'local',executable,engineFactory = createEngine,engine = engineFactory({root,apiKey,endpoint,model,provider,executable}),workspaceBase = path.dirname(root)} = {}) {
  let configured = {endpoint,model,provider},connection = initialConnection,started = false;
  const ensure = async () => {await engine.ensure();started = true;};
  const sameConfig = (a,b) => ['endpoint','model','provider','connection'].every(key => a?.[key] === b?.[key]);
  const currentConfig = () => ({...configured,connection});
  const file = path.join(root,'.runtime','agent-sessions.json');
  let owned,writeQueue = Promise.resolve();
  const load = async () => {
    if (owned) return;
    try {owned = JSON.parse(await fs.readFile(file,'utf8'));} catch {owned = {};}
  };
  const save = () => {writeQueue = writeQueue.catch(() => {}).then(async () => {await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(owned));await fs.rename(file+'.tmp',file);});return writeQueue;};
  async function workspace(value) {
    const base = await fs.realpath(workspaceBase);
    const target = await fs.realpath(typeof value === 'string' ? value : root).catch(() => {throw httpError(400,'项目目录不存在。');});
    const relative = path.relative(base,target);
    if (relative.startsWith('..'+path.sep) || relative === '..' || path.isAbsolute(relative)) throw httpError(403,'项目必须位于工作区目录内。');
    if (!(await fs.stat(target)).isDirectory()) throw httpError(400,'项目路径必须是目录。');
    return target;
  }
  async function session(id) {
    await load();
    if (typeof id !== 'string' || !/^ses_[a-zA-Z0-9]+$/.test(id) || !owned[id]) throw httpError(404,'当前 Strip Bot 没有这个 Agent 会话。');
    return id;
  }
  async function configure(body) {
        const native = body.provider === 'opencode';
        const endpoint = native ? '' : requireLocalUrl(body.endpoint).href;
        if (!native && (!['openai','responses'].includes(body.provider) || typeof body.model !== 'string' || !body.model.trim() || body.model.length > 150)) throw httpError(400,'Agent 需要有效模型接口。');
        const nextConnection = native ? 'opencode' : body.connection === 'ccswitch' ? 'ccswitch':'local';
        const model = native ? '' : body.model;
        if (configured.endpoint === endpoint && configured.model === model && configured.provider === body.provider && connection === nextConnection) return {ok:true,connection};
        if (started) {
          const active = await engine.request('/api/session/active');
          if (Object.keys(active.data || {}).length) throw httpError(409,'请停止正在运行的 Agent 任务，再更换模型接口。');
        }
        await engine.close();configured = {endpoint,model,provider:body.provider};
        connection = nextConnection;
        started = false;
        engine = engineFactory({root,apiKey:native ? '' : connection === 'ccswitch' ? 'PROXY_MANAGED':apiKey,...configured,executable});
        return {ok:true,connection};

  }
  const service = {
    close:() => engine.close(),
    async handle(method,route,body = {}) {
      if (route === '/status' && method === 'GET') {
        const installed = await fs.access(engine.executable).then(() => true,() => false);
        return {installed,engine:'OpenCode',version:'2.0.28',workspace:root,workspaceBase};
      }
      if (route === '/configure' && method === 'POST') return configure(body);
      if (route === '/sessions' && method === 'POST' && body.configuration) {
        await configure(body.configuration);
        if (connection !== 'opencode') body = {...body,model:{providerID:'strip-local',id:configured.model}};
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
        const expected = connection === 'opencode' ? 'openai':'strip-local';
        return {connection,models:list.filter(m => m.providerID === expected && m.enabled !== false).map(m => ({id:catalogID(m),providerID:m.providerID,name:m.name || m.id}))};
      }
      if (route === '/sessions' && method === 'POST') {
        const directory = await workspace(body.workspace);
        const native = connection === 'opencode',expected = native ? 'openai':'strip-local';
        if (!body.model || body.model.providerID !== expected || typeof body.model.id !== 'string' || !/^[\w.\-/:]{1,150}$/.test(body.model.id) || (configured.model && body.model.id !== configured.model)) throw httpError(400,'请选择当前连接的可用模型。');
        if (native) {
          const available = await engine.request('/api/model');
          if (!available.data?.some(m=>m.providerID === 'openai' && catalogID(m) === body.model.id && m.enabled !== false)) throw httpError(400,'此 OpenAI 模型不可用，请完成专用 OpenCode 登录并刷新模型。');
        }
        const result = await engine.request('/api/session',{title:typeof body.title === 'string' ? body.title.slice(0,100) : 'Strip Bot Agent',agent:'build',model:body.model,location:{directory},permissions:[{action:'*',resource:'*',effect:'ask'}]});
        await load();owned[result.data.id] = {workspace:directory,createdAt:Date.now(),configuration:currentConfig(),model:body.model,followCurrent:body.followCurrent === true};await save();
        return {session:{...result.data,model:body.model}};
      }
      const match = /^\/sessions\/(ses_[a-zA-Z0-9]+)(?:\/(prompt|interrupt|permissions|forms))?$/.exec(route);
      if (!match) throw httpError(404,'Unknown Agent route');
      const id = await session(match[1]),action = match[2],upstream = '/api/session/'+id;
      if (!action && method === 'GET') {
        const [messages,permissions,active,diff,forms] = await Promise.all([
          engine.request(upstream+'/message?limit=100'),engine.request(upstream+'/permission'),engine.request('/api/session/active'),engine.request(upstream+'/diff'),engine.request(upstream+'/form'),
        ]);
        return {sessionID:id,workspace:owned[id].workspace,model:owned[id].model,configurationChanged:owned[id].configuration ? !sameConfig(owned[id].configuration,currentConfig()):false,messages:messages.data,permissions:permissions.data,running:Boolean(active.data?.[id]),diff:diff.data,forms:forms.data};
      }
      if (action === 'prompt' && method === 'POST') {
        if (!allowNative && owned[id].configuration?.provider === 'opencode') throw httpError(410,'此账号授权会话仅供查看，请新建 CC Switch 对话。');
        if (body.provider === 'opencode' && owned[id].configuration?.provider !== 'opencode') throw httpError(409,'这是旧代理会话，请新建原生 OpenCode 对话。');
        if (!owned[id].configuration?.model && connection === 'ccswitch') throw httpError(409,'旧任务缺少模型绑定信息，请新建任务。');
        if (owned[id].configuration && !sameConfig(owned[id].configuration,currentConfig())) throw httpError(409,'此任务绑定的模型配置已改变，请新建任务。旧任务记录仍可查看。');
        if (owned[id].followCurrent && body.routeModel && owned[id].model?.id !== body.routeModel) throw httpError(409,'CC Switch 当前模型已改变，请新建任务以使用新模型。');
        const active = await engine.request('/api/session/active');
        if (active.data?.[id]) throw httpError(409,'当前任务正在运行，请等待完成或停止后再发送。');
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 60000) throw httpError(400,'任务内容不能为空或超过 60000 字符。');
        return engine.request(upstream+'/prompt',{text:body.text});
      }
      if (action === 'interrupt' && method === 'POST') return engine.request(upstream+'/interrupt',{});
      if (action === 'permissions' && method === 'POST') {
        if (!/^per_[a-zA-Z0-9]+$/.test(body.requestID || '') || !['once','always','reject'].includes(body.decision)) throw httpError(400,'无效的审批决定。');
        const pending = await engine.request(upstream+'/permission');
        const permission = pending.data.find(p => p.id === body.requestID && p.sessionID === id);
        if (!permission) throw httpError(404,'审批请求不属于当前会话或已结束。');
        if (body.decision === 'always' && (!Array.isArray(permission.save) || !permission.save.length || permission.save.some(p => typeof p !== 'string' || !p.trim()))) throw httpError(409,'引擎未提供可保存的授权规则，请选择允许本次。');
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
  return {close:async () => {await queue;await engine.close();},handle(...args) {
    const result = queue.then(() => service.handle(...args));queue = result.catch(() => {});return result;
  }};
}
module.exports = {createAgentService};

