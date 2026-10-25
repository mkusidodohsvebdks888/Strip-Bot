import {createElement,useEffect,useMemo,useRef,useState} from 'react';
import type {Snapshot} from '../AgentPanel';
import type {AppTheme} from '../../state/useAppTheme';
import {ControlIcon} from '../ControlIcon';
import {ApprovalPanel,type Decide} from './ApprovalPanel';
import {activityEvents,activityStatus} from './activity-events';
import './vendor/strip-activity-feed.js';
import './vendor/strip-activity-feed.css';
import './activity-integration.css';

type Feed=HTMLElement & {setEvents:(events:ReturnType<typeof activityEvents>)=>void;setStatus:(status:string)=>void;setModelMetrics:(metrics:null)=>void};
export function ActivityFeed({theme,snapshot,busy,deciding,onDecide,onError,onApproveAll,showApprovals=true}:{theme:AppTheme;snapshot:Snapshot|null;busy:boolean;deciding:string;onDecide:Decide;onError:(message:string)=>void;onApproveAll?:(ids:string[])=>Promise<void>;showApprovals?:boolean}){
  const host=useRef<Feed|null>(null),last=useRef('');
  const body=useRef<HTMLDivElement>(null);
  const [expanded,setExpanded]=useState(true);
  const events=useMemo(()=>activityEvents(snapshot),[snapshot]),state=activityStatus(snapshot,busy);
  const pending=snapshot?.permissions.map(permission=>permission.id).join('|') || '';
  useEffect(()=>{if(pending)setExpanded(true);},[pending]);
  const statusText=({running:'执行中',pending:'等待确认',error:'执行异常',idle:'本轮已结束'} as Record<string,string>)[state];
  const latest=events[events.length-1];
  const handlers=useRef({onError});handlers.current={onError};
  useEffect(()=>{
    const element=host.current;if(!element)return;
    const copyError=()=>handlers.current.onError('复制失败，请展开详情后手动选择文本。');
    element.addEventListener('strip:copy-error',copyError);
    return()=>{element.removeEventListener('strip:copy-error',copyError);};
  },[theme]);
  useEffect(()=>{
    if(!host.current)return;
    const scroller=body.current;
    const follow=!!scroller && scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<100;
    host.current.setModelMetrics(null);
    const signature=JSON.stringify({events,state,theme});
    if(signature!==last.current){host.current.setEvents(events.filter(event=>event.type!=='approval'));host.current.setStatus(state);last.current=signature;}
    if(scroller && pending)scroller.querySelector('.strip-approval')?.scrollIntoView({block:'nearest'});
    else if(scroller && follow)scroller.scrollTop=scroller.scrollHeight;
  },[events,state,deciding,pending,expanded,theme]);
  return <section className="strip-live-activity" hidden={!events.length && !busy} aria-label="任务活动记录">
    <button className="strip-activity-toggle" aria-expanded={expanded} aria-controls="strip-activity-body" onClick={()=>setExpanded(value=>!value)}>
      <strong>任务活动</strong><span className="strip-activity-current" role="status" aria-live="polite">{statusText}{latest?' · '+latest.title:busy?' · 正在等待模型回复…':''}</span><span className="strip-activity-toggle-end">{expanded?'收起':'展开'} {events.length>0 && '· '+events.length}<ControlIcon name="down" className={expanded?'is-open':''}/></span>
    </button>
    <div id="strip-activity-body" className="strip-activity-scroll" ref={body} hidden={!expanded}>{showApprovals && snapshot && <ApprovalPanel snapshot={snapshot} deciding={deciding} onDecide={onDecide} onApproveAll={onApproveAll}/>}{createElement('strip-activity-feed',{ref:host,title:'任务活动','data-theme':theme,key:theme})}{busy && !events.length && <p className="strip-muted" role="status">正在等待模型回复…</p>}</div>
  </section>;
}
