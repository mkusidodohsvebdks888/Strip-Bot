'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const port=Number(process.env.PORT||8080);
const token=process.env.MCP_ACCESS_TOKEN||'';
if(!token||token.length<24)throw new Error('Set MCP_ACCESS_TOKEN (at least 24 characters)');
const tools=[{name:'service_status',description:'Read-only service status',inputSchema:{type:'object',properties:{},additionalProperties:false}}];
function reply(res,status,data){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));}
http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/health'&&req.method==='GET')return reply(res,200,{ok:true});
 const auth=req.headers.authorization||'';
 const expected='Bearer '+token;
 if(Buffer.byteLength(auth)!==Buffer.byteLength(expected)||!crypto.timingSafeEqual(Buffer.from(auth),Buffer.from(expected)))return reply(res,401,{error:'Unauthorized'});
 if(pathname!=='/mcp'||req.method!=='POST')return reply(res,404,{error:'Not found'});
 let data='';for await(const part of req){data+=part;if(data.length>32768)return reply(res,413,{error:'Too large'});}
 let body;try{body=JSON.parse(data);}catch{return reply(res,400,{error:'Invalid JSON'});}
 if(body.jsonrpc!=='2.0')return reply(res,400,{error:'Invalid JSON-RPC'});
 if(body.method==='notifications/initialized')return reply(res,202,{});
 const result=body.method==='initialize'?{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'stripbot-public-readonly',version:'0.1.0'}}:body.method==='tools/list'?{tools}:body.method==='tools/call'&&body.params?.name==='service_status'?{content:[{type:'text',text:JSON.stringify({ok:true,service:'stripbot-public-readonly'})}]}:null;
 if(result===null)return reply(res,200,{jsonrpc:'2.0',id:body.id,error:{code:-32601,message:'Method not found'}});
 return reply(res,200,{jsonrpc:'2.0',id:body.id,result});
}).listen(port,'0.0.0.0',()=>console.log('MCP server listening on',port));
