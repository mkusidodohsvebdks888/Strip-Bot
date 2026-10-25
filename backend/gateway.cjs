'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {httpError, requireLocalUrl, bridgeRules, upstreamPayload, sse, pumpResponse} = require('./providers.cjs');
const {createAgentService} = require('./agent/service.cjs');
const {createCcSwitch} = require('./ccswitch.cjs');
const {createImplicitLocalModel} = require('./implicit-local-model.cjs');
const APP_VERSION = '1.0.0';
const DEFAULTS = Object.freeze({provider:'openai', endpoint:'http://127.0.0.1:3010/v1/chat/completions', model:'chatgpt', systemPrompt:'你是一个清晰、准确的中文 AI 助手。'});
const MIME = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/model-icons.js': ['model-icons.js', 'text/javascript; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
  '/brand-logo.png': ['brand-logo.png', 'image/png'],
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
function createGateway({defaults = {}, apiKey = '', ccOnly = false, nativeAgent = false, ccSwitchOnly = false, publicDir = path.join(__dirname, '..', 'public'), requestTimeoutMs = 600000, agentRoot = path.join(__dirname,'..'), agentService,agentExecutable,ccSwitch = createCcSwitch(),implicitLocalModel = createImplicitLocalModel()} = {}) {
  const config = Object.freeze({...DEFAULTS, ...defaults});
  const agent = agentService || createAgentService({root:agentRoot,allowNative:!ccSwitchOnly,apiKey:nativeAgent ? '' : ccOnly ? 'PROXY_MANAGED':apiKey,endpoint:nativeAgent ? '' : ccOnly ? ccSwitch.endpoint:config.endpoint,model:nativeAgent ? '' : config.model || 'unconfigured',provider:nativeAgent ? 'opencode' : ccOnly ? 'responses':config.provider,connection:nativeAgent ? 'opencode' : ccOnly ? 'ccswitch':'local',executable:agentExecutable});
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

async function readJsonBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) throw httpError(413, '请求体超过 1 MB，请减少会话记录。');
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
  const assetExtension = /^\/assets\/[a-zA-Z0-9._-]+\.(js|css)$/.exec(pathname)?.[1];
  const staticEntry = MIME[pathname] || (assetExtension
    ? [pathname.slice(1), assetExtension === 'js' ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8']
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
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  });
  res.end(data);
}

const app = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
    if (pathname.startsWith('/api/agent/') || pathname.startsWith('/api/cc-switch/') || pathname.startsWith('/api/local-model/')) {
      try {const host = requireLocalUrl(`http://${req.headers.host}`);if (Number(host.port || 80) !== req.socket.localPort) throw new Error();}
      catch {return respondJson(res,403,{error:'无效的本机来源。'});}
      const origin = req.headers.origin;
      if (origin && origin !== `http://${req.headers.host}`) return respondJson(res,403,{error:'跨来源请求被拒绝。'});
      if (!['GET','POST'].includes(req.method)) return respondJson(res,405,{error:'Method not allowed'});
      if (pathname === '/api/local-model/status' && req.method === 'GET') return respondJson(res,200,await implicitLocalModel.status());
      if (pathname === '/api/local-model/chat' && req.method === 'POST') {
        if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw httpError(415,'本地模型只接受 JSON 请求。');
        const data = await readJsonBody(req);
        return respondJson(res,200,await implicitLocalModel.chat(data));
      }
      if (pathname.startsWith('/api/local-model/')) return respondJson(res,404,{error:'Not found'});
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
      let body = req.method === 'POST' ? await readJsonBody(req) : undefined;
      if (ccSwitchOnly && req.method === 'POST' && ['/api/agent/configure','/api/agent/sessions'].includes(pathname) && body?.provider !== 'ccswitch') throw httpError(410,'当前版本仅支持 CC Switch 连接。');
      if (ccSwitchOnly && body?.provider === 'opencode') throw httpError(410,'当前版本仅支持 CC Switch 连接。');
      if (pathname === '/api/agent/sessions' && req.method === 'POST' && body?.provider === 'opencode') {
        body = {...body,followCurrent:false,configuration:{provider:'opencode'},model:{providerID:'openai',id:body.modelOverride}};
      } else if (pathname === '/api/agent/sessions' && req.method === 'POST' && (ccOnly || body?.followCurrent === true)) {
        body = {...body,followCurrent:!body.modelOverride,configuration:{...await ccSwitch.resolve(body.modelOverride),connection:'ccswitch'}};
      }
      if (/^\/api\/agent\/sessions\/ses_[a-zA-Z0-9]+\/prompt$/.test(pathname) && req.method === 'POST' && body?.provider !== 'opencode' && (ccOnly || body?.followCurrent)) body = {...body,routeModel:(await ccSwitch.resolve()).model};
      if (ccOnly && pathname === '/api/agent/configure' && !['ccswitch','opencode'].includes(body?.provider)) throw httpError(410,'请使用 OpenCode 原生认证或 CC Switch。');
      if (pathname === '/api/agent/configure' && body?.provider === 'ccswitch') body = {...await ccSwitch.resolve(body.model),connection:'ccswitch'};
      const result = await agent.handle(req.method,pathname.slice('/api/agent'.length),body);
      return respondJson(res,200,result ?? {ok:true});
    }
    if (req.method === 'GET' && pathname === '/api/config') {
      if (ccOnly) return respondJson(res,410,{error:'本地 API 模块已移除。'});
      return respondJson(res, 200, { ...config, version: APP_VERSION, localOnly: true });
    }
    if (req.method === 'GET' && pathname === '/api/health') {
      return respondJson(res, 200, { ok: true, local: true, service:'stripbot-gateway', version: APP_VERSION,capabilities:{agent:'opencode-v2',ccswitch:true,ccOnly,ccSwitchOnly,nativeAuth:nativeAgent && !ccSwitchOnly,implicitLocalModel:true} });
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


app.on('close',() => {void agent.close();});
return app;
}
module.exports = {createGateway, DEFAULTS};

