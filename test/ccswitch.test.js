'use strict';
const {test} = require('node:test'),assert = require('node:assert/strict'),http = require('node:http'),fs = require('node:fs/promises'),path = require('node:path');
const {createCcSwitch,parsePublicConfig} = require('../backend/ccswitch.cjs');
const {createGateway} = require('../backend/gateway.cjs');
const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',() => resolve(`http://127.0.0.1:${server.address().port}`)));

test('CC-only product retires local API endpoints and refuses local chat and Agent configuration',async t => {
  const gateway = createGateway({ccOnly:true});
  const url = await listen(gateway);t.after(() => {gateway.close();gateway.closeAllConnections();});
  for (const route of ['/api/config','/api/models']) assert.equal((await fetch(url+route)).status,410);
  for (const route of ['/api/check','/api/agent/configure']) {
    const r = await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'openai'})});
    assert.equal(r.status,410);
  }
  assert.equal((await (await fetch(url+'/api/health')).json()).capabilities.ccOnly,true);
});
test('CC Switch public parser excludes credentials and recognises the active loopback route',() => {
  const source = 'model = "model-a"\nmodel_provider = "route"\napi_key = "secret"\n[model_providers.route]\nbase_url = "http://127.0.0.1:15721/v1"\n';
  assert.deepEqual(parsePublicConfig(source,15721),{model:'model-a',provider:'route',routesThroughCcSwitch:true});
  assert.equal(parsePublicConfig(source.replace('127.0.0.1','example.com'),15721).routesThroughCcSwitch,false);
});
test('CC Switch forwards Responses, follows model changes, isolates credentials, and configures Agent',async t => {
  const calls = [];
  const upstream = http.createServer(async (req,res) => {
    if (req.url === '/health') {res.end('{}');return;}
    let raw = '';for await (const part of req) raw += part;
    const body = JSON.parse(raw);calls.push({url:req.url,auth:req.headers.authorization,body});
    if (body.input === 'error') {res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":{"message":"denied"}}');return;}
    if (body.stream) {res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"hello"}\n\nevent: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","output":[]}}\n\n');}
    else {res.setHeader('Content-Type','application/json');res.end('{"output_text":"hello"}');}
  });
  await listen(upstream);t.after(() => {upstream.close();upstream.closeAllConnections();});
  const configPath = path.join(__dirname,'..','.runtime','ccswitch-test-'+Date.now()+'.toml');
  await fs.mkdir(path.dirname(configPath),{recursive:true});
  const write = model => fs.writeFile(configPath,`model = "${model}"\nmodel_provider = "test"\n[model_providers.test]\nbase_url = "http://127.0.0.1:${upstream.address().port}/v1"\n`);
  await write('model-a');t.after(() => fs.unlink(configPath));
  const cc = createCcSwitch({port:upstream.address().port,configPath}),agentCalls = [];
  const gateway = createGateway({apiKey:'private-page02-key',ccSwitch:cc,agentService:{close:async () => {},handle:async (...args) => {agentCalls.push(args);return {ok:true};}}});
  const base = await listen(gateway);t.after(() => {gateway.close();gateway.closeAllConnections();});
  const post = (route,body,origin) => fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(origin ? {Origin:origin}:{})},body:JSON.stringify(body)});
  const status = await (await fetch(base+'/api/cc-switch/status')).json();assert.equal(status.connection,'ready');assert.equal(JSON.stringify(status).includes('private-page02-key'),false);
  let response = await post('/api/chat',{provider:'ccswitch',endpoint:'https://example.com',messages:[{role:'user',content:'test'}]});
  assert.match(await response.text(),/hello/);assert.equal(calls.at(-1).body.model,'model-a');assert.equal(calls.at(-1).auth,'Bearer PROXY_MANAGED');assert.equal(calls.at(-1).url,'/v1/responses');
  await write('model-b');response = await post('/api/cc-switch/responses',{input:'test',stream:true,tools:[{type:'function',name:'read'}]});assert.match(await response.text(),/response.completed/);assert.equal(calls.at(-1).body.model,'model-b');assert.equal(calls.at(-1).body.tools[0].name,'read');
  response = await post('/api/cc-switch/responses',{input:'test',model:'override'});assert.equal(response.status,200);await response.text();assert.equal(calls.at(-1).body.model,'override');
  response = await post('/api/cc-switch/responses',{input:'error'});assert.equal(response.status,401);assert.match(await response.text(),/denied/);
  response = await post('/api/agent/configure',{provider:'ccswitch',endpoint:'https://example.com',model:''});assert.equal(response.status,200);await response.text();assert.deepEqual(agentCalls.at(-1)[2],{provider:'responses',endpoint:cc.endpoint,model:'model-b',apiKey:'PROXY_MANAGED',connection:'ccswitch'});
  response = await post('/api/cc-switch/responses',{input:'test'},'https://example.com');assert.equal(response.status,403);
  response = await post('/api/cc-switch/responses',{input:''});assert.equal(response.status,400);
});
