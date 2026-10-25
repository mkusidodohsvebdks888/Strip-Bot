import {useState} from 'react';
import type {QueueTask,Snapshot} from '../AgentPanel';
import {Icon} from '../../Icons';
import './task-queue-panel.css';

const LABEL:Record<QueueTask['status'],string>={queued:'排队中',running:'执行中',paused:'已暂停',done:'完成',failed:'失败',cancelled:'已取消'};
type Props={
  snapshot:Snapshot|null;
  onPause?:()=>Promise<unknown>;
  onResume?:()=>Promise<unknown>;
  onCancel?:(taskId:string)=>Promise<unknown>;
  onParallel?:()=>Promise<unknown>;
};
export function TaskQueuePanel({snapshot,onPause,onResume,onCancel,onParallel}:Props){
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const tasks=snapshot?.tasks || [];
  const pending=tasks.filter(item=>['running','queued','paused'].includes(item.status));
  const recent=tasks.filter(item=>['failed','cancelled'].includes(item.status)).slice(-2);
  const shown=[...pending,...recent];
  const paused=!!snapshot?.queuePaused;
  async function run(name:string,callback?:()=>Promise<unknown>){
    if(!callback||busy)return;
    setBusy(name);setError('');
    try{await callback();}catch(reason){setError(reason instanceof Error?reason.message:'操作失败，请重试');}
    finally{setBusy('');}
  }
  if(!snapshot || (!shown.length && !onParallel))return null;
  return <section className="strip-task-queue" aria-label="任务队列">
    <div className="strip-task-queue__header">
      <div className="strip-task-queue__title"><Icon name="checklist-minimalistic"/><strong>任务队列</strong>
        <span className="strip-task-queue__count">{pending.filter(x=>x.status==='running').length} 执行 · {pending.filter(x=>x.status==='queued').length} 等待</span>
        {typeof snapshot.parallelRunning==='number' && <span className="strip-task-queue__count">全局 {snapshot.parallelRunning}/{snapshot.maxParallel||3} 并行</span>}
      </div>
      <div className="strip-task-queue__actions">
        {paused ? <button type="button" disabled={!!busy||!onResume} onClick={()=>void run('resume',onResume)}><Icon name="play"/>继续队列</button>
          : <button type="button" disabled={!!busy||!onPause||!pending.length} onClick={()=>void run('pause',onPause)}><Icon name="pause"/>暂停</button>}
        {onParallel && <button type="button" disabled={!!busy} title="创建独立会话；只有不同工作区才能同时写入" onClick={()=>void run('parallel',onParallel)}><Icon name="git-branch"/>并行新任务</button>}
      </div>
    </div>
    {paused && <p className="strip-task-queue__hint" role="status">队列已暂停。正在运行的轮次已请求中断；继续时会检查文件状态，再开启新轮次，不是冻结进程。</p>}
    {!!shown.length && <ol className="strip-task-queue__list">{shown.map(task=><li key={task.id} data-status={task.status}>
      <span className="strip-task-queue__bullet" aria-hidden="true"/>
      <span className="strip-task-queue__description" title={task.preview}>{task.preview}</span>
      <small>{LABEL[task.status]}</small>
      {onCancel && ['queued','paused','running'].includes(task.status) && <button type="button" aria-label={'取消任务：'+task.preview} disabled={!!busy} onClick={()=>void run(task.id,()=>onCancel(task.id))}><Icon name="x"/>取消</button>}
    </li>)}</ol>}
    {error && <p role="alert" className="strip-task-queue__error">{error}</p>}
  </section>;
}
