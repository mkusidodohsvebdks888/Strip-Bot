'use strict';

// An opt-in-free, loopback-only adapter for an already running Ollama instance.
// No model weights, accounts, network downloads or third-party API keys are bundled.
const DEFAULT_OLLAMA = 'http://127.0.0.1:11434';

function createImplicitLocalModel({baseUrl = DEFAULT_OLLAMA, fetchImpl = globalThis.fetch, preferredModel = process.env.STRIPBOT_LOCAL_MODEL || ''} = {}) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('隐式模型仅允许连接本机回环地址。');
  }
  let cache, cacheUntil = 0;

  async function status({refresh = false} = {}) {
    if (!refresh && cache && Date.now() < cacheUntil) return cache;
    try {
      const response = await fetchImpl(new URL('/api/tags', url), {
        method: 'GET', signal: AbortSignal.timeout(1800), redirect: 'error',
      });
      if (!response.ok) throw new Error('本地推理服务不可用');
      const payload = await response.json();
      const names = (Array.isArray(payload.models) ? payload.models : [])
        .map(x => typeof x?.name === 'string' ? x.name : '')
        .filter(Boolean);
      const model = names.includes(preferredModel) ? preferredModel : names[0] || '';
      cache = model
        ? {available:true,provider:'ollama',model,local:true}
        : {available:false,provider:'ollama',model:'',local:true,reason:'Ollama 已启动，但尚未下载模型。'};
    } catch {
      cache = {available:false,provider:'ollama',model:'',local:true,reason:'未找到本机 Ollama 服务。'};
    }
    cacheUntil = Date.now() + 2500;
    return cache;
  }

  async function chat(data,{signal} = {}) {
    if (!data || !Array.isArray(data.messages) || data.messages.length === 0) {
      const error = new Error('messages 必须是非空数组。');error.status=400;throw error;
    }
    const messages = data.messages.slice(-24).map(item => ({
      role: item?.role,
      content: typeof item?.content === 'string' ? item.content.slice(0,10000) : '',
    })).filter(item => ['user','assistant','system'].includes(item.role) && item.content.trim());
    if (!messages.length || messages.at(-1).role !== 'user') {
      const error = new Error('最后一条消息必须是用户消息。');error.status=400;throw error;
    }
    const current = await status({refresh:true});
    if (!current.available) {
      const error = new Error(current.reason);error.status=503;throw error;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('本地模型响应超时。')),120000);
    const cancel = () => controller.abort(signal.reason);
    if (signal) {
      if (signal.aborted) cancel();
      else signal.addEventListener('abort',cancel,{once:true});
    }
    try {
      const response = await fetchImpl(new URL('/api/chat',url), {
        method:'POST',redirect:'error',signal:controller.signal,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:current.model,stream:false,messages}),
      });
      if (!response.ok) {
        const error = new Error('本地模型推理失败（HTTP '+response.status+'）。');
        error.status=502;throw error;
      }
      const length = Number(response.headers?.get?.('content-length') || 0);
      if (length > 2*1024*1024) throw new Error('本地模型返回内容过大。');
      const result = await response.json();
      const reply = result?.message?.content;
      if (typeof reply !== 'string' || !reply.trim() || reply.length > 100000) {
        throw new Error('本地模型没有返回有效文本。');
      }
      return {reply,model:current.model,provider:'ollama',local:true};
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort',cancel);
    }
  }
  return {status,chat};
}

module.exports = {createImplicitLocalModel};
