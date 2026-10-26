'use strict';
// Explicit, bounded MCP Streamable HTTP probe. Never run on page load.
const {httpError}=require('../../core/providers/index.cjs');
const MAX_BODY=256*1024;
async function readLimited(response){
  if(!response.body)return '';
  const reader=response.body.getReader();
  const parts=[];let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_BODY)throw httpError(413,'MCP 响应超过大小限制');
      parts.push(Buffer.from(value));
    }
  }finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(parts).toString('utf8');
}
async function probeRemote(item,{timeoutMs=6000}={}){
  if(!item||item.type!=='remote')throw httpError(400,'当前仅支持 HTTP MCP 连接测试');
  let target;
  try{target=new URL(item.url);}catch{throw httpError(400,'无效的 MCP 地址');}
  if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname.toLowerCase()))throw httpError(400,'当前仅允许测试本机 MCP 地址，避免访问内网或不可信远程服务');
  if(!['http:','https:'].includes(target.protocol)||target.username||target.password||target.hash)throw httpError(400,'无效的 MCP 地址');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(target.href,{
      method:'POST',redirect:'manual',signal:controller.signal,
      headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'StripBot',version:'1.0'}}})
    });
    if(response.status>=300&&response.status<400)throw httpError(502,'MCP 服务发生重定向，已拒绝跟随');
    const body=await readLimited(response);
    if(!response.ok)throw httpError(502,`MCP 服务返回 HTTP ${response.status}`);
    const contentType=response.headers.get('content-type')||'';
    const candidate=contentType.includes('text/event-stream')
      ? body.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).find(line=>line.startsWith('{'))
      : body;
    let parsed;
    try{parsed=JSON.parse(candidate||'');}catch{throw httpError(502,'MCP 初始化响应不是有效 JSON-RPC');}
    if(parsed.jsonrpc!=='2.0'||parsed.id!==1||!parsed.result||typeof parsed.result.protocolVersion!=='string')throw httpError(502,'MCP 初始化响应缺少协议版本');
    const sessionId=response.headers.get('mcp-session-id');
    const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':parsed.result.protocolVersion};
    if(sessionId)headers['Mcp-Session-Id']=sessionId;
    const follow=async(payload)=>{
      const next=await fetch(target.href,{method:'POST',redirect:'manual',signal:controller.signal,headers,body:JSON.stringify(payload)});
      if(next.status>=300&&next.status<400)throw httpError(502,'MCP 服务重定向已被拒绝');
      const text=next.status===202?'':await readLimited(next);
      if(!next.ok)throw httpError(502,'MCP 后续请求失败：HTTP '+next.status);
      return {text,contentType:next.headers.get('content-type')||''};
    };
    await follow({jsonrpc:'2.0',method:'notifications/initialized'});
    const tools=[];
    const seen=new Set();
    let cursor;
    let hasMore=false;
    for(let page=0;page<5;page++){
      const id=page+2;
      const listing=await follow({jsonrpc:'2.0',id,method:'tools/list',params:cursor?{cursor}:{}});
      const lines=listing.contentType.includes('text/event-stream')
        ? listing.text.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim())
        : [listing.text];
      let reply;
      for(const line of lines){
        try{const obj=JSON.parse(line);if(obj.id===id&&obj.jsonrpc==='2.0'){reply=obj;break;}}catch{}
      }
      if(!reply||!Array.isArray(reply.result?.tools))throw httpError(502,'MCP 工具列表响应无效');
      const entries=reply.result.tools;
      for(const tool of entries){
        if(tools.length>=100)break;
        if(!tool||typeof tool.name!=='string'||!tool.name.trim())continue;
        tools.push({name:tool.name.slice(0,128),description:typeof tool.description==='string'?tool.description.slice(0,500):''});
      }
      const next=reply.result.nextCursor;
      if(typeof next!=='string'||!next.length){hasMore=entries.length>100-tools.length;break;}
      hasMore=true;
      if(tools.length>=100||seen.has(next)||next.length>2048)break;
      seen.add(next);
      cursor=next;
    }
    return {connected:true,protocolVersion:parsed.result.protocolVersion,serverInfo:parsed.result.serverInfo||null,tools,hasMore,message:'MCP 握手成功，已读取工具列表（不执行工具）'};
  }catch(error){
    if(controller.signal.aborted)throw httpError(504,'MCP 连接超时');
    throw error;
  }finally{clearTimeout(timer);}
}
module.exports={probeRemote};
