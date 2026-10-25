import {Fragment,useEffect,useId,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import type {Snapshot} from '../AgentPanel';
import {QuestionForm} from '../AgentPanel';
import {ControlIcon} from '../ControlIcon';
import {Icon} from '../../Icons';
import {ApprovalPanel,type Decide} from './ApprovalPanel';
import {activityStatus,linearActivity,type ActivityEvent} from './activity-events';
import {TaskQueuePanel} from './TaskQueuePanel';
import './unified-conversation-stream.css';

type Message=Snapshot['messages'][number];
type Filter='all'|'ops'|'files'|'alerts';
const FILTERS:{id:Filter;name:string}[]=[
  {id:'all',name:'全部'},{id:'ops',name:'执行过程'},
  {id:'files',name:'文件修改'},{id:'alerts',name:'提醒与异常'}
];
const STATE_LABEL:Record<string,string>={running:'执行中',success:'已完成',error:'失败',pending:'等待确认',idle:'已停止'};
const ICON_NAME:Record<string,string>={command:'terminal-soft',edit:'square-pen',read:'file',search:'search',plan:'checklist-minimalistic',test:'check',error:'close-circle',warning:'info',approval:'info',summary:'check',thinking:'lightbulb'};
const asObject=(value:unknown):Record<string,unknown>=>value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
const str=(value:unknown)=>typeof value==='string'?value:'';
const lines=(value:unknown)=>Array.isArray(value)?value:[];
const inFilter=(event:ActivityEvent,filter:Filter)=>filter==='all' ||
  (filter==='ops' && !['edit','approval','error','warning'].includes(event.type)) ||
  (filter==='files' && event.type==='edit') ||
  (filter==='alerts' && ['approval','error','warning'].includes(event.type));

async function copyText(text:string){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
  const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.opacity='0';
  document.body.append(field);field.select();
  try {if(!document.execCommand('copy'))throw new Error('剪贴板不可用');}
  finally{field.remove();}
}

function Detail({event,onError}:{event:ActivityEvent;onError:(message:string)=>void}){
  const detail=asObject(event.detail),kind=str(detail.kind);
  if(kind==='command'){
    const content=`$ ${str(detail.command)}\n${str(detail.output)}`.trimEnd();
    return <div className="strip-stream-detail strip-stream-terminal">
      <div className="strip-stream-detail-heading"><span>{str(detail.cwd)||'终端输出'}</span><button type="button" onClick={()=>void copyText(content).catch(()=>onError('复制失败，请直接选中命令或输出进行复制。'))}><Icon name="copy"/>复制</button></div>
      <pre><code>{content}</code></pre>
    </div>;
  }
  if(kind==='diff' || kind==='files'){
    const changes=lines(detail.diff).map((item,index)=>({item:asObject(item),index}));
    return <div className="strip-stream-detail">
      {!!detail.diffTitle && <div className="strip-stream-detail-heading">{str(detail.diffTitle)}</div>}
      {!!lines(detail.files).length && <ul className="strip-stream-files">{lines(detail.files).map((item,i)=>{
        const file=asObject(item);return <li key={i}><code>{typeof item==='string'?item:str(file.path)||'file'}</code><span>{typeof file.add==='number'?`+${file.add}`:''} {typeof file.del==='number'?`-${file.del}`:''}</span></li>;
      })}</ul>}
      {!!changes.length && <div className="strip-stream-diff" role="region" aria-label="文件修改内容">{changes.map(({item,index})=>
        <div key={index} data-kind={['add','del'].includes(str(item.kind))?str(item.kind):'context'}><span aria-hidden="true">{index+1}</span><code>{str(item.text)}</code></div>
      )}</div>}
    </div>;
  }
  if(kind==='plan')return <div className="strip-stream-detail"><ol className="strip-stream-plan">{lines(detail.steps).map((item,i)=>{
    const step=asObject(item);return <li key={i} data-step={str(step.status)||'todo'}><span aria-hidden="true">{step.status==='done'?'✓':step.status==='active'?'◉':'○'}</span>{str(step.title)}</li>;
  })}</ol></div>;
  if(kind==='summary')return <div className="strip-stream-detail"><p>{str(detail.message)}</p>{!!lines(detail.stats).length && <p className="strip-stream-detail-stats">{lines(detail.stats).map(String).join(' · ')}</p>}</div>;
  return <div className={'strip-stream-detail'+(kind==='error'?' strip-stream-detail--error':'')}><pre>{str(detail.message)||'暂无更多详情'}</pre>{detail.code!==undefined && <code>{str(detail.code)}</code>}</div>;
}

function Step({event,opened,toggle,onError,children}:{event:ActivityEvent;opened:boolean;toggle:()=>void;onError:(message:string)=>void;children?:ReactNode}){
  const hasDetail=Boolean(event.detail || children),id='strip-stream-'+useId();
  return <article className="strip-stream-step" data-status={event.status} data-type={event.type} data-event-id={event.id}>
    <span className="strip-stream-rail" aria-hidden="true"><Icon name={ICON_NAME[event.type]||'file'}/></span>
    <div className="strip-stream-step-main">
      <button type="button" className="strip-stream-step-heading" onClick={toggle} aria-expanded={hasDetail?opened:undefined} aria-controls={hasDetail?id:undefined} disabled={!hasDetail}>
        <span className="strip-stream-step-label"><strong>{event.title}</strong>{event.path && <code title={event.path}>{event.path}</code>}{(event.add!==undefined || event.del!==undefined) && <span className="strip-stream-change">{event.add!==undefined && <span>+{event.add}</span>}{event.del!==undefined && <span>-{event.del}</span>}</span>}</span>
        <span className="strip-stream-step-end"><small>{STATE_LABEL[event.status]||event.status}</small>{hasDetail && <ControlIcon name="down" size={14} className={opened?'is-open':''}/>}</span>
      </button>
      {event.subtitle && !['已完成','执行失败','等待执行','执行中','已停止或状态未知'].includes(event.subtitle) && <p className="strip-stream-step-hint">{event.subtitle}</p>}
      {hasDetail && opened && <div className="strip-stream-step-content" id={id}>{children || <Detail event={event} onError={onError}/>}</div>}
    </div>
  </article>;
}

type Props={
  snapshot:Snapshot|null;busy:boolean;deciding:string;loading:boolean;
  onDecide:Decide;onApproveAll?:(ids:string[])=>Promise<void>;
  onAnswer:(formId:string,answer:Record<string,unknown>)=>Promise<void>;
  onError:(message:string)=>void;renderMessage:(message:Message)=>ReactNode;
  onPause?:()=>Promise<unknown>;onResume?:()=>Promise<unknown>;onCancelTask?:(id:string)=>Promise<unknown>;onParallel?:()=>Promise<unknown>;
};

/** One shared scroll surface for chat, tool calls, diffs, pending approvals and forms. */
export function UnifiedConversationStream({snapshot,busy,deciding,loading,onDecide,onApproveAll,onAnswer,onError,renderMessage,onPause,onResume,onCancelTask,onParallel}:Props){
  const activity=useMemo(()=>linearActivity(snapshot),[snapshot]);
  const conversationTurns=useMemo(()=>{
    type ConversationTurn={id:string;user:Snapshot['messages'][number]|null;assistants:Snapshot['messages'][number][];events:ActivityEvent[]};
    const turns:ConversationTurn[]=[];
    let current:ConversationTurn={id:'initial',user:null,assistants:[],events:[]};
    const flush=()=>{if(current.user||current.assistants.length||current.events.length)turns.push(current);};
    for(const turn of activity.turns){
      if(turn.message.type==='user'){
        flush();
        current={id:turn.message.id,user:turn.message,assistants:[],events:[]};
      }else{
        current.assistants.push(turn.message);
        current.events.push(...turn.events);
      }
    }
    flush();
    return turns;
  },[activity]);
  const [opened,setOpened]=useState<Record<string,boolean>>({});
  const [filter,setFilter]=useState<Filter>('all');
  const [groupOpen,setGroupOpen]=useState<boolean|null>(null);
  const renderedTurns=useMemo(()=>conversationTurns.map(turn=>{
    const visible=turn.events.filter(event=>event.type!=='approval'&&inFilter(event,filter));
    return {turn,streamEvents:visible};
  }),[conversationTurns,filter]);
  const allEvents=[...activity.turns.flatMap(turn=>turn.events),...activity.tail];
  const activeEvents=allEvents.filter(event=>event.type!=='approval');
  const status=snapshot?.queuePaused ? 'paused' : activityStatus(snapshot,busy);
  const hasActions=Boolean(allEvents.length || busy || snapshot?.forms.length || snapshot?.tasks?.length);
  function isOpen(event:ActivityEvent){return opened[event.id] ?? (groupOpen===null?Boolean(event.defaultOpen):groupOpen);}
  function toggle(event:ActivityEvent){setOpened(previous=>({...previous,[event.id]:!isOpen(event)}));}
  function setAll(value:boolean){setGroupOpen(value);setOpened(Object.fromEntries(allEvents.filter(event=>event.detail).map(event=>[event.id,value])));}
  function show(events:ActivityEvent[]){return events.filter(event=>event.type!=='approval' && inFilter(event,filter));}
  const queue=!!snapshot?.permissions.length;
  const showQueue=queue;
  const remainder=show(activity.tail);
  const rootRef=useRef<HTMLDivElement>(null),scrollHost=useRef<HTMLElement|null>(null);
  const followTail=useRef(true);
  const [showJump,setShowJump]=useState(false);
  useEffect(()=>{
    const node=rootRef.current;let parent=node?.parentElement || null;
    while(parent && parent!==document.body){
      const overflow=window.getComputedStyle(parent).overflowY;
      if(overflow==='auto'||overflow==='scroll')break;
      parent=parent.parentElement;
    }
    const host=parent && parent!==document.body?parent:(document.scrollingElement as HTMLElement|null);
    scrollHost.current=host;
    const check=()=>{
      if(!host)return;
      const away=host.scrollHeight-host.scrollTop-host.clientHeight>130;
      followTail.current=!away;setShowJump(away);
    };
    host?.addEventListener('scroll',check,{passive:true});check();
    return ()=>{host?.removeEventListener('scroll',check);scrollHost.current=null;};
  },[]);
  useEffect(()=>{
    if(!followTail.current)return;
    const frame=requestAnimationFrame(()=>{const host=scrollHost.current;if(host)host.scrollTop=host.scrollHeight;});
    return ()=>cancelAnimationFrame(frame);
  },[snapshot?.messages,snapshot?.tasks,busy]);
  function jumpToBottom(){followTail.current=true;setShowJump(false);const host=scrollHost.current;
    if(host){const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;host.scrollTo({top:host.scrollHeight,behavior:reduce?'auto':'smooth'});}
  }
  return <div ref={rootRef} className="strip-stream-root">
    <TaskQueuePanel snapshot={snapshot} onPause={onPause} onResume={onResume} onCancel={onCancelTask} onParallel={onParallel}/>
    {hasActions && <div className="strip-stream-toolbar" aria-label="执行记录控制栏">
      <div className="strip-stream-toolbar-heading"><Icon name="checklist-minimalistic"/><strong>执行记录</strong><span className="strip-stream-state" data-status={status}>{status==='paused'?'已暂停':status==='idle'?'本轮已结束':status==='pending'?'等待审批':status==='error'?'执行异常':'执行中'}</span><span className="strip-stream-count">{activeEvents.length} 步</span></div>
      <div className="strip-stream-toolbar-actions"><button type="button" onClick={()=>setAll(true)} disabled={!activeEvents.length}>展开全部</button><button type="button" onClick={()=>setAll(false)} disabled={!activeEvents.length}>收起全部</button></div>
    </div>}
    {hasActions && <div className="strip-stream-filters" role="group" aria-label="筛选执行步骤">{FILTERS.map(item=><button key={item.id} type="button" className={filter===item.id?'is-selected':''} aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.name}</button>)}</div>}
    {loading && <p className="strip-muted" role="status">正在读取会话…</p>}
    {renderedTurns.map(({turn,streamEvents})=><Fragment key={turn.id}>
      {turn.user && renderMessage(turn.user)}
      {!!streamEvents.length && <section className="strip-stream-activity" aria-label="执行步骤">
        <ol className="strip-stream-linear" aria-label="按时间排列的执行步骤">{streamEvents.map(event=><li key={event.id}>
          <Step event={event} opened={isOpen(event)||event.status==='running'} toggle={()=>toggle(event)} onError={onError}/>
        </li>)}</ol>
      </section>}
      {turn.assistants.map(renderMessage)}
    </Fragment>)}
    {!!remainder.length && <section className="strip-stream-aggregate" aria-label="会话汇总与文件修改"><p className="strip-stream-subheading">会话文件变更与附加记录</p><div className="strip-stream-steps">{remainder.map(event=><Step key={event.id} event={event} opened={isOpen(event)} toggle={()=>toggle(event)} onError={onError}/>)}</div></section>}
    {showQueue && snapshot && <section className="strip-stream-approval-inline" aria-label="待审批操作"><div className="strip-stream-steps"><Step event={{id:'approval-queue',type:'approval',title:`等待批准 · ${snapshot.permissions.length} 项操作`,status:'pending'}} opened toggle={()=>undefined} onError={onError}><ApprovalPanel snapshot={snapshot} deciding={deciding} onDecide={onDecide} onApproveAll={onApproveAll}/></Step></div></section>}
    {snapshot?.forms.map(form=><section key={form.id} className="strip-stream-form" aria-label="等待答复的问题"><span className="strip-stream-form-marker" aria-hidden="true"><Icon name="circle-help"/></span><div className="strip-unified-approval"><QuestionForm form={form} onAnswer={answer=>onAnswer(form.id,answer)}/></div></section>)}
    {showJump && <button type="button" className="strip-stream-jump-bottom" aria-label="一键滚动到会话底部" onClick={jumpToBottom}><Icon name="arrow-down"/>到底部</button>}
  </div>;
}
