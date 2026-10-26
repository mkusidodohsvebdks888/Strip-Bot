import type {ReactNode} from 'react';
import type {ActivityEvent} from './activity-events';
import {Icon} from '../../Icons';
import {ControlIcon} from '../ControlIcon';

/** Failed shell tool calls may use type=error while retaining a command detail. */
export function isCommandEvent(event:ActivityEvent):boolean {
  return event.type==='command' || event.detail?.kind==='command';
}

export type TimelineRow=
  |{kind:'event';key:string;event:ActivityEvent}
  |{kind:'command-batch';key:string;events:ActivityEvent[]};

/** Only fold consecutive shell calls. Never reorder, remove or rewrite event data. */
export function groupTimeline(events:ActivityEvent[]):TimelineRow[] {
  const result:TimelineRow[]=[];
  for(let index=0;index<events.length;){
    const first=events[index];
    if(!isCommandEvent(first)){
      result.push({kind:'event',key:first.id,event:first});
      index++;
      continue;
    }
    const batch:ActivityEvent[]=[first];
    index++;
    while(index<events.length&&isCommandEvent(events[index]))batch.push(events[index++]);
    if(batch.length>1)result.push({kind:'command-batch',key:'command-batch:'+first.id,events:batch});
    else result.push({kind:'event',key:first.id,event:first});
  }
  return result;
}

/** Presentation-only disclosure: all individual command text and output live in children. */
export function CommandBatch({events,opened,toggle,children}:{
  events:ActivityEvent[];opened:boolean;toggle:()=>void;children:ReactNode;
}){
  const failures=events.filter(event=>event.status==='error').length;
  const isRunning=events.some(event=>event.status==='running');
  const isPending=events.some(event=>event.status==='pending');
  const status=failures?'error':isRunning?'running':isPending?'pending':'success';
  const statusLabel=failures?`${failures} 条失败`:isRunning?'执行中':isPending?'等待执行':'';
  return <div className="strip-stream-command-batch" data-status={status}>
    <span className="strip-stream-command-batch__rail" aria-hidden="true"><Icon name="terminal-soft"/></span>
    <div className="strip-stream-command-batch__main">
      <button type="button" className="strip-stream-command-batch__button" aria-expanded={opened}
        aria-label={`运行了 ${events.length} 条命令${statusLabel?'，'+statusLabel:''}，${opened?'收起':'展开'}详情`}
        onClick={toggle}>
        <span className="strip-stream-command-batch__title">运行了 {events.length} 条命令</span>
        <span className="strip-stream-command-batch__end">
          {statusLabel&&<small>{statusLabel}</small>}
          <ControlIcon name="down" size={14} className={opened?'is-open':''}/>
        </span>
      </button>
      {opened&&<div className="strip-stream-command-batch__events" aria-label="完整命令执行记录">
        {children}
      </div>}
    </div>
  </div>;
}
