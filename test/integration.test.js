'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
// Legacy protocol adapters remain regression-tested independently of the CC-only product entry.
const { createGateway } = require('../backend/gateway.cjs');
const app = createGateway();
const { app: demoApi } = require('./demo-local-api');

let appPort;
let apiPort;
const local = (port, route) => `http://127.0.0.1:${port}${route}`;

async function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}
async function close(server) {
  return new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
}
async function apiPost(path, payload) {
  return fetch(local(appPort, path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
}
function deltaText(raw) {
  return [...raw.matchAll(/event: delta\ndata: (.+)\n/g)].map(m => JSON.parse(m[1]).text).join('');
}

before(async () => {
  [appPort, apiPort] = await Promise.all([listen(app), listen(demoApi)]);
});
after(async () => { await Promise.all([close(app), close(demoApi)]); });

test('static UI and config served locally', async () => {
  const main = await fetch(local(appPort, '/'));
  assert.equal(main.status, 200);
  const html = await main.text();
  assert.match(html, /<title>Strip Bot<\/title>/);
  const config = await (await fetch(local(appPort, '/api/config'))).json();
  assert.equal(config.localOnly, true);
});

test('production JS and CSS assets are served with correct MIME and restricted paths', async () => {
  const html = await (await fetch(local(appPort, '/'))).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m => m[1]);
  assert.equal(assets.length, 2);
  for (const asset of assets) {
    const response = await fetch(local(appPort, asset));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), asset.endsWith('.js') ? /javascript/ : /text\/css/);
  }
  assert.equal((await fetch(local(appPort, '/assets/unknown.txt'))).status, 404);
  const manifest = JSON.parse(await (await fetch(local(appPort, '/build-manifest.json'))).text());
  const imageAsset = manifest.assets.find(asset => /\.(png|jpe?g|webp)$/.test(asset));
  assert.ok(imageAsset);
  const image = await fetch(local(appPort, '/' + imageAsset));
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /^image\//);
  const icon = await fetch(local(appPort, '/strip-buttons/icons/search.svg'));
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get('content-type'), /image\/svg\+xml/);
  assert.equal((await fetch(local(appPort, '/strip-buttons/icons/not-found.svg'))).status, 404);
});

test('OpenAI-compatible SSE message arrives through the local proxy', async () => {
  const response = await apiPost('/api/chat', {
    provider: 'openai', endpoint: local(apiPort, '/v1/chat/completions'), model: 'local-model',
    messages: [{ role: 'user', content: '你好，测试本地 API！' }],
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /event: done/);
  assert.match(deltaText(body), /收到的消息：你好，测试本地 API！/);
});

test('simple JSON endpoint works', async () => {
  const response = await apiPost('/api/chat', {
    provider: 'simple', endpoint: local(apiPort, '/api/chat'), model: 'local-model',
    messages: [{ role: 'user', content: '简单 JSON' }],
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(deltaText(body), /收到的消息：简单 JSON/);
});

test('Responses input and SSE work without repeating final output', async () => {
  const response = await apiPost('/api/chat', {
    provider: 'responses', endpoint: local(apiPort, '/v1/responses'), model: 'chatgpt',
    messages: [{ role: 'user', content: 'Responses 协议' }],
  });
  const body = await response.text();
  assert.equal(deltaText(body), 'Responses 测试：Responses 协议');
  assert.match(body, /event: done/);
});

test('Ollama NDJSON endpoint works', async () => {
  const response = await apiPost('/api/chat', {
    provider: 'ollama', endpoint: local(apiPort, '/api/ollama-chat'), model: 'local-model',
    messages: [{ role: 'user', content: 'NDJSON' }],
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(deltaText(body), /Ollama 协议测试：NDJSON/);
});

test('local API check confirms access', async () => {
  const response = await apiPost('/api/check', {
    provider: 'openai', endpoint: local(apiPort, '/v1/chat/completions'), model: 'local-model',
  });
  const json = await response.json();
  assert.equal(json.ok, true);
  assert.equal(json.httpStatus, 200);
});

test('blocks public IPs and non-HTTP URL schemes', async () => {
  for (const endpoint of ['https://example.com/v1/chat/completions', 'http://192.168.1.1/api/chat', 'file:///tmp/secret']) {
    const response = await apiPost('/api/chat', {
      provider: 'openai', endpoint, model: 'local-model',
      messages: [{ role: 'user', content: 'should not be forwarded' }],
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /API/);
  }
});

test('unavailable upstream produces a readable SSE error, never a false reply', async () => {
  const response = await apiPost('/api/chat', {
    provider: 'openai', endpoint: 'http://127.0.0.1:1/v1/chat/completions', model: 'local-model',
    messages: [{ role: 'user', content: 'test' }],
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /event: error/);
  assert.doesNotMatch(body, /event: done/);
});


