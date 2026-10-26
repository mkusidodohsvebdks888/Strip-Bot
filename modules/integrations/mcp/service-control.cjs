'use strict';
const {spawn}=require('node:child_process');
const {httpError}=require('../../core/providers/index.cjs');
const MAX_RESULT=256*1024;
function isCodeTool(name){
 return /(?:file|filesystem|source|code|patch|shell|terminal|exec|command|git|write|delete|remove|install|deploy|script|process|spawn|eval)/i.test(name);
}
function validateArgs(args){
 if(!args||typeof args!=='object'||Array.isArray(args))throw httpError(400,'工具参数必须为 JSON 对象');
 const json=JSON.stringify(args);
 if(json.length>32768)throw httpError(413,'工具参数过大');
 return args;
}
function parseResponse(value,id){
 if(value?.jsonrpc!=='2.0'||value.id!==id)throw httpError(502,'MCP 返回了无效的 JSON-RPC 响应');
 if(value.error)throw httpError(502,'MCP 工具执行失败');
 return value.result;
}
async function callLocal(item,tool,args){
 return new Promise((resolve,reject)=>{
  const child=spawn(item.command[0],item.command.slice(1),{cwd:item.cwd||undefined,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env:process.env});
  let done=false,buffer='',bytes=0;
  const timer=setTimeout(()=>finish(httpError(504,'MCP 调用超时')),10000);
  function finish(error,result){if(done)return;done=true;clearTimeout(timer);child.stdin.on('error',()=>{});child.kill();error?reject(error):resolve(result);}
  function send(id,method,params){child.stdin.write(JSON.stringify({jsonrpc:'2.0',...(id?{id}:{}),method,...(params?{params}:{})})+'\n');}
  child.on('error',()=>finish(httpError(502,'MCP 启动失败')));
  child.on('exit',()=>finish(httpError(502,'MCP 服务提前退出')));
  child.stderr.on('data',()=>{});
  child.stdout.on('data',chunk=>{
   bytes+=chunk.length;if(bytes>MAX_RESULT)return finish(httpError(413,'MCP 响应过大'));
   buffer+=chunk.toString('utf8');
   let i;while((i=buffer.indexOf('\n'))>=0&&!done){
    const line=buffer.slice(0,i);buffer=buffer.slice(i+1);
    let value;try{value=JSON.parse(line);}catch{return finish(httpError(502,'MCP 响应格式无效'));}
    if(value.id===1){try{parseResponse(value,1);}catch(e){return finish(e);}
     send(null,'notifications/initialized');send(2,'tools/call',{name:tool,arguments:args});
    }else if(value.id===2){try{finish(null,parseResponse(value,2));}catch(e){finish(e);}}
   }
  });
  send(1,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'StripBot Service Control',version:'1.0'}});
 });
}
async function callRemote(item,tool,args){
 const url=new URL(item.url);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname.toLowerCase()))throw httpError(403,'远程 MCP 调用尚未开放；生产环境默认只读');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
 let session='';
 async function request(id,method,params){
  const response=await fetch(url.href,{method:'POST',redirect:'manual',signal:controller.signal,headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',...(id?{id}:{}),method,...(params?{params}:{})})});
  if(response.status>=300&&response.status<400)throw httpError(502,'拒绝 MCP 重定向');
  if(!response.ok)throw httpError(502,'MCP 请求失败');
  if(response.headers.get('mcp-session-id'))session=response.headers.get('mcp-session-id');
  if(!id)return null;
  const raw=await response.text();if(raw.length>MAX_RESULT)throw httpError(413,'MCP 响应过大');
  const lines=(response.headers.get('content-type')||'').includes('text/event-stream')?raw.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()):[raw];
  for(const line of lines){try{const value=JSON.parse(line);if(value.id===id)return parseResponse(value,id);}catch(e){if(e.status)throw e;}}
  throw httpError(502,'MCP 响应不完整');
 }
 try{await request(1,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'StripBot Service Control',version:'1.0'}});await request(null,'notifications/initialized');return await request(2,'tools/call',{name:tool,arguments:args});}
 finally{clearTimeout(timer);}
}
async function invoke(item,tool,args){validateArgs(args);return item.type==='local'?callLocal(item,tool,args):callRemote(item,tool,args);}
module.exports={invoke,isCodeTool};
