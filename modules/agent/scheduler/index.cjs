'use strict';
// Durable, bounded task queue for Codex App Server threads.
// One active turn per session; distinct workspaces may execute concurrently.
// Pause uses turn/interrupt and creates a *new* continuation turn on resume:
// Codex App Server has no suspend/resume-in-place command.
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const problem=(status,message)=>Object.assign(new Error(message),{status});
const STATES=new Set(['queued','running','paused','done','failed','cancelled']);
const MAX_HISTORY=400;
const bounded=(value,fallback,max)=>Number.isFinite(Number(value))?Math.max(1,Math.min(max,Math.floor(Number(value)))):fallback;
function overlaps(a,b){
  const left=path.resolve(a),right=path.resolve(b);
  const relative=path.relative(left,right),inverse=path.relative(right,left);
  // On Windows path.relative is case-insensitive and handles drive roots.
  const inside=x=>x==='' || (!x.startsWith('..'+path.sep) && x!=='..' && !path.isAbsolute(x));
  return inside(relative)||inside(inverse);
}
const safeTask=task=>({id:task.id,sessionID:task.sessionID,preview:task.text.slice(0,120),status:task.status,createdAt:task.createdAt,startedAt:task.startedAt||null,endedAt:task.endedAt||null,attempts:task.attempts||0,error:task.error||null,review:task.review||null,preflight:task.preflight||null});
function createTaskScheduler({root,getEngine,onBeforeStart=()=>{},maxParallel=bounded(process.env.STRIPBOT_MAX_PARALLEL_TASKS,3,4),maxPending=100,logger=()=>{}}){
  if(!root||typeof getEngine!=='function')throw new TypeError('root and getEngine are required');
  const filename=path.join(root,'.runtime','agent-tasks.json');
  const temporary=filename+'.'+process.pid+'.'+randomBytes(6).toString('hex')+'.tmp';
  let tasks=[],paused=new Set(),loaded=false,loadPromise,closed=false,sequence=Promise.resolve();
  const active=new Map(); // session ID -> task ID; held until Codex emits turn/completed.
  const launches=new Map();
  let tickScheduled=false;
  const save=()=>{const image={version:1,tasks,paused:[...paused]};sequence=sequence.catch(()=>{}).then(async()=>{
    await fs.mkdir(path.dirname(filename),{recursive:true});
    await fs.writeFile(temporary,JSON.stringify(image),{mode:0o600});
    await fs.rename(temporary,filename);
  });return sequence;};
  async function load(){
    if(loaded)return;
    if(loadPromise)return loadPromise;
    loadPromise=(async()=>{
      try{
        const value=JSON.parse(await fs.readFile(filename,'utf8'));
        tasks=Array.isArray(value.tasks)?value.tasks.filter(t=>t && typeof t.id==='string' && /^tsk_[a-f0-9]{20}$/.test(t.id) && typeof t.text==='string' && typeof t.sessionID==='string' && typeof t.workspace==='string' && STATES.has(t.status)):[];
        paused=new Set(Array.isArray(value.paused)?value.paused.filter(x=>typeof x==='string'):[]);
      }catch(error){if(error.code!=='ENOENT')throw problem(500,'任务队列文件读取失败，请备份并修复 .runtime/agent-tasks.json。');}
      // Never replay a half-completed task automatically after a restart: an
      // interrupted command might already have mutated the user's workspace.
      for(const task of tasks){
        if(task.status==='running'){
          task.status='paused';task.error='上次运行异常退出，请检查已修改文件后再继续。';task.interrupted=true;
        }
        if(task.status==='queued' || task.status==='paused')paused.add(task.sessionID);
      }
      loaded=true;
    })().finally(()=>{loadPromise=null;});
    return loadPromise;
  }
  function notify(){if(closed||tickScheduled)return;tickScheduled=true;queueMicrotask(()=>{tickScheduled=false;void drain().catch(error=>logger(error));});}
  function eligible(task){
    if(task.status!=='queued' || paused.has(task.sessionID) || active.has(task.sessionID))return false;
    return ![...active.values()].some(id=>{
      const other=tasks.find(t=>t.id===id);
      return other && overlaps(other.workspace,task.workspace);
    });
  }
  function makePrompt(task){
    if(!task.interrupted)return task.text+'\n\n执行要求：先列出简短实施步骤，再逐步修改；完成后汇总改动文件、执行结果、未验证事项。遇到失败先诊断原因，不得自动执行危险的删除或重置操作。'+(task.contextPrompt||'');
    return `请继续之前被暂停、尚未完成的任务。\n原始任务：\n${task.text}\n\n重要：先检查当前工作区和测试状态，识别前一次已经完成的步骤。不要机械地重复已执行过的命令或破坏性操作；只完成剩余工作。`+(task.contextPrompt||''); 
  }
  function finish(task,kind,error){
    if(!task || !['running','paused'].includes(task.status) && !active.has(task.sessionID))return;
    const current=active.get(task.sessionID);
    if(current!==task.id)return;
    active.delete(task.sessionID);
    const interruption=task.interruption;
    task.interruption=null;task.endedAt=Date.now();
    task.review={phase:kind==='completed'?'awaiting_manual_verification':'requires_attention',finishedAt:task.endedAt,automaticallyVerified:false};
    if(interruption==='pause' && kind!=='completed'){
      task.status='paused';task.interrupted=true;task.error='已中断当前轮次；继续时将检查进度并开启新轮次。';
    }else if(interruption==='cancel'){
      task.status='cancelled';task.error=null;
    }else if(kind==='completed'){
      task.status='done';task.interrupted=false;task.error=null;
    }else{
      task.status='failed';task.error=String(error||'执行已中断或失败').slice(0,500);
      // Avoid accidentally running queued destructive work after a failure.
      paused.add(task.sessionID);
    }
    void save().catch(logger);
    notify();
  }
  function start(task){
    active.set(task.sessionID,task.id);
    task.status='running';task.startedAt=Date.now();task.endedAt=null;task.error=null;task.attempts=(task.attempts||0)+1;
    void save().catch(logger);
    const launch=(async()=>{
      try{
        const preflight=await onBeforeStart(task);
        if(preflight){task.preflight=preflight;await save();}
        if(active.get(task.sessionID)!==task.id || task.status!=='running')return;
        await getEngine().request('/api/session/'+task.sessionID+'/prompt',{text:makePrompt(task)});
        // turn/start is non-blocking; only turn/completed releases this slot.
      }catch(error){
        if(active.get(task.sessionID)===task.id)finish(task,'failed',error.message);
      }
    })();
    launches.set(task.sessionID,launch);void launch.finally(()=>{if(launches.get(task.sessionID)===launch)launches.delete(task.sessionID);});
  }
  async function drain(){
    await load();
    if(closed)return;
    while(active.size<maxParallel){
      const task=tasks.find(eligible);
      if(!task)break;
      start(task); // synchronously reserves the session/workspace lock
    }
  }
  function taskFor(sessionID,id){
    const task=tasks.find(t=>t.id===id && t.sessionID===sessionID);
    if(!task)throw problem(404,'任务不属于当前会话或已不存在。');
    return task;
  }
  function state(sessionID){
    const list=tasks.filter(task=>task.sessionID===sessionID);
    return {paused:paused.has(sessionID),running:active.has(sessionID),tasks:list.map(safeTask),queued:list.filter(t=>t.status==='queued').length,maxParallel,activeCount:active.size,workspacePolicy:'同一或嵌套工作区仅允许一个写入任务执行'};
  }
  return {
    async forget(sessionID){await load();if(active.has(sessionID))throw problem(409,'当前仍有运行中的任务。');tasks=tasks.filter(t=>t.sessionID!==sessionID);paused.delete(sessionID);await save();},
    async initialize(){await load();},
    async submit({sessionID,workspace,text}){
      await load();
      if(closed)throw problem(503,'执行队列已关闭。');
      if(typeof text!=='string'||!text.trim())throw problem(400,'请输入任务指令。');
      if(tasks.filter(t=>['queued','paused','running'].includes(t.status)).length>=maxPending)throw problem(429,'排队任务已达到上限，请先完成或取消部分任务。');
      if(tasks.filter(t=>t.sessionID===sessionID && ['queued','paused','running'].includes(t.status)).length>=30)throw problem(429,'当前会话已有 30 个待处理任务。');
      const task={id:'tsk_'+randomBytes(10).toString('hex'),sessionID,workspace,text,status:'queued',createdAt:Date.now(),attempts:0};
      tasks.push(task);
      // Preserve unfinished tasks; trim old completed history only.
      const old=tasks.filter(t=>['done','failed','cancelled'].includes(t.status));
      if(old.length>MAX_HISTORY){const remove=new Set(old.slice(0,old.length-MAX_HISTORY).map(t=>t.id));tasks=tasks.filter(t=>!remove.has(t.id));}
      await save();notify();return {accepted:true,task:safeTask(task),...state(sessionID)};
    },
    async state(sessionID){await load();return state(sessionID);},
    async markReviewed(sessionID,id,{verified,note}={}){
      await load();
      const task=taskFor(sessionID,id);
      if(!['done','failed','cancelled'].includes(task.status))throw problem(409,'任务尚未结束，无法标记验证结果');
      if(typeof verified!=='boolean'||typeof note!=='string'||note.length>500)throw problem(400,'验证结果或说明无效');
      task.review={phase:verified?'verified':'requires_attention',finishedAt:task.endedAt,automaticallyVerified:false,manuallyVerified:verified,note:note.trim(),reviewedAt:Date.now()};
      await save();
      return {task:safeTask(task)};
    },
    async overview(){await load();return {maxParallel,activeCount:active.size,queued:tasks.filter(t=>t.status==='queued').length,pausedSessions:[...paused],runningSessions:[...active.keys()]};},
    async hasOutstanding(){await load();return tasks.some(t=>['running','queued','paused'].includes(t.status));},
    onEvent(event){
      if(!loaded)return;
      if(event?.type==='session.disconnected'){
        for(const activeTaskID of [...active.values()]){const task=tasks.find(t=>t.id===activeTaskID);if(task)finish(task,'failed','Codex app-server 连接中断。');}
        return;
      }
      const id=event?.data?.sessionID;
      if(!id||!active.has(id))return;
      if(['session.turn.completed','session.step.ended','session.execution.failed'].includes(event.type)){
        const task=tasks.find(t=>t.id===active.get(id));
        if(!task)return;
        const success=event.type==='session.step.ended'||event.data?.status==='completed';
        finish(task,success?'completed':'failed',event.data?.error||event.data?.status||'Codex 执行失败');
      }
    },
    async pause(sessionID){
      await load();paused.add(sessionID);
      const task=tasks.find(t=>t.id===active.get(sessionID));
      if(task){
        task.interruption='pause';
        await launches.get(sessionID);
        if(active.get(sessionID)!==task.id){await save();return state(sessionID);}
        try{await getEngine().request('/api/session/'+sessionID+'/interrupt',{});}
        catch(error){task.interruption=null;await save();if(active.get(sessionID)===task.id)throw error;}
        // Some adapters do not emit the completion event after interrupt.
        if(active.get(sessionID)===task.id)finish(task,'interrupted');
      }
      await save();return state(sessionID);
    },
    async resume(sessionID){
      await load();paused.delete(sessionID);
      for(const task of tasks){if(task.sessionID===sessionID && task.status==='paused'){task.status='queued';task.startedAt=null;task.endedAt=null;}}
      await save();notify();return state(sessionID);
    },
    async stop(sessionID){
      await load();paused.add(sessionID);
      const task=tasks.find(t=>t.id===active.get(sessionID));
      if(task){
        task.interruption='cancel';
        await launches.get(sessionID);
        if(active.get(sessionID)!==task.id){await save();return state(sessionID);}
        try{await getEngine().request('/api/session/'+sessionID+'/interrupt',{});}
        catch(error){task.interruption=null;await save();throw error;}
        if(active.get(sessionID)===task.id)finish(task,'interrupted');
      }
      await save();return state(sessionID);
    },
    async cancel(sessionID,id){
      await load();const task=taskFor(sessionID,id);
      if(['done','failed','cancelled'].includes(task.status))return {task:safeTask(task),...state(sessionID)};
      if(task.status==='running'){
        task.interruption='cancel';
        await launches.get(sessionID);
        if(active.get(sessionID)!==task.id)return {task:safeTask(task),...state(sessionID)};
        try{await getEngine().request('/api/session/'+sessionID+'/interrupt',{});}
        catch(error){task.interruption=null;throw error;}
        if(active.get(sessionID)===task.id)finish(task,'interrupted');
      }else{task.status='cancelled';task.endedAt=Date.now();}
      await save();notify();return {task:safeTask(task),...state(sessionID)};
    },
    async assertEmpty(sessionID){await load();if(tasks.some(t=>t.sessionID===sessionID && ['running','queued','paused'].includes(t.status)))throw problem(409,'会话仍有运行中、排队或暂停的任务；请先取消任务。');},
    async close(){closed=true;if(!loaded && !loadPromise)return;await load();for(const id of active.values()){
      const task=tasks.find(t=>t.id===id);if(task){task.status='paused';task.interrupted=true;task.error='Strip Bot 已关闭，请检查状态后继续。';paused.add(task.sessionID);}
    }active.clear();await save();await sequence;},
  };
}
module.exports={createTaskScheduler,overlaps};
