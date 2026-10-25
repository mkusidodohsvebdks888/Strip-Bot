'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createImplicitLocalModel} = require('../backend/implicit-local-model.cjs');
const {createGateway} = require('../backend/gateway.cjs');

const json = value => new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});

test('implicit local model discovers installed Ollama model and chats without API key', async () => {
  const requests = [];
  const local = createImplicitLocalModel({preferredModel:'local-b',fetchImpl:async (url,options) => {
    requests.push({path:new URL(url).pathname,options});
    if (new URL(url).pathname === '/api/tags') return json({models:[{name:'local-a'},{name:'local-b'}]});
    return json({message:{role:'assistant',content:'本地回复'}});
  }});
  const available = await local.status();
  assert.equal(available.available,true);
  assert.equal(available.model,'local-b');
  const result = await local.chat({messages:[{role:'user',content:'你好'}]});
  assert.deepEqual(result,{reply:'本地回复',model:'local-b',provider:'ollama',local:true});
  assert.equal(requests.at(-1).path,'/api/chat');
  assert.deepEqual(JSON.parse(requests.at(-1).options.body).messages,[{role:'user',content:'你好'}]);
  assert.equal(requests.at(-1).options.headers.Authorization,undefined);
  assert.equal(requests.at(-1).options.redirect,'error');
});

test('unavailable local model returns explicit unavailable status and no fabricated reply',async () => {
  const local = createImplicitLocalModel({fetchImpl:async () => {throw new Error('offline');}});
  assert.equal((await local.status()).available,false);
  await assert.rejects(local.chat({messages:[{role:'user',content:'你好'}]}),{status:503});
});

test('implicit local model rejects external network target and invalid chat messages',async () => {
  assert.throws(()=>createImplicitLocalModel({baseUrl:'https://example.com'}),/回环地址/);
  const local = createImplicitLocalModel({fetchImpl:async () => json({models:[{name:'llama'}]})});
  await assert.rejects(local.chat({messages:[{role:'assistant',content:'not user'}]}),{status:400});
});

test('gateway exposes implicit local routes even in CC Switch only mode, with origin checks',async () => {
  const model = {status:async()=>({available:true,model:'stub',local:true}),chat:async()=>({reply:'ok',model:'stub',local:true})};
  const gateway = createGateway({ccOnly:true,ccSwitchOnly:true,implicitLocalModel:model});
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:'+gateway.address().port;
  try {
    const status = await fetch(base+'/api/local-model/status');
    assert.equal(status.status,200);
    assert.equal((await status.json()).model,'stub');
    const answered = await fetch(base+'/api/local-model/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'你好'}]})});
    assert.equal((await answered.json()).reply,'ok');
    const blocked = await fetch(base+'/api/local-model/chat',{method:'POST',headers:{origin:'https://example.org','content-type':'application/json'},body:JSON.stringify({messages:[]})});
    assert.equal(blocked.status,403);
    const wrongType = await fetch(base+'/api/local-model/chat',{method:'POST',headers:{'content-type':'text/plain'},body:'not JSON'});
    assert.equal(wrongType.status,415);
  } finally {
    await new Promise(resolve=>{gateway.close(resolve);gateway.closeAllConnections?.();});
  }
});
