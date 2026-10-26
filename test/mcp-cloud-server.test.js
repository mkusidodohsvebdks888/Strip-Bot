'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const net=require('node:net');
const path=require('node:path');
async function port(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(resolve=>s.close(resolve));return p;}
test('cloud MCP server authenticates and only exposes read-only tool',async()=>{
 const p=await port();const token='test-only-token-with-enough-length';
 const child=spawn(process.execPath,[path.join(__dirname,'../deploy/mcp-server/server.cjs')],{env:{...process.env,PORT:String(p),MCP_ACCESS_TOKEN:token},stdio:'ignore'});
 try{
  const base='http://127.0.0.1:'+p;
  let ready=false;for(let i=0;i<40;i++){try{const r=await fetch(base+'/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert(ready,'server did not start');
  const unauth=await fetch(base+'/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
  assert.equal(unauth.status,401);
  const headers={'content-type':'application/json',authorization:'Bearer '+token};
  const rpc=async(method,params)=>{const r=await fetch(base+'/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});assert.equal(r.status,200);return r.json();};
  const list=await rpc('tools/list');assert.deepEqual(list.result.tools.map(t=>t.name),['service_status']);
  const ok=await rpc('tools/call',{name:'service_status',arguments:{}});assert(ok.result.content[0].text.includes('ok'));
  const denied=await rpc('tools/call',{name:'shell',arguments:{command:'whoami'}});assert.equal(denied.error.code,-32601);
 }finally{child.kill();}
});
