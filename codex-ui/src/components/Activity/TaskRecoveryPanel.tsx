import {useState} from 'react';
import type {QueueTask} from '../AgentPanel';
import './task-recovery.css';

type Change={path:string;status:string;beforeHash:string|null;afterHash:string|null};
type Diff={taskID:string;checked:number;changes:Change[];limitedToSnapshotFiles:boolean};
type Props={sessionID:string;tasks:QueueTask[];onError:(message:string)=>void};
async function request<T>(route:string,body?:unknown):Promise<T>{
  const response=await fetch('/api/agent'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'操作失败');
  return result;
}
export function TaskRecoveryPanel({sessionID,tasks,onError}:Props){
  const [selected,setSelected]=useState('');
  const [diff,setDiff]=useState<Diff|null>(null);
  const [busy,setBusy]=useState(false);
  const finished=tasks.filter(t=>['done','failed','cancelled'].includes(t.status));
  if(!/^ses_[a-zA-Z0-9]+$/.test(sessionID)||!finished.length)return null;
  async function inspect(id:string){
    setBusy(true);setSelected(id);setDiff(null);
    try{setDiff(await request<Diff>('/sessions/'+sessionID+'/tasks/'+id+'/diff'));}
    catch(error){onError(error instanceof Error?error.message:String(error));}
    finally{setBusy(false);}
  }
  async function restore(change:Change){
    if(!diff||busy)return;
    if(change.beforeHash===null){onError('为避免误删文件，暂不支持恢复原本不存在的文件。');return;}
    if(!window.confirm('确定恢复文件 '+change.path+' 到任务开始前的内容吗？请确保没有其他任务正在修改该文件。'))return;
    setBusy(true);
    try{
      await request('/sessions/'+sessionID+'/tasks/'+diff.taskID+'/restore',{filePath:change.path,expectedHash:change.afterHash,confirmed:true});
      await inspect(diff.taskID);
    }catch(error){onError(error instanceof Error?error.message:String(error));}
    finally{setBusy(false);}
  }
  return <section className="strip-task-recovery" aria-label="任务文件修改与恢复">
    <div className="strip-task-recovery__title"><strong>任务文件记录</strong><span>只显示快照中已有的文件</span></div>
    <div className="strip-task-recovery__tasks">{finished.slice(-8).reverse().map(task=><button type="button" key={task.id} disabled={busy} aria-pressed={selected===task.id} onClick={()=>void inspect(task.id)}>{task.preview.slice(0,36)||'任务'} · 查看修改</button>)}</div>
    {busy&&<p role="status">正在处理…</p>}
    {diff&&<div className="strip-task-recovery__changes"><p>已检查 {diff.checked} 个快照文件；发现 {diff.changes.length} 项变化。</p>
      {!diff.changes.length&&<p>快照文件没有变化，或其他新增文件不在快照范围内。</p>}
      {diff.changes.map(change=><div className="strip-task-recovery__file" key={change.path}><code title={change.path}>{change.path}</code><span>{change.status}</span><button type="button" disabled={busy||change.beforeHash===null||!['modified','deleted'].includes(change.status)} onClick={()=>void restore(change)}>恢复文件</button></div>)}
    </div>}
  </section>;
}
