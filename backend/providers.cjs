'use strict';
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireLocalUrl(value) {
  let parsed;
  try { parsed = new URL(String(value)); } catch { throw httpError(400, '本地 API 地址不是有效 URL。'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw httpError(400, '本地 API 只允许 HTTP 或 HTTPS 协议。');
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname.toLowerCase())) {
    throw httpError(400, '为避免意外请求外网，API 地址只能使用 localhost、127.0.0.1 或 [::1]。');
  }
  if (parsed.username || parsed.password) throw httpError(400, 'API 地址不能包含用户名或密码。');
  return parsed;
}

/** Providers exposed by the Page02 browser-ai-bridge. */
const BRIDGE_PROVIDERS = ['chatgpt', 'gemini', 'claude', 'grok', 'qwen', 'deepseek'];

/**
 * Optional per-request model rules. Forwarded verbatim to an OpenAI-compatible
 * upstream; the bridge understands provider / enableReasoning / enableSearch /
 * temperature / conversationId.
 */
function bridgeRules(data) {
  const rules = {};
  const provider = typeof data.bridgeProvider === 'string' ? data.bridgeProvider.trim() : '';
  if (BRIDGE_PROVIDERS.includes(provider)) rules.provider = provider;
  if (typeof data.enableReasoning === 'boolean') rules.enableReasoning = data.enableReasoning;
  if (typeof data.enableSearch === 'boolean') rules.enableSearch = data.enableSearch;
  if (typeof data.temperature === 'number' && Number.isFinite(data.temperature)) rules.temperature = data.temperature;
  if (typeof data.conversationId === 'string' && data.conversationId.trim()) rules.conversationId = data.conversationId.trim().slice(0, 120);
  return rules;
}

function upstreamPayload(provider, model, messages, rules = {}) {
  if (provider === 'responses') return { model, input: messages, stream: true };
  if (provider === 'simple') {
    const last = messages.filter(x => x.role === 'user').at(-1);
    return { message: last.content, messages, model };
  }
  if (provider === 'ollama') return { model, messages, stream: true };
  return { model, messages, stream: true, ...rules };
}

function sse(res, event, data) {
  if (!res.destroyed && !res.writableEnded) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

function contentToString(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(item => typeof item === 'string' ? item : item && item.text || '').join('');
  return '';
}

function extractText(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (obj.error) throw new Error(typeof obj.error === 'string' ? obj.error : obj.error.message || '本地 API 返回错误');
  if (obj.type === 'response.output_text.delta') return obj.delta || '';
  if (['response.failed', 'response.incomplete', 'response.cancelled'].includes(obj.type)) throw new Error(obj.response?.error?.message || 'Responses API 未正常完成。');
  if (obj.type?.startsWith('response.')) return '';
  if (obj.type === 'error') throw new Error(obj.message || 'Responses API error');
  if (obj.object === 'response') return (obj.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text || '').join('');
  return contentToString(obj.choices?.[0]?.delta?.content)
    || contentToString(obj.choices?.[0]?.message?.content)
    || contentToString(obj.message?.content)
    || [obj.reply, obj.response, obj.text, obj.output, typeof obj.content === 'string' ? obj.content : ''].find(x => typeof x === 'string' && x.length > 0)
    || '';
}

async function readTextStream(body, processFragment, flushFinal) {
  const decoder = new TextDecoder();
  let pending = '';
  for await (const chunk of body) {
    pending += decoder.decode(chunk, { stream: true });
    pending = pending.replace(/\r\n/g, '\n');
    let delimiter;
    while ((delimiter = pending.indexOf('\n\n')) !== -1) {
      const segment = pending.slice(0, delimiter);
      pending = pending.slice(delimiter + 2);
      processFragment(segment);
    }
  }
  pending += decoder.decode();
  if (pending.trim()) flushFinal?.(pending);
}

async function readLineStream(body, processLine) {
  const decoder = new TextDecoder();
  let pending = '';
  for await (const chunk of body) {
    pending += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = pending.indexOf('\n')) !== -1) {
      processLine(pending.slice(0, idx).trim());
      pending = pending.slice(idx + 1);
    }
  }
  pending += decoder.decode();
  if (pending.trim()) processLine(pending.trim());
}

async function pumpResponse(upstream, provider, res) {
  const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
  let emitted = false;
  const emit = text => {
    if (typeof text === 'string' && text.length) {
      emitted = true;
      sse(res, 'delta', { text });
    }
  };

  if (contentType.includes('text/event-stream')) {
    let finished = false;
    const processFragment = fragment => {
      if (finished || !fragment.trim()) return;
      const lines = fragment.split('\n');
      const dataLines = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());
      if (!dataLines.length) return;
      const raw = dataLines.join('\n');
      if (raw === '[DONE]') { finished = true; return; }
      let obj;
      try { obj = JSON.parse(raw); } catch { throw new Error('上游 SSE 数据不是有效 JSON。'); }
      const text = extractText(obj);
      emit(text);
    };
    await readTextStream(upstream.body, processFragment, processFragment);
  } else if (contentType.includes('ndjson') || (provider === 'ollama' && !contentType.includes('application/json'))) {
    await readLineStream(upstream.body, line => {
      if (!line) return;
      const obj = JSON.parse(line);
      emit(extractText(obj));
    });
  } else if (provider === 'ollama' && contentType.includes('application/json')) {
    // Ollama can return a JSON object or NDJSON with an application/json Content-Type.
    const raw = await upstream.text();
    try {
      emit(extractText(JSON.parse(raw)));
    } catch (error) {
      if (!raw.includes('\n')) throw error;
      for (const line of raw.split('\n')) if (line.trim()) emit(extractText(JSON.parse(line)));
    }
  } else if (contentType.includes('application/json') || contentType.includes('+json')) {
    const obj = await upstream.json();
    emit(extractText(obj));
  } else {
    // Simple local services may respond with plain text directly.
    emit(await upstream.text());
  }
  if (!emitted) throw new Error('本地 API 没有返回可识别的文本。请检查 API 格式及模型名称。');
}


module.exports = {httpError, requireLocalUrl, bridgeRules, upstreamPayload, sse, extractText, pumpResponse};
