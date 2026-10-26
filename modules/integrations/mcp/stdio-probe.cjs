'use strict';
const {spawn}=require('node:child_process');
const {httpError}=require('../../core/providers/index.cjs');

async function probeStdio(item,{timeoutMs=8000}={}){
  if(!item||item.type!=='local'||!Array.isArray(item.command)||!item.command.length)throw httpError(400,'无效的本地 MCP 配置');
  return new Promise((resolve,reject)=>{
    const child=spawn(item.command[0],item.command.slice(1),{
      cwd:item.cwd||undefined,stdio:['pipe','pipe','pipe'],shell:false,windowsHide:true,
      env:process.env
    });
    let settled=false,buffer='',sequence=0;
    const tools=[],seen=new Set();
    let cursor,hasMore=false;
    const timer=setTimeout(()=>fail(httpError(504,'本地 MCP 握手或工具发现超时')),timeoutMs);
    function finish(error,result){
      if(settled)return;
      settled=true;clearTimeout(timer);
      child.stdout.removeAllListeners('data');
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      child.kill();
      if(error)reject(error);else resolve(result);
    }
    function fail(error){finish(error);}
    function send(message){
      if(settled)return;
      try{child.stdin.write(JSON.stringify({jsonrpc:'2.0',...message})+'\n');}
      catch{fail(httpError(502,'无法写入 MCP 进程'));}
    }
    function list(){
      sequence++;
      send({id:sequence,method:'tools/list',params:cursor?{cursor}:{}});
    }
    function handle(message){
      if(!message||message.jsonrpc!=='2.0'||typeof message.id!=='number')return;
      if(message.error)return fail(httpError(502,'MCP 服务返回协议错误'));
      if(message.id===1){
        if(typeof message.result?.protocolVersion!=='string')return fail(httpError(502,'MCP 初始化响应无效'));
        send({method:'notifications/initialized'});
        sequence=1;list();
        return;
      }
      if(message.id!==sequence||!Array.isArray(message.result?.tools))return fail(httpError(502,'MCP 工具列表响应无效'));
      const entries=message.result.tools,remaining=100-tools.length;
      for(const tool of entries){
        if(tools.length>=100)break;
        if(tool&&typeof tool.name==='string'&&tool.name.trim())tools.push({name:tool.name.slice(0,128),description:typeof tool.description==='string'?tool.description.slice(0,500):''});
      }
      const next=message.result.nextCursor;
      if(typeof next==='string'&&next){
        hasMore=true;
        if(tools.length<100&&sequence<6&&!seen.has(next)&&next.length<=2048){seen.add(next);cursor=next;list();return;}
      }else hasMore=entries.length>remaining;
      finish(null,{connected:true,protocolVersion:protocolVersion,serverInfo:null,tools,hasMore,message:'本地 MCP 握手成功，已读取工具列表（未执行工具）'});
    }
    let protocolVersion='';
    function onLine(line){
      if(!line.trim())return;
      let message;
      try{message=JSON.parse(line);}catch{return fail(httpError(502,'MCP stdio 输出不是有效 JSON'));}
      if(message?.id===1&&typeof message.result?.protocolVersion==='string')protocolVersion=message.result.protocolVersion;
      handle(message);
    }
    child.stdout.on('data',chunk=>{
      buffer+=chunk.toString('utf8');
      if(buffer.length>262144)return fail(httpError(413,'MCP stdout 超出限制'));
      let end;
      while((end=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
        onLine(line);
        if(settled)return;
      }
    });
    child.on('error',()=>fail(httpError(502,'MCP 进程启动失败')));
    child.on('exit',()=>fail(httpError(502,'MCP 进程提前退出')));
    send({id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'StripBot',version:'1.0'}}});
  });
}
module.exports={probeStdio};
