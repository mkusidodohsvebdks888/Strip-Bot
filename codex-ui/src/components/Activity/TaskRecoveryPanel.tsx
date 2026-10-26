import {useState} from 'react';
import type {QueueTask} from '../AgentPanel';
import {SnapshotManager} from './SnapshotManager';
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
  const [selectedFiles,setSelectedFiles]=useState<string[]>([]);
  const [audit,setAudit]=useState<{at:string;filePath:string;outcome:string;reason?:string}[]>([]);
  const finished=tasks.filter(t=>['done','failed','cancelled'].includes(t.status));
  if(!/^ses_[a-zA-Z0-9]+$/.test(sessionID)||!finished.length)return null;
  async function inspect(id:string){
    setBusy(true);setSelected(id);setDiff(null);setSelectedFiles([]);
    void request<{items:typeof audit}>('/sessions/'+sessionID+'/tasks/'+id+'/restore-audit').then(value=>setAudit(value.items)).catch(()=>setAudit([]));
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
  async function reviewTask(taskID:string,verified:boolean){
    const note=window.prompt(verified?'填写验证说明（可留空）':'填写未通过原因（可留空）','');
    if(note===null)return;
    setBusy(true);
    try{
      await request('/sessions/'+sessionID+'/tasks/'+taskID+'/review',{verified,note});
      onError(verified?'已标记人工验证通过。':'已标记需要进一步处理。');
    }catch(error){onError(error instanceof Error?error.message:String(error));}
    finally{setBusy(false);}
  }
  async function restoreSelected(){
    if(!diff||busy||!selectedFiles.length)return;
    const files=diff.changes.filter(change=>selectedFiles.includes(change.path)).map(change=>({filePath:change.path,expectedHash:change.afterHash}));
    if(!window.confirm('确定批量恢复 '+files.length+' 个文件？此操作逐文件执行，部分文件可能因冲突失败。'))return;
    setBusy(true);
    try{
      const result=await request<{restored:number;failed:number}>('/sessions/'+sessionID+'/tasks/'+diff.taskID+'/restore-batch',{files,confirmed:true});
      onError('批量恢复完成：成功 '+result.restored+'，失败 '+result.failed+'。');
      setDiff(await request<Diff>('/sessions/'+sessionID+'/tasks/'+diff.taskID+'/diff'));
      setSelectedFiles([]);
      const history=await request<{items:typeof audit}>('/sessions/'+sessionID+'/tasks/'+diff.taskID+'/restore-audit');setAudit(history.items);
    }catch(error){onError(error instanceof Error?error.message:String(error));}
    finally{setBusy(false);}
  }
  return <section className="strip-task-recovery" aria-label="任务文件修改与恢复">
    <div className="strip-task-recovery__title"><strong>任务文件记录</strong><span>只显示快照中已有的文件</span></div>
    <div className="strip-task-recovery__tasks">{finished.slice(-8).reverse().map(task=><button type="button" key={task.id} disabled={busy} aria-pressed={selected===task.id} onClick={()=>void inspect(task.id)}>{task.preview.slice(0,36)||'任务'} · 查看修改</button>)}</div>
    {busy&&<p role="status">正在处理…</p>}
    {diff&&<div className="strip-task-recovery__changes"><p>已检查 {diff.checked} 个快照文件；发现 {diff.changes.length} 项变化。</p>
      {!diff.changes.length&&<p>快照文件没有变化，或其他新增文件不在快照范围内。</p>}
      <div className="strip-task-recovery__bulk"><button type="button" disabled={busy} onClick={()=>void reviewTask(diff.taskID,true)}>标记验证通过</button><button type="button" disabled={busy} onClick={()=>void reviewTask(diff.taskID,false)}>需要进一步处理</button></div>
      <div className="strip-task-recovery__bulk"><span>已选 {selectedFiles.length} 项</span><button type="button" disabled={busy||!selectedFiles.length} onClick={()=>void restoreSelected()}>恢复所选文件</button></div>
      {diff.changes.map(change=><div className="strip-task-recovery__file" key={change.path}><input type="checkbox" aria-label={'选择恢复 '+change.path} checked={selectedFiles.includes(change.path)} disabled={busy||change.beforeHash===null||!['modified','deleted'].includes(change.status)} onChange={event=>setSelectedFiles(previous=>event.target.checked?[...previous,change.path]:previous.filter(name=>name!==change.path))}/><code title={change.path}>{change.path}</code><span>{change.status}</span><button type="button" disabled={busy||change.beforeHash===null||!['modified','deleted'].includes(change.status)} onClick={()=>void restore(change)}>恢复文件</button></div>)}
    </div>}
    {!!audit.length&&<details className="strip-task-recovery__audit"><summary>恢复操作记录（{audit.length}）</summary>{audit.slice(0,15).map((entry,index)=><p key={index}><time>{entry.at}</time> · {entry.outcome} · <code>{entry.filePath}</code>{entry.reason?' · '+entry.reason:''}</p>)}</details>}
    <SnapshotManager sessionID={sessionID} tasks={tasks} onError={onError}/>
  </section>;
}
