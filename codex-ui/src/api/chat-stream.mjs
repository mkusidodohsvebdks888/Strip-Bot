/** Consume the gateway's delta/error/done contract; never equate EOF with success. */
export async function streamChat(payload, {signal, onDelta, fetchImpl = fetch}) {
  const response = await fetchImpl('/api/chat', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal,
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (!response.body) throw new Error('浏览器无法读取流式响应。');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', completed = false, text = '';
  function frame(raw) {
    const event = /^event:\s*(.+)$/m.exec(raw)?.[1]?.trim();
    const data = raw.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || completed) return;
    const value = JSON.parse(data);
    if (event === 'error') throw new Error(value.message || value.error || '本地 API 请求失败');
    if (event === 'delta') { text += String(value.text || ''); onDelta(text); }
    if (event === 'done') completed = true;
  }
  try {
    while (!completed) {
      signal?.throwIfAborted();
      const {value, done} = await reader.read();
      // Normalize after concatenation: CR and LF may arrive in different chunks.
      buffer = (buffer + decoder.decode(value, {stream:!done})).replace(/\r\n/g, '\n');
      let pos;
      while ((pos = buffer.indexOf('\n\n')) >= 0) { frame(buffer.slice(0,pos)); buffer = buffer.slice(pos+2); }
      if (buffer.length > 1024 * 1024) throw new Error('流式数据帧超过 1 MB。');
      if (done) { if (buffer.trim()) frame(buffer); break; }
    }
    if (!completed) throw new Error('响应中断，尚未收到完成事件。');
    return text;
  } finally {
    // Errors and terminal events release/cancel the stream as well as its lock.
    try { await reader.cancel(); } catch {}
    reader.releaseLock();
  }
}
