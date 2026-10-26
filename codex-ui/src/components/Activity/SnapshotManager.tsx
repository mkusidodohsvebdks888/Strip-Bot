import {useState} from 'react';
import './snapshot-manager.css';

type Item={taskID:string;bytes:number;createdAt:number};
type Inventory={items:Item[];totalBytes:number;limited?:boolean};
type Props={sessionID:string;tasks:{id:string;status:string}[];onError:(message:string)=>void};
const size=(n:number)=>n>=1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(1)+' KB';
async function api<T>(route:string,body?:unknown):Promise<T>{
  const response=await fetch('/api/agent'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const value=await response.json();
  if(!response.ok)throw new Error(value.error||'请求失败');
  return value;
}
export function SnapshotManager({sessionID,tasks,onError}:Props){
  const [open,setOpen]=useState(false);
  const [inventory,setInventory]=useState<Inventory|null>(null);
  const [busy,setBusy]=useState(false);
  const own=new Map(tasks.map(task=>[task.id,task]));
  async function refresh(){
    setBusy(true);
    try{setInventory(await api<Inventory>('/snapshots'));}
    catch(error){onError(error instanceof Error?error.message:String(error));}
    finally{setBusy(false);}
  }
  async function remove(taskID:string){
    if(!window.confirm('确定永久删除此任务的文件快照吗？删除后无法使用该快照恢复文件。'))return;
    setBusy(true);
    try{
      await api('/sessions/'+sessionID+'/tasks/'+taskID+'/snapshot/delete',{confirmed:true});
      setInventory(await api<Inventory>('/snapshots'));
    }catch(error){onError(error instanceof Error?error.message:String(error));}
    finally{setBusy(false);}
  }
  return <section className="strip-snapshot-manager" aria-label="快照管理">
    <div className="strip-snapshot-manager__heading"><strong>历史快照</strong><button type="button" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void refresh();}}>{open?'收起':'管理快照'}</button></div>
    {open&&<div><div className="strip-snapshot-manager__summary"><span>{inventory?inventory.items.length+' 项 · '+size(inventory.totalBytes):'读取中'}</span><button type="button" disabled={busy} onClick={()=>void refresh()}>刷新</button></div>
      {inventory?.limited&&<p>快照较多，仅显示部分记录。</p>}
      {inventory?.items.filter(item=>own.has(item.taskID)).map(item=><div className="strip-snapshot-manager__row" key={item.taskID}><code>{item.taskID.slice(-10)}</code><span>{size(item.bytes)}</span><time>{new Date(item.createdAt).toLocaleString()}</time><button type="button" disabled={busy||!['done','failed','cancelled'].includes(own.get(item.taskID)?.status||'')} onClick={()=>void remove(item.taskID)}>删除</button></div>)}
      {inventory&&!inventory.items.some(item=>own.has(item.taskID))&&<p>当前会话没有可管理的快照。</p>}
      <p className="strip-snapshot-manager__note">仅能删除当前会话已结束任务的快照；其他会话的快照不会显示在此列表。</p>
    </div>}
  </section>;
}
