'use strict';
// Deterministic LOCAL API for transport tests; it is NOT a model and does NOT generate AI replies.
const http = require('node:http');
const port = Number(process.env.DEMO_PORT || 8000);
const app = http.createServer(async (req, res) => {
  if (req.url === '/v1/responses' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    const text = `Responses 测试：${payload.input.at(-1).content}`;
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
    for (const event of [
      { type: 'response.output_text.delta', delta: text },
      { type: 'response.output_text.done', text },
      { type: 'response.completed', response: { output: [{ content: [{ type: 'output_text', text }] }] } },
    ]) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    res.end();
    return;
  }
  if (req.url === '/v1/models' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ object: 'list', data: [{ id: 'local-model' }] }));
  }
  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ reply: `本地链路测试成功。\n收到的消息：${payload.message}\n\n提示：这是测试回显，替换真实本地 API 后才能获得模型回复。` }));
  }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    const last = payload.messages?.filter(x => x.role === 'user').at(-1)?.content || '';
    const answer = `本地链路测试成功。\n收到的消息：${last}\n\n提示：这是测试回显，不是真正的 AI 回复。`;
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' });
    for (const piece of answer.match(/.{1,6}/gs) || []) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
    }
    res.end('data: [DONE]\n\n');
    return;
  }
  if (req.url === '/api/tags' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ models: [{ name: 'local-model' }] }));
  }
  if (req.url === '/api/ollama-chat' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    const last = payload.messages?.filter(x => x.role === 'user').at(-1)?.content || '';
    res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' });
    res.write(JSON.stringify({ message: { content: `Ollama 协议测试：${last}` }, done: false }) + '\n');
    res.end(JSON.stringify({ done: true }) + '\n');
    return;
  }
  res.writeHead(404); res.end();
});
if (require.main === module) app.listen(port, '127.0.0.1', () => console.log(`Demo local API: http://127.0.0.1:${port} (only test echo)`));
module.exports = { app };
