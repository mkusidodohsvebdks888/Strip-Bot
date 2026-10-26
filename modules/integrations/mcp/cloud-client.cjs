'use strict';
// Pinned, read-only connector for the user's StripBot Cloud MCP service.
// No arbitrary remote URL or private-network target can be supplied through the API.
const {httpError}=require('../../core/providers/index.cjs');
const CLOUD_ID='stripbot_cloud';
const CLOUD_URL='https://stripbot-mcp-v2.onrender.com/mcp';
const READ_TOOL='service_status';
const MAX_BODY=256*1024;
const TIMEOUT_MS=90000; // Render free-tier instances may take >50s to wake.
function isCloud(item){
  return item?.id===CLOUD_ID && item.type==='remote' && item.url===CLOUD_URL;
}
async function readLimited(response){
  if(!response.body)return '';
  const reader=response.body.getReader(),chunks=[];let count=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      count+=value.byteLength;
      if(count>MAX_BODY)throw httpError(413,'云端 MCP 响应过大');
      chunks.push(Buffer.from(value));
    }
  }finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks).toString('utf8');
}
function createCloudClient({fetchImpl=fetch}={}){
  async function run(token,{call=false}={}){
    if(typeof token!=='string'||token.length<24||token.length>512||/[\r\n]/.test(token))throw httpError(401,'请填写有效的云端访问 Token');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    let sessionId='',protocolVersion='2025-03-26';
    async function rpc(id,method,params){
      const payload={jsonrpc:'2.0',...(id!==null?{id}:{}),method,...(params?{params}:{})};
      const headers={
        'Content-Type':'application/json',
        'Accept':'application/json, text/event-stream',
        'Authorization':'Bearer '+token,
        'MCP-Protocol-Version':protocolVersion,
        ...(sessionId?{'Mcp-Session-Id':sessionId}:{})
      };
      let response;
      try{
        response=await fetchImpl(CLOUD_URL,{method:'POST',redirect:'manual',headers,body:JSON.stringify(payload),signal:controller.signal});
      }catch(error){
        if(controller.signal.aborted)throw httpError(504,'云端 MCP 连接超时（免费实例可能休眠）');
        throw httpError(502,'无法连接 StripBot Cloud MCP');
      }
      if(response.status===401||response.status===403)throw httpError(401,'云端 Token 无效或权限不足');
      if(response.status>=300&&response.status<400)throw httpError(502,'云端 MCP 重定向被拒绝');
      if(!response.ok)throw httpError(502,'云端 MCP 返回 HTTP '+response.status);
      if(response.headers.get('mcp-session-id'))sessionId=response.headers.get('mcp-session-id');
      if(id===null)return null;
      const raw=await readLimited(response);
      const type=response.headers.get('content-type')||'';
      const parts=type.includes('text/event-stream')
        ?raw.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim())
        :[raw];
      let reply;
      for(const part of parts){
        try{const parsed=JSON.parse(part);if(parsed?.jsonrpc==='2.0'&&parsed.id===id){reply=parsed;break;}}catch{}
      }
      if(!reply)throw httpError(502,'云端 MCP 响应缺少有效 JSON-RPC 消息');
      if(reply.error)throw httpError(502,'云端 MCP 返回工具或协议错误');
      return reply.result;
    }
    try{
      const initialized=await rpc(1,'initialize',{protocolVersion,capabilities:{},clientInfo:{name:'StripBot Cloud Connector',version:'1.0'}});
      if(typeof initialized?.protocolVersion!=='string'||!initialized.protocolVersion)throw httpError(502,'云端 MCP 握手失败');
      protocolVersion=initialized.protocolVersion;
      await rpc(null,'notifications/initialized');
      const listed=await rpc(2,'tools/list',{});
      if(!Array.isArray(listed?.tools))throw httpError(502,'云端 MCP 工具列表格式错误');
      const tools=listed.tools.slice(0,100).filter(tool=>tool&&typeof tool.name==='string').map(tool=>({
        name:tool.name.slice(0,128),
        description:typeof tool.description==='string'?tool.description.slice(0,500):''
      }));
      if(!call)return {connected:true,protocolVersion,serverInfo:initialized.serverInfo||null,tools,hasMore:!!listed.nextCursor,message:'已通过 Bearer Token 完成云端握手（只读发现）'};
      if(!tools.some(tool=>tool.name===READ_TOOL))throw httpError(403,'服务器未声明允许的只读状态工具');
      const result=await rpc(3,'tools/call',{name:READ_TOOL,arguments:{}});
      return result;
    }finally{clearTimeout(timer);}
  }
  return {
    probe(token){return run(token);},
    call(token,tool,args){
      if(tool!==READ_TOOL||!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw httpError(403,'云端服务目前仅允许无参数的只读状态查询');
      return run(token,{call:true});
    }
  };
}
module.exports={CLOUD_ID,CLOUD_URL,READ_TOOL,isCloud,createCloudClient};
