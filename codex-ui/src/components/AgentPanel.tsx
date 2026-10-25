import {useEffect,useRef,useState} from 'react';
import {TaskQueuePanel} from './Activity/TaskQueuePanel';
import {linearActivity} from './Activity/activity-events';
import {Icon} from '../Icons';
import './agent-panel.css';
import {QuestionCard} from './Questions/QuestionCard';
import type {QuestionAnswer,QuestionSpec} from './Questions/QuestionCard';
import type {Config} from '../domain/chat';
type Model = {id:string;providerID:string;name:string};
export type Permission = {id:string;action:string;resources:string[];save?:string[];metadata?:unknown;message?:string;source?:{type:string;messageID:string;id:string}};
export type ApprovalDecision='once'|'always'|'reject';
export type ApprovalConfirmation={confirmed:true;confirmedAction:string;confirmedRules:string[]};
type FormField = {key:string;type:string;title?:string;description?:string;required?:boolean;hidden?:boolean;default?:string|number|boolean|string[];options?:{value:string;label:string}[];when?:{key:string;op:string;value:unknown}[]};
type AgentForm = {id:string;title:string;fields:FormField[]};
type Tool = {type:string;id?:string;name?:string;text?:string;time?:{created?:number;ran?:number;completed?:number};state?:{status:string;input?:unknown;content?:unknown;error?:unknown}};
type Message = {id:string;type:string;text?:string;command?:string;output?:unknown;error?:unknown;time?:{created?:number;completed?:number};content?:Tool[]};
export type ModelMetrics={model:string;provider:string;status:string;source:string;tokensPerSecond:number|null;ttftMs:number|null;outputTokens:number|null;inputTokens:number|null;elapsedMs:number|null;history:number[]};
export type ApprovalMode='ask'|'allow-all';
export type QueueTask={id:string;sessionID:string;preview:string;status:'queued'|'running'|'paused'|'done'|'failed'|'cancelled';createdAt:number;startedAt?:number|null;endedAt?:number|null;attempts:number;error?:string|null};
export type Snapshot = {tasks?:QueueTask[];queuePaused?:boolean;queueCount?:number;maxParallel?:number;parallelRunning?:number;manualRunning?:boolean;approvalMode?:ApprovalMode;running:boolean;messages:Message[];permissions:Permission[];diff:unknown[];workspace:string;forms:AgentForm[];model?:Model;configurationChanged?:boolean;connection?:string;connectionRevision?:string;metrics?:ModelMetrics|null};
type Session = {id:string;title:string};
async function api<T>(route:string,body?:unknown):Promise<T> {
  const response = await fetch('/api/agent'+route,{method:body === undefined ? 'GET':'POST',headers:{'Content-Type':'application/json'},body:body === undefined ? undefined:JSON.stringify(body)});
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
  return value;
}
function saved<T>(key:string,fallback:T):T {try {return JSON.parse(localStorage.getItem(key)||'null') ?? fallback;} catch {return fallback;}}
function pretty(value:unknown) {return typeof value === 'string' ? value : JSON.stringify(value,null,2);}
function fieldValue(answer:Record<string,unknown>,field:FormField):unknown {
  return answer[field.key];
}
export function QuestionForm({form,onAnswer}:{form:AgentForm;onAnswer:(answer:Record<string,unknown>) => Promise<void>}) {
  const [answer,setAnswer]=useState<Record<string,unknown>>(()=>Object.fromEntries(form.fields.map(field=>[
    field.key,
    field.default ?? (field.type==='multiselect'?[]:field.type==='boolean'?false:''),
  ])));
  const [error,setError]=useState('');
  const visible=(field:FormField)=>!field.hidden&&(field.when||[]).every(condition=>{
    const value=answer[condition.key],equal=Array.isArray(value)?value.includes(condition.value):value===condition.value;
    return condition.op==='eq'?equal:!equal;
  });
  const fields=form.fields.filter(visible);
  const questions:QuestionSpec[]=fields.map(field=>{
    const booleanOptions=[{value:'true',label:'是'},{value:'false',label:'否'}];
    const options=field.type==='boolean'?booleanOptions:(field.options||[]).map(option=>({value:option.value,label:option.label}));
    return {
      id:field.key,
      title:field.title||field.key,
      description:field.description,
      options,
      multiple:field.type==='multiselect',
      allowCustom:field.type==='boolean'?false:true,
      customLabel:options.length?'其他':'填写内容',
    };
  });
  const defaults:QuestionAnswer[]=fields.map(field=>{
    const value=fieldValue(answer,field);
    if(Array.isArray(value))return {questionId:field.key,values:value.map(String)};
    if(field.type==='boolean')return {questionId:field.key,values:[String(Boolean(value))]};
    const stringValue=value===undefined||value===null?'':String(value);
    if((field.options||[]).some(option=>option.value===stringValue))return {questionId:field.key,values:[stringValue]};
    return {questionId:field.key,values:[],custom:stringValue||undefined};
  });
  const applyAnswers=(answers:QuestionAnswer[])=>{
    const byId=new Map(answers.map(item=>[item.questionId,item]));
    setAnswer(previous=>{
      const next={...previous};
      for(const field of fields){
        const item=byId.get(field.key);
        if(!item)continue;
        const custom=item.custom?.trim();
        if(field.type==='multiselect')next[field.key]=custom?[...item.values,custom]:item.values;
        else if(field.type==='boolean')next[field.key]=item.values[0]==='true';
        else if(['integer','number'].includes(field.type))next[field.key]=custom||item.values[0]?Number(custom||item.values[0]):'';
        else next[field.key]=custom||item.values[0]||'';
      }
      return next;
    });
  };
  const payload=(answers:QuestionAnswer[])=>{
    const byId=new Map(answers.map(item=>[item.questionId,item]));
    return Object.fromEntries(fields.map(field=>{
      const item=byId.get(field.key),custom=item?.custom?.trim(),value=custom||item?.values[0]||'';
      if(field.type==='multiselect')return [field.key,custom?[...(item?.values||[]),custom]:(item?.values||[])];
      if(field.type==='boolean')return [field.key,item?.values[0]==='true'];
      if(['integer','number'].includes(field.type))return [field.key,value===''?'':Number(value)];
      return [field.key,value];
    }));
  };
  return <div className="strip-agent-question strip-agent-question--cards">
    <QuestionCard heading={form.title} questions={questions} defaultAnswers={defaults}
      onChange={applyAnswers}
      onSubmit={async answers=>{
        setError('');
        try{await onAnswer(payload(answers));}
        catch(submitError){setError(submitError instanceof Error?submitError.message:'答复失败');}
      }}/>
    {error&&<p className="strip-error" role="alert">{error}</p>}
  </div>;
}
export function AgentPanel({config,currentModel}:{config:Config;currentModel?:string}) {
  const sessionKey=config.provider==='ccswitch'?'strip_cc_agent_sessions_v1':'strip_agent_sessions_v1';
  const activeKey=config.provider==='ccswitch'?'strip_cc_agent_active_v1':'strip_agent_active_v1';
  const [workspace,setWorkspace]=useState(''),[parallelWorkspace,setParallelWorkspace]=useState('');
  const [models,setModels]=useState<Model[]>([]),[model,setModel]=useState('');
  const [sessions,setSessions]=useState<Session[]>(()=>saved(sessionKey,[]));
  const [active,setActive]=useState<string>(()=>saved(activeKey,''));
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[draft,setDraft]=useState('');
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[sending,setSending]=useState(false);
  const [deciding,setDeciding]=useState('');
  const timeline=useRef<HTMLDivElement>(null),follow=useRef(true);
  const [showBottom,setShowBottom]=useState(false);
  const activity=linearActivity(snapshot);
  const tasks=snapshot?.tasks || [];
  useEffect(()=>{
    let disposed=false;
    if(active){setLoading(false);return;}
    setLoading(true);setError('');
    (async()=>{
      const status=await api<{installed:boolean;workspace:string}>('/status');
      if(!disposed){setWorkspace(status.workspace);setParallelWorkspace(value=>value||status.workspace);}
      if(!status.installed)throw new Error('尚未安装 Codex CLI：请在 agent-runtime 目录运行 npm install。');
      await api('/configure',{endpoint:config.endpoint,model:config.model,provider:config.provider});
      const response=await api<{models:Model[]}>('/models');
      if(!disposed){setModels(response.models);setModel(response.models[0]?.id||'');}
    })().catch(e=>{if(!disposed)setError(e.message);}).finally(()=>{if(!disposed)setLoading(false);});
    return()=>{disposed=true;};
  },[config.endpoint,config.model,config.provider,currentModel,active]);
  useEffect(()=>{
    try{localStorage.setItem(sessionKey,JSON.stringify(sessions));localStorage.setItem(activeKey,JSON.stringify(active));}
    catch{setError('无法保存 Agent 会话索引。');}
  },[sessions,active,sessionKey,activeKey]);
  useEffect(()=>{
    setSnapshot(null);
    if(!active)return;
    let disposed=false,timer:ReturnType<typeof setTimeout>;
    async function poll(){
      let delay=1100;
      try{const value=await api<Snapshot>('/sessions/'+active);
        if(!disposed){setSnapshot(value);delay=value.running||value.queueCount||value.permissions.length?400:1100;}
      }catch(e){if(!disposed)setError(e instanceof Error?e.message:'获取会话失败');}
      finally{if(!disposed)timer=setTimeout(poll,delay);}
    }
    void poll();return()=>{disposed=true;clearTimeout(timer);};
  },[active]);
  useEffect(()=>{
    const node=timeline.current;if(node&&follow.current)node.scrollTop=node.scrollHeight;
  },[snapshot]);
  function onScroll(){const node=timeline.current;if(!node)return;
    const away=node.scrollHeight-node.scrollTop-node.clientHeight>100;follow.current=!away;setShowBottom(away);
  }
  function bottom(){const node=timeline.current;if(!node)return;
    follow.current=true;node.scrollTo({top:node.scrollHeight,behavior:'smooth'});setShowBottom(false);
  }
  async function send(parallel=false){
    if(sending||!draft.trim()||!model)return;
    setSending(true);setError('');const prompt=draft;
    try{
      let id=parallel?'':active;
      if(!id){
        const selected=models.find(item=>item.id===model);
        if(!selected)throw new Error('请先选择可用模型。');
        const directory=parallel?(parallelWorkspace.trim()||workspace):workspace;
        const result=await api<{session:Session}>('/sessions',{workspace:directory,model:{providerID:selected.providerID,id:selected.id},followCurrent:config.provider==='ccswitch',title:prompt.slice(0,35)});
        id=result.session.id;
        setSessions(all=>[{id,title:result.session.title||prompt.slice(0,35)},...all]);
        setActive(id);
      }
      await api('/sessions/'+id+'/prompt',{text:prompt,followCurrent:config.provider==='ccswitch'});
      setDraft('');
    }catch(e){setError(e instanceof Error?e.message:'无法提交任务');}
    finally{setSending(false);}
  }
  async function taskAction(name:'pause'|'resume'|'interrupt'){
    if(!active)return;
    try{const result=await api<{tasks:QueueTask[];paused:boolean}>('/sessions/'+active+'/'+name,{});
      setSnapshot(current=>current?{...current,tasks:result.tasks,queuePaused:result.paused}:current);
    }catch(e){const message=e instanceof Error?e.message:'操作失败';setError(message);throw e;}
  }
  async function cancelTask(id:string){
    const result=await api<{tasks:QueueTask[]}>('/sessions/'+active+'/tasks/'+id+'/cancel',{});
    setSnapshot(current=>current?{...current,tasks:result.tasks}:current);
  }
  async function decide(id:string,decision:'once'|'reject'){
    setDeciding(id);
    try{await api('/sessions/'+active+'/permissions',{requestID:id,decision});
      setSnapshot(current=>current?{...current,permissions:current.permissions.filter(p=>p.id!==id)}:current);
    }catch(e){setError(e instanceof Error?e.message:'审批失败');}
    finally{setDeciding('');}
  }
  return <section className="strip-agent strip-agent-v2">
    <header className="strip-agent-header"><strong>Codex · 执行工作台</strong><span>{loading?'启动中…':snapshot?.queuePaused?'已暂停':snapshot?.permissions.length?'待审批':snapshot?.running?'执行中':tasks.some(item=>item.status==='queued')?'排队中':'就绪'}</span></header>
    <div className="strip-agent-config">
      <label>工作目录<input value={snapshot?.workspace||workspace} disabled={Boolean(active)} onChange={e=>setWorkspace(e.target.value)}/></label>
      <label>模型<input readOnly value={active?snapshot?.model?.id||'正在读取':currentModel||model}/></label>
      <button type="button" className="strip-btn strip-btn--secondary" disabled={sending} onClick={()=>{setActive('');setSnapshot(null);setError('');follow.current=true;}}>新会话</button>
      {active && <button type="button" className="strip-btn strip-btn--secondary" onClick={()=>void taskAction('interrupt')}>停止当前任务</button>}
    </div>
    <p className="strip-muted">运行中发送的新指令会进入队列；不同目录的会话可以并行执行，同一目录按顺序执行。</p>
    <nav className="strip-agent-history" aria-label="会话记录">{sessions.map(session=><button type="button" className={'strip-btn '+(active===session.id?'strip-btn--primary':'strip-btn--secondary')} key={session.id} onClick={()=>{setActive(session.id);setError('');follow.current=true;}}>{session.title}</button>)}</nav>
    {error && <p role="alert" className="strip-error">{error}</p>}
    <TaskQueuePanel snapshot={snapshot} onPause={()=>taskAction('pause')} onResume={()=>taskAction('resume')} onCancel={cancelTask}/>
    <div className="strip-agent-scroll-wrap">
      <div className="strip-agent-timeline" ref={timeline} onScroll={onScroll} aria-label="Codex 线性执行记录">
        {!active && <p className="strip-muted">选择项目目录并描述需要执行的任务。</p>}
        {activity.turns.map(({message,events})=><div className="strip-agent-turn" key={message.id}>
          {message.type==='user' && <div className="strip-agent-user">{message.text}</div>}
          {!!events.length && <ol className="strip-agent-linear">{events.filter(e=>e.type!=='approval').map(event=><li key={event.id} data-status={event.status}>
            <span className="strip-agent-linear-dot" aria-hidden="true"/>
            <details open={event.status==='running'}><summary>{event.title} <span>{event.status==='running'?'执行中':event.status==='success'?'已完成':event.status==='error'?'失败':'等待中'}</span></summary>
              {event.path && <code>{event.path}</code>}
              {event.detail && <pre>{pretty(event.detail)}</pre>}
            </details>
          </li>)}</ol>}
          {message.type==='assistant' && !!message.text && <div className="strip-agent-answer">{message.text}</div>}
          {!!message.error && <p className="strip-error">{pretty(message.error)}</p>}
        </div>)}
        {!!snapshot?.permissions.length && <div className="strip-agent-permissions">{snapshot.permissions.map(permission=><article key={permission.id}>
          <strong>审批 · {permission.action}</strong><pre>{permission.resources.join('\n')}</pre>
          <button type="button" disabled={Boolean(deciding)} onClick={()=>void decide(permission.id,'once')}>允许本次</button>
          <button type="button" disabled={Boolean(deciding)} onClick={()=>void decide(permission.id,'reject')}>拒绝</button>
        </article>)}</div>}
        {snapshot?.forms.map(form=><QuestionForm key={form.id} form={form} onAnswer={async answer=>{
          await api('/sessions/'+active+'/forms',{formID:form.id,answer});
          setSnapshot(current=>current?{...current,forms:current.forms.filter(f=>f.id!==form.id)}:current);
        }}/>) }
      </div>
      {showBottom && <button className="strip-agent-jump" type="button" onClick={bottom}><Icon name="arrow-down"/>到底部</button>}
    </div>
    <form className="strip-agent-composer" onSubmit={event=>{event.preventDefault();void send();}}>
      <textarea aria-label="Agent 任务" placeholder={snapshot?.running?'继续输入，新指令将加入队列…':'输入任务，支持连续发送…'} value={draft} maxLength={60000} onChange={event=>setDraft(event.target.value)}/>
      <div className="strip-agent-composer-buttons">
        <button className="strip-btn strip-btn--primary" disabled={loading||sending||snapshot?.configurationChanged||!draft.trim()||(!active&&!model)}>{sending?'提交中…':snapshot?.running?'加入队列':'发送任务'}</button>
        <button type="button" className="strip-btn strip-btn--secondary" disabled={loading||sending||!draft.trim()||!model} onClick={()=>void send(true)} title="新建独立会话执行；同目录的写入仍会排队">并行新任务</button>
      </div>
    </form>
    <label className="strip-agent-parallel-path">并行任务目录<input aria-label="并行任务工作目录" value={parallelWorkspace} onChange={event=>setParallelWorkspace(event.target.value)} placeholder="选择另一个独立项目目录"/></label>
  </section>;
}
