'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const {createGateway} = require('../backend/gateway.cjs');
const {startLocalService} = require('../desktop-app/runtime/local-service.cjs');
const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',() => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => {server.close(resolve); server.closeAllConnections?.();});
const post = (base,payload,origin) => fetch(`${base}/api/chat`,{method:'POST',headers:{'content-type':'application/json',...(origin ? {origin} : {})},body:JSON.stringify(payload)});
const message = {messages:[{role:'user',content:'architecture test'}]};

test('independent gateway instances isolate defaults and credentials',async () => {
  const received = [];
  const upstream = http.createServer(async (req,res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    received.push({key:req.headers.authorization,model:JSON.parse(raw).model});
    res.writeHead(200,{'content-type':'application/json'});res.end('{"reply":"ok"}');
  });
  const target = await listen(upstream);
  const a = createGateway({apiKey:'test-a',defaults:{provider:'simple',endpoint:target,model:'a'}});
  const b = createGateway({apiKey:'test-b',defaults:{provider:'simple',endpoint:target,model:'b'}});
  try {
    const [urlA,urlB] = await Promise.all([listen(a),listen(b)]);
    await Promise.all([post(urlA,message).then(r => r.text()),post(urlB,message).then(r => r.text())]);
    assert.deepEqual(received.sort((x,y) => x.model.localeCompare(y.model)),[{key:'Bearer test-a',model:'a'},{key:'Bearer test-b',model:'b'}]);
    assert.equal((await (await fetch(`${urlA}/api/config`)).json()).model,'a');
    assert.equal((await post(urlA,message,urlA)).status,200);
    assert.equal((await post(urlA,message,urlB)).status,403);
    assert.equal((await fetch(`${urlA}/assets/not-present.js`)).status,404);
  } finally {await Promise.all([close(a),close(b),close(upstream)]);}
});

test('gateway timeout and malformed upstream SSE are explicit errors',async () => {
  const upstream = http.createServer((req,res) => {
    res.writeHead(200,{'content-type':'text/event-stream'});
    res.write(req.url === '/invalid' ? 'data: broken-json\n\n' : ': waiting\n\n');
    if (req.url === '/invalid') res.end();
  });
  const target = await listen(upstream);
  const gateway = createGateway({requestTimeoutMs:150});
  try {
    const url = await listen(gateway);
    for (const route of ['/wait','/invalid']) {
      const body = await (await post(url,{...message,provider:'openai',endpoint:target+route})).text();
      assert.match(body,/event: error/);
      assert.doesNotMatch(body,/event: done/);
      assert.match(body,route === '/wait' ? /超时/ : /有效 JSON/);
    }
  } finally {await Promise.all([close(gateway),close(upstream)]);}
});

test('desktop lease closes only a service it owns',async () => {
  const gateway = createGateway({ccOnly:true,ccSwitchOnly:true});
  const url = await listen(gateway);
  try {
    const lease = await startLocalService({resources:path.resolve(__dirname,'..'),workspace:null,port:gateway.address().port});
    assert.equal(lease.owned,false);
    await lease.close();
    assert.equal((await fetch(`${url}/api/health`)).status,200);
  } finally {await close(gateway);}
});

test('closing a client stream cancels the upstream request',async () => {
  let markStarted, markClosed;
  const started = new Promise(resolve => {markStarted = resolve;});
  const ended = new Promise(resolve => {markClosed = resolve;});
  const upstream = http.createServer((_req,res) => {
    res.writeHead(200,{'content-type':'text/event-stream'});
    res.write(': waiting\n\n');
    res.on('close',markClosed);
    markStarted();
  });
  const target = await listen(upstream), gateway = createGateway();
  let timeout;
  try {
    const url = await listen(gateway);
    const response = await post(url,{...message,provider:'openai',endpoint:target});
    const reader = response.body.getReader();
    await reader.read(); await started; await reader.cancel(); reader.releaseLock();
    await Promise.race([ended,new Promise((_,reject) => {timeout = setTimeout(() => reject(new Error('Upstream was not cancelled')),2000);})]);
  } finally {clearTimeout(timeout); await Promise.all([close(gateway),close(upstream)]);}
});

test('renderer stream handles split UTF-8 and split CRLF, releases after done',async () => {
  const {streamChat} = await import('../codex-ui/src/api/chat-stream.mjs');
  const bytes = new TextEncoder().encode('event: delta\r\ndata: {"text":"你好"}\r\n\r\nevent: done\r\ndata: {"ok":true}\r\n\r\n');
  let offset = 0, cancelled = false;
  const stream = new ReadableStream({pull(controller) {
    if (offset < bytes.length) controller.enqueue(bytes.slice(offset,++offset));
    // Keep the upstream open after its terminal event to verify explicit cancel.
  },cancel() {cancelled = true;}});
  const values = [];
  const value = await streamChat({}, {signal:new AbortController().signal,onDelta:text => values.push(text),fetchImpl:async () => new Response(stream)});
  assert.equal(value,'你好');assert.deepEqual(values,['你好']);assert.equal(stream.locked,false);assert.equal(cancelled,true);
});

test('renderer rejects incomplete, malformed and failed streams; honours cancellation',async () => {
  const {streamChat} = await import('../codex-ui/src/api/chat-stream.mjs');
  for (const raw of ['event: delta\ndata: {"text":"partial"}\n\n','event: delta\ndata: broken\n\n','event: error\ndata: {"message":"upstream failed"}\n\n']) {
    await assert.rejects(streamChat({}, {signal:new AbortController().signal,onDelta:() => {},fetchImpl:async () => new Response(raw)}));
  }
  const controller = new AbortController();controller.abort();
  await assert.rejects(streamChat({}, {signal:controller.signal,onDelta:() => {},fetchImpl:async () => new Response('ignored')}),{name:'AbortError'});
});

test('storage restores valid legacy records, recovers interrupted turns, and round-trips history',async () => {
  const {restoreChats,persistChats,exportRecords,storageKeys} = await import('../codex-ui/src/state/chat-storage.mjs');
  const map = new Map(), storage = {getItem:key => map.get(key) ?? null,setItem:(key,value) => map.set(key,value)};
  storage.setItem(storageKeys.chats,'{"invalid":"shape"}');assert.deepEqual(restoreChats(storage),[]);
  storage.setItem(storageKeys.chats,JSON.stringify([null,{id:'bad'}, {id:'legacy',title:'title',messages:[null,{id:'m',role:'assistant',content:'partial',status:'streaming'}]}]));
  const chats = restoreChats(storage);assert.equal(chats.length,1);assert.equal(chats[0].messages[0].status,'stopped');
  persistChats(storage,chats,'legacy');assert.deepEqual(restoreChats(storage),chats);
  assert.equal(JSON.parse(exportRecords(storage)[storageKeys.active]),'legacy');
});
