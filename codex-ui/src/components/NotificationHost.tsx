import {useState} from 'react';
import {Icon} from '../Icons';
import type {ReactNode} from 'react';
import './notifications.css';
import {localizeStatusMessage} from './status-message.mjs';
import {presentIssue} from './issue-presentation.mjs';

export type Notification = {id:string; title:string; message:string; detail?:string; action?:ReactNode};

/** Closing a notification hides that occurrence, including repeated status polls. */
export function NotificationHost({items,scope}:{items:Notification[];scope:string}) {
  const [dismissed,setDismissed] = useState<Set<string>>(()=>new Set());
  const unique = [...new Map(items.filter(item=>item.message).map(item=>[item.message,item])).values()];
  const key=(item:Notification)=>JSON.stringify([scope,item.id,item.message,item.detail]);
  // Keep dismissals even when polling temporarily removes the occurrence.
  const visible = unique.filter(item=>!dismissed.has(key(item))).slice(0,1);
  return <div role="complementary" className="strip-notifications" aria-label="消息提示" aria-live="polite" aria-relevant="additions">
    {visible.map(item=><section className="strip-notification" key={item.id} aria-label={item.title}>
      <div className="strip-notification-heading"><strong>{item.title}</strong><button type="button" className="strip-notification-close" aria-label={'关闭提示：'+item.title} onClick={()=>setDismissed(previous=>new Set(previous).add(key(item)))}><Icon name="x"/></button></div>
      <p>{localizeStatusMessage(item.message)}</p>
      {item.detail && <details><summary>技术详情</summary><pre>{item.detail}</pre></details>}
      {item.action && <div className="strip-notification-actions">{item.action}</div>}
    </section>)}
  </div>;
}

export function errorNotification(id:string,value:unknown):Notification {
  const issue=presentIssue(value);
  return {id,title:issue.title,message:issue.summary,detail:issue.detail};
}
