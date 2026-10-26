'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {httpError, requireLocalUrl, bridgeRules, upstreamPayload, sse, pumpResponse} = require('./providers.cjs');
const {createAgentService} = require('./agent/service.cjs');
const {createCcSwitch} = require('./ccswitch.cjs');
const {createApiConnection} = require('./api-connection.cjs');
const {createAccount} = require('./codex-account.cjs');
const {createIntegrationRegistry} = require('./integrations.cjs');
const {createBackendRegistry} = require('./backend-projects.cjs');
const {createSkillsRegistry} = require('./skills.cjs');
const {createGithubTools} = require('./github-tools.cjs');
const {createNonoPlugin} = require('./nono-plugin.cjs');
const {createAstrBotPlugin} = require('./astrbot-plugin.cjs');
const {createBundledPlugins} = require('./bundled-plugins.cjs');
const openUI = require('../modules/integrations/openui/index.cjs');
const APP_VERSION = '1.5.2';
const DEFAULTS = Object.freeze({provider:'openai', endpoint:'http://127.0.0.1:3010/v1/chat/completions', model:'chatgpt', systemPrompt:'你是一个清晰、准确的中文 AI 助手。'});
const MIME = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/model-icons.js': ['model-icons.js', 'text/javascript; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
  '/brand-logo.png': ['brand-logo.png', 'image/png'],
  '/login-brand.jpg': ['login-brand.jpg', 'image/jpeg'],
  '/strip-bot.ico': ['strip-bot.ico', 'image/x-icon'],
  '/build-manifest.json': ['build-manifest.json', 'application/json; charset=utf-8'],
};

function respondJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}


/** Each gateway owns its config, credential and lifecycle; callers own listen/close. */
function createGateway({defaults = {}, apiKey = '', ccOnly = false, nativeAgent = false, ccSwitchOnly = false, connectionOptions = false,chatgptLogin = false,accountService,apiConnection, publicDir = path.join(__dirname, '..', 'public'), requestTimeoutMs = 600000, agentRoot = path.join(__dirname,'..'), agentService,agentExecutable,astrbotPlugin,ccSwitch = createCcSwitch()} = {}) {
  const config = Object.freeze({...DEFAULTS, ...defaults});
  const direct = apiConnection || createApiConnection({root:agentRoot});
  const integrations = createIntegrationRegistry({root:agentRoot});
  const backends = createBackendRegistry({root:agentRoot});
  const skills = createSkillsRegistry({root:agentRoot});
  const githubTools = createGithubTools({root:agentRoot});
  const agent = agentService || createAgentService({root:agentRoot,allowNative:!ccSwitchOnly || chatgptLogin,directApiKey:direct.internalKey,apiKey:nativeAgent ? '' : ccOnly ? 'PROXY_MANAGED':apiKey,endpoint:nativeAgent ? '' : ccOnly ? ccSwitch.endpoint:config.endpoint,model:nativeAgent ? '' : config.model || 'unconfigured',provider:nativeAgent ? 'codex' : ccOnly ? 'responses':config.provider,connection:nativeAgent ? 'codex' : ccOnly ? 'ccswitch':'local',executable:agentExecutable,backendRegistry:backends});
  const account=accountService || createAccount({root:agentRoot,executable:agentExecutable});
  const nono=createNonoPlugin({root:agentRoot,chat:(messages,signal)=>direct.companionChat(messages,signal)});
  const astrbot=astrbotPlugin || createAstrBotPlugin();
  const bundledPlugins=createBundledPlugins({root:agentRoot,nono});
  const PUBLIC_DIR = publicDir;
  const HOST = '127.0.0.1';
  const PORT = 3060; // URL parsing base only; Origin validation uses the actual bound port.
async function normalizeRequest(data) {
  if (!data || typeof data !== 'object') throw httpError(400, '请求数据无效。');
  if (data.provider === 'ccswitch') {const selected = await ccSwitch.resolve(data.model);return {...selected,endpoint:requireLocalUrl(selected.endpoint)};}
  if (ccOnly) throw httpError(410,'本地 API 模块已移除，请使用 CC Switch。');
  const provider = String(data.provider || config.provider);
  if (!['openai', 'responses', 'ollama', 'simple'].includes(provider)) throw httpError(400, '不支持的 API 类型。');
  const endpoint = requireLocalUrl(data.endpoint || config.endpoint);
  const model = String(data.model || config.model).trim().slice(0, 150);
  if (!model) throw httpError(400, '模型名不能为空。');
  return { provider, endpoint, model,apiKey };
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw httpError(413, '请求体过大，请减少输入内容或附件。');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw httpError(400, '请求体不是有效 JSON。'); }
}

