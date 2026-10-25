'use strict';
// Explicit acceptance command: uses the already-authorized ChatGPT account.
const fs=require('node:fs/promises'),path=require('node:path');
const base=process.env.STRIP_TEST_BASE || 'http://127.0.0.1:3060';
async function api(route,body){const response=await fetch(base+'/api/agent'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const value=await response.json();if(!response.ok)throw new Error(value.error);return value;}
(async()=>{
  const report={real:true,model:'gpt-6-luna',samples:[]};let id;
  try{
    const result=await api('/sessions',{provider:'opencode',modelOverride:report.model,workspace:path.resolve(__dirname,'..'),title:'模型速率真实验收'});id=result.session.id;report.sessionID=id;
    await api('/sessions/'+id+'/prompt',{provider:'opencode',text:'这是模型输出计时验收。不要调用任何工具，不读取文件。请写一段约 200 字的中文，介绍如何保持书桌整洁，直接给出正文。末尾单独写 STRIP_METRICS_OK。'});
    const end=Date.now()+60000;
    while(Date.now()<end){const state=await api('/sessions/'+id);report.samples.push(state.metrics);if(state.messages.some(message=>message.error)){report.error=state.messages.find(message=>message.error).error;break;}
      const reply=state.messages.filter(message=>message.type==='assistant').flatMap(message=>message.content || []).filter(part=>part.type==='text').map(part=>part.text).join('');
      if(!state.running && reply){report.reply=reply;report.metrics=state.metrics;report.passed=reply.includes('STRIP_METRICS_OK') && state.metrics?.source==='engine' && state.metrics?.ttftMs!==null && state.metrics?.outputTokens>0;break;}
      await new Promise(resolve=>setTimeout(resolve,700));
    }
    if(!report.passed && !report.error)report.error='Real event metrics did not meet acceptance conditions';
  }catch(error){report.error=error.message;}
  await fs.writeFile(path.resolve(__dirname,'../.runtime/model-metrics-real-20261015.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({real:true,passed:report.passed || false,sessionID:id,metrics:report.metrics,error:report.error,samples:report.samples.length}));
  if(!report.passed)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
