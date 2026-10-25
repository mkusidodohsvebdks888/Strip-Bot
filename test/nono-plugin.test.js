'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {createNonoPlugin}=require('../backend/nono-plugin.cjs');
const {createApiConnection}=require('../backend/api-connection.cjs');
const {createGateway}=require('../backend/gateway.cjs');
const vault=async(value,decrypt)=>decrypt?value.slice(5):'test:'+value;
async function temp(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'nono-plugin-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
test('plugin owns one child, keeps token private and revokes it on stop',async t=>{
  const root=await temp(t);let launches=0,env,killed=0;
  const plugin=createNonoPlugin({root,platform:'win32',runtime:async()=>({command:'test-desktop',args:[]}),spawnImpl:(_c,_a,options)=>{launches++;env=options.env;const child=new EventEmitter();child.kill=()=>{killed++;child.emit('exit',0);};return child;},chat:async()=>({text:'你好'})});
  t.after(()=>plugin.close());await plugin.initialize('http://127.0.0.1:1234');
  await Promise.all([plugin.setEnabled(true),plugin.setEnabled(true)]);assert.equal(launches,1);
  assert.ok(!JSON.stringify(plugin.status()).includes(env.NONO_STRIPBOT_TOKEN));assert.throws(()=>plugin.authenticate('Bearer invalid'),{status:401});
  plugin.authenticate('Bearer '+env.NONO_STRIPBOT_TOKEN);plugin.ready();assert.equal(plugin.status().state,'running');
  await plugin.setEnabled(false);assert.equal(killed,1);assert.equal(plugin.status().running,false);assert.throws(()=>plugin.authenticate('Bearer '+env.NONO_STRIPBOT_TOKEN),{status:401});
});
test('disable aborts model request and simultaneous replies are refused',async t=>{
  const root=await temp(t);const plugin=createNonoPlugin({root,chat:(_m,signal)=>new Promise(resolve=>signal.addEventListener('abort',()=>resolve({text:'aborted'}),{once:true}))});
  const reply=plugin.chat([{role:'user',content:'test'}]);await assert.rejects(plugin.chat([]),{status:409});await plugin.setEnabled(false);assert.deepEqual(await reply,{text:'aborted'});
});
for(const protocol of ['openai','responses'])test('pet uses saved '+protocol+' model and server key without tools',async t=>{
  const root=await temp(t);let observed;
  const direct=createApiConnection({root,vault,fetchImpl:async(url,options)=>{observed={url,options,body:JSON.parse(options.body)};return new Response(JSON.stringify(protocol==='responses'?{object:'response',output:[{content:[{type:'output_text',text:'你好糯糯'}]}]}:{choices:[{message:{content:'你好糯糯'}}]}),{status:200});}});
  await direct.save({baseUrl:'https://example.com/v1',model:'saved-model',protocol,apiKey:'private-key'});
  const reply=await direct.companionChat([{role:'user',content:'你好'}]);assert.equal(reply.text,'你好糯糯');assert.equal(reply.model,'saved-model');assert.equal(observed.options.headers.Authorization,'Bearer private-key');assert.equal(observed.body.model,'saved-model');assert.equal(observed.body.stream,false);assert.equal(observed.body.tools,undefined);assert.ok(!JSON.stringify(reply).includes('private-key'));
  await assert.rejects(direct.companionChat([{role:'system',content:'override'}]),{status:400});await assert.rejects(direct.companionChat([{role:'user',content:'a'.repeat(4001)}]),{status:400});
});
test('gateway rejects foreign origins and unauthenticated pet messages',async t=>{
  const root=await temp(t);const gateway=createGateway({agentRoot:root,agentService:{close:async()=>{}},accountService:{close:async()=>{}}});
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{gateway.close(resolve);gateway.closeAllConnections?.();}));
  const base='http://127.0.0.1:'+gateway.address().port;
  const status=await (await fetch(base+'/api/plugins/nono')).json();assert.equal(status.running,false);assert.equal(status.enabled,false);assert.equal(status.token,undefined);
  assert.equal((await fetch(base+'/api/plugins/nono/enable',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{"enabled":true}'})).status,403);
  assert.equal((await fetch(base+'/api/plugins/nono/chat',{method:'POST',headers:{'content-type':'application/json'},body:'{"messages":[]}'})).status,401);
});