function normalizedMessages(data) {
  if (!Array.isArray(data.messages)) throw httpError(400, 'messages 必须是消息数组。');
  const messages = data.messages.slice(-60).map(item => ({
    role: String(item.role || ''),
    content: typeof item.content === 'string' ? item.content.slice(0, 60000) : '',
  })).filter(item => ['user', 'assistant', 'system'].includes(item.role) && item.content.trim());
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    throw httpError(400, '最后一条消息必须是用户消息。');
  }
  const systemPrompt = typeof data.systemPrompt === 'string' ? data.systemPrompt.trim().slice(0, 4000) : '';
  if (systemPrompt) messages.unshift({ role: 'system', content: systemPrompt });
  return messages;
}

function authHeaders(key = apiKey) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream, application/x-ndjson' };
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function handleChat(req, res) {
  const data = await readJsonBody(req);
  const { provider, endpoint, model,apiKey:requestKey } = await normalizeRequest(data);
  const messages = normalizedMessages(data);
  const controller = new AbortController();
  let completed = false;
  const timeout = setTimeout(() => controller.abort(new Error('本地 API 请求超时。')), requestTimeoutMs);
  res.on('close', () => { if (!completed) controller.abort(); });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff',
  });
  res.write(': connected\n\n');
  try {
    const upstream = await fetch(endpoint.href, {
      method: 'POST',
      headers: authHeaders(requestKey),
      body: JSON.stringify(upstreamPayload(provider, model, messages, bridgeRules(data))),
      signal: controller.signal,
      redirect: 'manual',
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      throw new Error(`上游接口返回跳转 HTTP ${upstream.status}，请填写实际的本地 API 地址。`);
    }
    if (!upstream.ok) {
      const snippet = (await upstream.text()).slice(0, 360).replace(/\s+/g, ' ');
      throw new Error(`本地 API 返回 HTTP ${upstream.status}${snippet ? '：' + snippet : ''}`);
    }
    await pumpResponse(upstream, provider, res);
    sse(res, 'done', { ok: true });
  } catch (error) {
    if (!res.destroyed) {
      let message = controller.signal.aborted ? (controller.signal.reason?.message || '请求已取消') : error.message || '未知连接错误';
      if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH/i.test(message)) {
        message = `无法连接本地 API (${endpoint.origin})，请检查服务是否启动、端口和接口路径是否正确。`;
      }
      sse(res, 'error', { message });
    }
  } finally {
    completed = true;
    clearTimeout(timeout);
    if (!res.writableEnded) res.end();
  }
}

/**
 * Reads the upstream model list (the bridge exposes it at GET /v1/models) and
 * relays it to the page. Proxied on purpose: the browser cannot call the bridge
 * directly — it is a different origin and the bridge answers same-origin only.
 */
async function handleModels(req, res) {
  let endpoint;
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    endpoint = requireLocalUrl(url.searchParams.get('endpoint') || config.endpoint);
  } catch (error) {
    return respondJson(res, 200, { ok: false, models: [], message: 'API 地址无效，仅支持本机回环地址。' });
  }
  const modelsUrl = new URL('/v1/models', endpoint.origin);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const upstream = await fetch(modelsUrl.href, { method: 'GET', headers: authHeaders(), signal: controller.signal, redirect: 'manual' });
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
    const list = await upstream.json();
    const models = (Array.isArray(list?.data) ? list.data : []).map(model => ({
      id: String(model.id ?? ''),
      label: String(model.label ?? model.id ?? ''),
      provider: model.provider ? String(model.provider) : undefined,
      kind: model.kind ? String(model.kind) : undefined,
    })).filter(model => model.id);
    return respondJson(res, 200, { ok: true, models, source: modelsUrl.origin });
  } catch (error) {
    const reason = error.name === 'AbortError' ? '读取超时' : (error.message || '未知错误');
    return respondJson(res, 200, { ok: false, models: [], message: `无法读取模型列表：${reason}（${modelsUrl.origin}）` });
  } finally {
    clearTimeout(timeout);
  }
}

