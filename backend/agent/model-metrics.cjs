'use strict';
const {performance}=require('node:perf_hooks');
const finite=value=>typeof value==='number' && Number.isFinite(value) && value>=0;
const count=value=>finite(value)?value:null;
// No tokenizer is available at this boundary. This is explicitly an estimate,
// accumulated over visible text/tool argument deltas, never private reasoning.
function estimateTokens(text){let amount=0;for(const char of text)amount+=/\p{Script=Han}/u.test(char)?1:0.25;return amount;}
function usage(tokens){return {outputTokens:count(tokens?.output),inputTokens:finite(tokens?.input)?tokens.input+(count(tokens?.cache?.read)||0)+(count(tokens?.cache?.write)||0):null};}
function history(samples,now){const bars=Array(24).fill(0);for(const sample of samples){const age=now-sample.at;if(age>=0 && age<6000)bars[Math.min(23,Math.floor((6000-age)/250))]+=sample.amount;}return bars;}
function historicalMetrics(messages,model,provider){
  const message=messages.find(item=>item.type==='assistant');if(!message)return null;
  const end=message.time?.streamed ?? message.time?.completed;
  return {model:message.model?.id || model,provider,status:message.error?'error':finite(end)?'success':'idle',source:'usage',tokensPerSecond:null,ttftMs:null,...usage(message.tokens),elapsedMs:finite(end) && finite(message.time?.created)?Math.max(0,end-message.time.created):null,history:[]};
}
function createModelMetrics({now=()=>performance.now(),wall=()=>Date.now()}={}){
  const sessions=new Map();
  const trim=()=>{if(sessions.size>200){for(const [id,run] of sessions){if(run.end!==null){sessions.delete(id);if(sessions.size<=200)break;}}}};
  function begin(id,model,provider){sessions.delete(id);sessions.set(id,{model,provider,started:now(),wallStarted:wall(),first:null,visibleFirst:null,visibleLast:null,end:null,streamed:null,messageID:null,amount:0,samples:[],seen:new Set(),outputTokens:null,inputTokens:null,status:'running',partial:false});trim();}
  function event(event){
    const data=event?.data,run=sessions.get(data?.sessionID);if(!run)return;
    if(event.id && run.seen.has(event.id))return;
    if(event.id){run.seen.add(event.id);if(run.seen.size>4096)run.seen.delete(run.seen.values().next().value);}
    const time=now(),type=event.type;
    if(type==='session.step.started'){
      // Each model request has its own latency/rate; tool/approval waits are excluded.
      begin(data.sessionID,data.model?.id || data.model?.model || run.model,run.provider);
      const next=sessions.get(data.sessionID);next.messageID=data.assistantMessageID;
      if(event.id)next.seen.add(event.id);
      if(finite(data.started))next.started=time-Math.max(0,wall()-data.started);
      return;
    }
    if(data.assistantMessageID && run.messageID && data.assistantMessageID!==run.messageID)return;
    if(type==='session.text.delta' || type==='session.tool.input.delta' || type==='session.reasoning.delta'){
      if(run.end!==null || typeof data.delta!=='string' || !data.delta)return;
      if(run.first===null)run.first=time;
      if(type!=='session.reasoning.delta'){
        if(run.visibleFirst===null)run.visibleFirst=time;
        run.visibleLast=time;const amount=estimateTokens(data.delta);run.amount+=amount;run.samples.push({at:time,amount});
        run.samples=run.samples.filter(sample=>time-sample.at<6000).slice(-2048);
      }
    }
    if(type==='session.step.streamed'){run.streamed=time;run.end=time;run.status='success';}
    if(type==='session.step.ended' || type==='session.step.failed' || type==='session.turn.completed'){
      run.end=run.streamed ?? time;run.status=(type.endsWith('failed') || (type==='session.turn.completed' && data.status!=='completed'))?'error':'success';Object.assign(run,usage(data.tokens));
    }
    if(type==='session.execution.failed' || type==='session.execution.interrupted'){run.end??=time;run.status='error';}
  }
  function finish(id,status='error'){const run=sessions.get(id);if(run){run.end??=now();run.status=status;}}
  function disconnect(){for(const run of sessions.values())if(run.status==='running'){run.partial=true;}}
  function snapshot(id,messages,model,provider){
    const run=sessions.get(id);if(!run)return historicalMetrics(messages,model,provider);
    if(!run.messageID){
      const current=messages.find(message=>message.type==='assistant' && message.time?.created>=run.wallStarted);
      if(!current)return view(run);
      run.messageID=current.id;run.partial=true;
    }
    const message=messages.find(item=>item.id===run.messageID);
    // Snapshot usage can fill a missed terminal event, but cannot recreate missed deltas.
    if(message && finite(message.time?.streamed) && run.end===null){run.end=now();run.partial=true;run.status=message.error?'error':'success';}
    if(message?.tokens && (finite(message.time?.streamed) || finite(message.time?.completed)))Object.assign(run,usage(message.tokens));
    return view(run);
  }
  function view(run){
    const time=run.end ?? now();
    const duration=run.visibleFirst!==null && run.visibleLast!==null?run.visibleLast-run.visibleFirst:0;
    return {model:run.model,provider:run.provider,status:run.status,source:run.partial?'partial':run.outputTokens!==null?'engine':run.messageID?'observed':'pending',tokensPerSecond:!run.partial && duration>=350?run.amount/(duration/1000):null,ttftMs:!run.partial && run.first!==null?Math.max(0,run.first-run.started):null,outputTokens:run.outputTokens ?? (run.amount?Math.ceil(run.amount):null),inputTokens:run.inputTokens,elapsedMs:Math.max(0,time-run.started),history:run.partial?[]:history(run.samples,time)};
  }
  return {begin,event,finish,disconnect,snapshot};
}
module.exports={createModelMetrics,historicalMetrics,estimateTokens};