async function handleCheck(req, res) {
  const data = await readJsonBody(req);
  const { provider, endpoint,apiKey:requestKey } = await normalizeRequest(data);
  let target = endpoint;
  let method = 'HEAD';
  if (provider === 'ollama') {
    target = new URL('/api/tags', endpoint);
    method = 'GET';
  } else if (provider === 'responses' && /\/responses\/?$/.test(endpoint.pathname)) {
    target = new URL(endpoint.href);
    target.pathname = endpoint.pathname.replace(/\/responses\/?$/, '/models');
    method = 'GET';
  } else if (provider === 'openai' && /\/chat\/completions\/?$/.test(endpoint.pathname)) {
    target = new URL(endpoint.href);
    target.pathname = endpoint.pathname.replace(/\/chat\/completions\/?$/, '/models');
    method = 'GET';
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const result = await fetch(target.href, { method, headers: authHeaders(requestKey), signal: controller.signal, redirect: 'manual' });
    const status = result.status;
    await result.body?.cancel();
    respondJson(res, 200, {
      ok: status < 500 && status !== 401 && status !== 403,
      reachable: true,
      httpStatus: status,
      message: status === 401 || status === 403
        ? `本地服务可访问，但返回 HTTP ${status}（认证或权限错误）。`
        : `已访问本地服务（HTTP ${status}）。这是连通性测试，实际回复以发送消息为准。`,
    });
  } catch (error) {
    respondJson(res, 200, { ok: false, reachable: false, message: '本地 API 无法连接，请检查服务是否启动、端口是否正确。' });
  } finally { clearTimeout(timeout); }
}

async function serveStatic(res, pathname) {
  const assetMatch = /^\/assets\/([a-zA-Z0-9._-]+\.(js|css|jpe?g|png|webp|svg|woff2?))$/.exec(pathname);
  const assetMime = {js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',svg:'image/svg+xml',woff:'font/woff',woff2:'font/woff2'};
  const stripButtonIcon = /^\/strip-buttons\/icons\/([a-z0-9-]+)\.svg$/.exec(pathname)?.[1];
  const staticEntry = MIME[pathname] || (assetMatch
    ? ['assets/' + assetMatch[1], assetMime[assetMatch[1].split('.').pop()]]
    : null) || (stripButtonIcon
      ? ["strip-buttons/icons/" + stripButtonIcon + ".svg", "image/svg+xml"]
      : null);
  if (!staticEntry) return respondJson(res, 404, { error: 'Not found' });
  const [filename, mime] = staticEntry;
  let data;
  try { data = await fs.readFile(path.join(PUBLIC_DIR, filename)); }
  catch (error) { if (error.code === 'ENOENT') return respondJson(res, 404, {error:'Not found'}); throw error; }
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; frame-src 'self' http://127.0.0.1:7878",
  });
  res.end(data);
}

const app = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
    if (pathname.startsWith('/api/agent/') || pathname.startsWith('/api/cc-switch/') || pathname.startsWith('/api/connection/') || pathname.startsWith('/api/plugins/nono') || pathname.startsWith('/api/plugins/astrbot') || pathname.startsWith('/api/plugins/bundled') || pathname.startsWith('/api/openui/') || ['/api/integrations','/api/backend-projects','/api/skills','/api/github-tools'].some(prefix=>pathname===prefix || pathname.startsWith(prefix+'/'))) {
      try {const host = requireLocalUrl(`http://${req.headers.host}`);if (Number(host.port || 80) !== req.socket.localPort) throw new Error();}
      catch {return respondJson(res,403,{error:'无效的本机来源。'});}
      const origin = req.headers.origin;
      if (origin && origin !== `http://${req.headers.host}`) return respondJson(res,403,{error:'跨来源请求被拒绝。'});
      const outputMatch=/^\/api\/agent\/sessions\/(ses_[a-zA-Z0-9]+)\/output$/.exec(pathname);
      if (outputMatch && req.method==='GET') {
        if (typeof agent.downloadOutput !== 'function') throw httpError(501,'当前 Agent 服务不支持文件下载。');
        const filename=new URL(req.url,`http://${HOST}:${PORT}`).searchParams.get('path');
        const output=await agent.downloadOutput(outputMatch[1],filename);
        const safeName=output.filename.replace(/[\r\n"\\]/g,'_');
        res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':output.bytes.length,
          'Content-Disposition':`attachment; filename="${safeName.replace(/[^a-zA-Z0-9._-]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
          'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        res.end(output.bytes);return;
      }
      const deletingSession=req.method==='DELETE' && /^\/api\/agent\/sessions\/ses_[a-zA-Z0-9]+$/.test(pathname);
      if (!['GET','POST'].includes(req.method) && !deletingSession) return respondJson(res,405,{error:'Method not allowed'});
      if(pathname.startsWith('/api/openui/')) {
        if(pathname==='/api/openui/status' && req.method==='GET')return respondJson(res,200,await openUI.status());
        throw httpError(404,'OpenUI 接口不存在。');
      }
      if(pathname.startsWith('/api/plugins/bundled')) {
        if(pathname==='/api/plugins/bundled' && req.method==='GET')return respondJson(res,200,{items:await bundledPlugins.list()});
        if(pathname==='/api/plugins/bundled/enable' && req.method==='POST')return respondJson(res,200,await bundledPlugins.enable(await readJsonBody(req,2048)));
        if(pathname==='/api/plugins/bundled/execute' && req.method==='POST')return respondJson(res,200,await bundledPlugins.execute(await readJsonBody(req,8192)));
        throw httpError(404,'内置插件接口不存在。');
      }
      if(pathname.startsWith('/api/plugins/nono')){
        if(pathname==='/api/plugins/nono' && req.method==='GET')return respondJson(res,200,nono.status());
        if(pathname==='/api/plugins/nono/enable' && req.method==='POST')return respondJson(res,200,await nono.setEnabled((await readJsonBody(req,1024)).enabled));
        nono.authenticate(req.headers.authorization);
        if(pathname==='/api/plugins/nono/heartbeat' && req.method==='GET')return respondJson(res,200,nono.ready());
        if(pathname==='/api/plugins/nono/chat' && req.method==='POST'){
          const body=await readJsonBody(req,128*1024),controller=new AbortController();
          const abort=()=>{if(!res.writableEnded)controller.abort();};res.once('close',abort);
          try{return respondJson(res,200,await nono.chat(body.messages,controller.signal));}finally{res.removeListener('close',abort);}
        }
        return respondJson(res,404,{error:'插件接口不存在。'});
      }
      if(pathname.startsWith('/api/plugins/astrbot')) {
        if(pathname==='/api/plugins/astrbot/status' && req.method==='GET')return respondJson(res,200,await astrbot.status());
        return respondJson(res,404,{error:'AstrBot 插件接口不存在。'});
      }
      if(pathname.startsWith('/api/integrations')) {
        if (pathname === '/api/integrations' && req.method === 'GET') return respondJson(res,200,{items:await integrations.list()});
        if (pathname === '/api/integrations' && req.method === 'POST') return respondJson(res,200,await integrations.upsert(await readJsonBody(req)));
        if (pathname === '/api/integrations/enable' && req.method === 'POST') return respondJson(res,200,await integrations.enable(await readJsonBody(req)));
        if (pathname === '/api/integrations/remove' && req.method === 'POST') return respondJson(res,200,await integrations.remove(await readJsonBody(req)));
        if (pathname === '/api/integrations/permissions' && req.method === 'POST') return respondJson(res,200,await integrations.permissions(await readJsonBody(req)));
        if (pathname === '/api/integrations/permission' && req.method === 'POST') return respondJson(res,200,await integrations.setPermission(await readJsonBody(req)));
        if (pathname === '/api/integrations/probe' && req.method === 'POST') return respondJson(res,200,await integrations.probe(await readJsonBody(req)));
        if (pathname === '/api/integrations/inspect' && req.method === 'POST') return respondJson(res,200,await integrations.inspect(await readJsonBody(req)));
        if (pathname === '/api/integrations/reload' && req.method === 'POST') return respondJson(res,200,await agent.reloadIntegrations());
        throw httpError(404,'项目集成接口不存在。');
      }
      if(pathname.startsWith('/api/backend-projects')) {
        if(pathname==='/api/backend-projects' && req.method==='GET')return respondJson(res,200,{items:await backends.list()});
        if(pathname==='/api/backend-projects/inspect' && req.method==='POST')return respondJson(res,200,await backends.inspect(await readJsonBody(req)));
        if(pathname==='/api/backend-projects/connect' && req.method==='POST')return respondJson(res,200,await backends.connect(await readJsonBody(req)));
        if(pathname==='/api/backend-projects/remove' && req.method==='POST')return respondJson(res,200,await backends.remove(await readJsonBody(req)));
        if(pathname==='/api/backend-projects/health' && req.method==='POST')return respondJson(res,200,await backends.health(await readJsonBody(req)));
        throw httpError(404,'后端连接接口不存在。');
      }
      if(pathname.startsWith('/api/skills')) {
        if(pathname==='/api/skills' && req.method==='GET')return respondJson(res,200,{items:await skills.list()});
        if(pathname==='/api/skills/upload' && req.method==='POST')return respondJson(res,200,await skills.upload(await readJsonBody(req,12*1024*1024)));
        if(pathname==='/api/skills/import' && req.method==='POST')return respondJson(res,200,await skills.import(await readJsonBody(req)));
        if(pathname==='/api/skills/create' && req.method==='POST')return respondJson(res,200,await skills.create(await readJsonBody(req)));
        if(pathname==='/api/skills/enable' && req.method==='POST')return respondJson(res,200,await skills.enable(await readJsonBody(req)));
        if(pathname==='/api/skills/remove' && req.method==='POST')return respondJson(res,200,await skills.remove(await readJsonBody(req)));
        if(pathname==='/api/skills/reload' && req.method==='POST')return respondJson(res,200,await agent.reloadIntegrations());
        throw httpError(404,'Skills 接口不存在。');
      }
      if(pathname.startsWith('/api/github-tools')) {
        if(pathname==='/api/github-tools' && req.method==='GET')return respondJson(res,200,{items:await githubTools.list(),integrations:await integrations.list()});
        if(pathname==='/api/github-tools/import' && req.method==='POST')return respondJson(res,200,await githubTools.import(await readJsonBody(req)));
        if(pathname==='/api/github-tools/dependencies' && req.method==='POST')return respondJson(res,200,await githubTools.dependencies(await readJsonBody(req)));
        if(pathname==='/api/github-tools/register' && req.method==='POST') {
          const input=await readJsonBody(req);
          if(input.confirmed!==true)throw httpError(400,'注册第三方 MCP 工具前请明确确认。');
          const item=(await githubTools.list()).find(x=>x.id===input.id);
          if(!item)throw httpError(404,'GitHub 仓库未导入。');
          // GitHub repository code runs only when the user explicitly enables the MCP integration.
          return respondJson(res,200,await integrations.upsert({id:'gh_'+item.id.slice(7),label:'GitHub · '+item.label,type:'local',command:input.command,cwd:item.folder}));
        }
        if(pathname==='/api/github-tools/remove' && req.method==='POST'){
          const input=await readJsonBody(req);
          if(input.confirmed!==true)throw httpError(400,'删除第三方仓库需要确认。');
          const item=(await githubTools.list()).find(x=>x.id===input.id);
          if(!item)throw httpError(404,'GitHub 仓库不存在。');
          const integration=(await integrations.list()).find(x=>x.id==='gh_'+item.id.slice(7));
          if(integration?.enabled)throw httpError(409,'请先停用 GitHub MCP 并应用到 Agent，再删除本地仓库。');
          await agent.reloadIntegrations();
          if(integration)await integrations.remove({id:integration.id,confirmed:true});
          return respondJson(res,200,await githubTools.remove(input));
        }
        throw httpError(404,'GitHub 工具接口不存在。');
      }
      if(pathname.startsWith('/api/connection/')) {
        if(pathname.startsWith('/api/connection/account/')) {
          if(!chatgptLogin)throw httpError(410,'未启用账号登录。');
          if(pathname==='/api/connection/account/status' && req.method==='GET')return respondJson(res,200,await account.status());
          if(pathname==='/api/connection/account/login' && req.method==='POST')return respondJson(res,200,await account.login());
          if(pathname==='/api/connection/account/cancel' && req.method==='POST')return respondJson(res,200,await account.cancel());
          throw httpError(404,'授权接口不存在。');
        }
        if(!connectionOptions)throw httpError(410,'此版本未启用直接 API 连接。');
        if(pathname==='/api/connection/status' && req.method==='GET')return respondJson(res,200,await direct.status());
        if(pathname==='/api/connection/models' && req.method==='POST')return respondJson(res,200,await direct.models(await readJsonBody(req)));
        if(pathname==='/api/connection/save' && req.method==='POST')return respondJson(res,200,await direct.save(await readJsonBody(req)));
        if(pathname==='/api/connection/connect' && req.method==='POST')return respondJson(res,200,await direct.connect(await readJsonBody(req)));
        if(pathname==='/api/connection/effort' && req.method==='POST')return respondJson(res,200,await direct.setEffort(await readJsonBody(req)));
        if(pathname==='/api/connection/disconnect' && req.method==='POST')return respondJson(res,200,await direct.disconnect());
        if(pathname==='/api/connection/check' && req.method==='POST')return respondJson(res,200,await direct.check());
        if(pathname.startsWith('/api/connection/proxy/') && req.method==='POST')return await direct.proxy(req,res,pathname,await readJsonBody(req));
        throw httpError(404,'连接接口不存在。');
      }
      if (pathname === '/api/cc-switch/status' && req.method === 'GET') return respondJson(res,200,await ccSwitch.status());
      if (pathname === '/api/cc-switch/responses' && req.method === 'POST') {
        const body = await readJsonBody(req);const selected = await ccSwitch.resolve(body.model);
        if (!(typeof body.input === 'string' && body.input.trim() || Array.isArray(body.input) && body.input.length)) throw httpError(400,'input 不能为空。');
        if (body.stream !== undefined && typeof body.stream !== 'boolean') throw httpError(400,'stream 必须是布尔值。');
        const controller = new AbortController(),timer = setTimeout(() => controller.abort(),requestTimeoutMs);
        res.once('close',() => controller.abort());
        try {
          const upstream = await fetch(selected.endpoint,{method:'POST',headers:authHeaders(selected.apiKey),body:JSON.stringify({...body,model:selected.model}),signal:controller.signal,redirect:'manual'});
          res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type') || 'application/json','Cache-Control':'no-store'});
          const {pipeline} = require('node:stream/promises'),{Readable} = require('node:stream');
          if (upstream.body) await pipeline(Readable.fromWeb(upstream.body),res);else res.end();
        } catch(error) {if (!res.headersSent) respondJson(res,502,{error:'CC Switch 请求失败：'+error.message});else res.destroy();}
        finally {clearTimeout(timer);}return;
      }
      if (!pathname.startsWith('/api/agent/')) return respondJson(res,404,{error:'Not found'});
      let body = req.method === 'POST' ? await readJsonBody(req, /^\/api\/agent\/sessions\/ses_[a-zA-Z0-9]+\/prompt$/.test(pathname) ? 2 * 1024 * 1024 : undefined) : undefined;
      if (ccSwitchOnly && req.method === 'POST' && ['/api/agent/configure','/api/agent/sessions'].includes(pathname) && body?.provider !== 'ccswitch' && !(connectionOptions && body?.provider==='direct') && !(chatgptLogin && ['codex','opencode'].includes(body?.provider))) throw httpError(410,'请选择 CC Switch 或已保存的 API 连接。');
      if (ccSwitchOnly && !chatgptLogin && ['codex','opencode'].includes(body?.provider)) throw httpError(410,'当前版本仅支持 CC Switch 连接。');
      if(connectionOptions && body?.provider==='direct' && req.method==='POST') {
        const selected=await direct.resolve('http://'+req.headers.host);
        if(pathname==='/api/agent/sessions')body={...body,followCurrent:false,configuration:selected,model:{providerID:'strip-local',id:selected.model}};
        else if(pathname==='/api/agent/configure')body={...selected,connection:'direct'};
        else if(/^\/api\/agent\/sessions\/ses_[a-zA-Z0-9]+\/prompt$/.test(pathname))body={...body,routeEndpoint:selected.endpoint};
      }
      if (pathname === '/api/agent/sessions' && req.method === 'POST' && ['codex','opencode'].includes(body?.provider)) {
        body = {...body,followCurrent:false,configuration:{provider:'codex'},model:{providerID:'openai',id:body.modelOverride,...body.reasoningVariant?{variant:body.reasoningVariant}:{}}};
      } else if (pathname === '/api/agent/sessions' && req.method === 'POST' && body?.provider!=='direct' && (ccOnly || body?.followCurrent === true)) {
        body = {...body,followCurrent:!body.modelOverride,configuration:{...await ccSwitch.resolve(body.modelOverride),connection:'ccswitch'}};
      }
      if (/^\/api\/agent\/sessions\/ses_[a-zA-Z0-9]+\/prompt$/.test(pathname) && req.method === 'POST' && !['codex','opencode','direct'].includes(body?.provider) && (ccOnly || body?.followCurrent)) body = {...body,routeModel:(await ccSwitch.resolve()).model};
      if (ccOnly && pathname === '/api/agent/configure' && !['ccswitch','codex','opencode'].includes(body?.provider) && !(connectionOptions && body?.connection==='direct')) throw httpError(410,'请使用已保存的 API 或 CC Switch。');
      if (pathname === '/api/agent/configure' && body?.provider === 'ccswitch') body = {...await ccSwitch.resolve(body.model),connection:'ccswitch'};
      const result = await agent.handle(req.method,pathname.slice('/api/agent'.length),body);
      return respondJson(res,200,result ?? {ok:true});
    }
    if (req.method === 'GET' && pathname === '/api/config') {
      if (ccOnly) return respondJson(res,410,{error:'本地 API 模块已移除。'});
      return respondJson(res, 200, { ...config, version: APP_VERSION, localOnly: true });
    }
    if (req.method === 'GET' && pathname === '/api/health') {
      return respondJson(res, 200, { ok: true, local: true, service:'stripbot-gateway', version: APP_VERSION,capabilities:{agent:'codex-app-server',ccswitch:true,ccOnly,ccSwitchOnly,connectionOptions,chatgptLogin,nativeAuth:chatgptLogin || (nativeAgent && !ccSwitchOnly)} });
    }
    if (req.method === 'GET' && pathname === '/api/models') {
      if (ccOnly) return respondJson(res,410,{error:'本地 API 模型列表已移除。'});
      return await handleModels(req, res);
    }
    if (req.method === 'POST' && ['/api/chat', '/api/check'].includes(pathname)) {
      if (ccOnly && pathname === '/api/check') return respondJson(res,410,{error:'本地 API 检测已移除。'});
      // Prevent unrelated websites from triggering localhost API calls via a browser.
      const origin = req.headers.origin;
      if (origin) {
        const parsed = new URL(origin);
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname.toLowerCase()) || Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)) !== req.socket.localPort) {
          return respondJson(res, 403, { error: '跨来源请求被拒绝。' });
        }
      }
      if (pathname === '/api/chat') return await handleChat(req, res);
      return await handleCheck(req, res);
    }
    if (req.method === 'GET') return await serveStatic(res, pathname);
    return respondJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    if (!res.headersSent) respondJson(res, error.status || 500, { error: error.message || '服务器内部错误。' });
    else if (!res.writableEnded) res.end();
  }
});


app.on('listening',()=>{void nono.initialize('http://127.0.0.1:'+app.address().port);});
app.on('close',() => {nono.close();void agent.close();void account.close();});
return app;
}
module.exports = {createGateway, DEFAULTS};







