import {useEffect,useRef,useState} from 'react';
import type {Snapshot,Permission,ApprovalDecision,ApprovalConfirmation} from '../AgentPanel';
import './approval-panel.css';
import {ControlIcon} from '../ControlIcon';
import {ApprovalConfirm} from './SessionApproval';

export type Decide=(id:string,decision:ApprovalDecision,confirmation?:ApprovalConfirmation)=>Promise<void>;
export function ApprovalPanel({snapshot,deciding,onDecide,onApproveAll}:{snapshot:Snapshot;deciding:string;onDecide:Decide;onApproveAll?:(ids:string[])=>Promise<void>}){
  const [selected,setSelected]=useState('');
  const [batch,setBatch]=useState<Permission[]|null>(null);
  const requests=snapshot.permissions;
  const index=Math.max(0,requests.findIndex(p=>p.id===selected)),permission=requests[index];
  if(!permission)return null;
  return <section className="strip-approval" aria-label="工具操作批准">
    <header><strong>工具操作需要批准</strong><nav aria-label="待审批请求切换">
      <button aria-label="上一项审批" disabled={!!deciding || index===0} onClick={()=>setSelected(requests[index-1].id)}><ControlIcon name="left"/></button>
      <span role="status">{index+1} / {requests.length}</span>
      <button aria-label="下一项审批" disabled={!!deciding || index===requests.length-1} onClick={()=>setSelected(requests[index+1].id)}><ControlIcon name="right"/></button>
    </nav></header>
    {onApproveAll && <div className="strip-batch-approval"><button disabled={!!deciding} onClick={()=>setBatch([...requests])}>允许全部待审批（{requests.length}）</button><small>仅批准当前队列，不授权后续操作</small></div>}
    {batch && onApproveAll && <ApprovalConfirm title="批准全部待审批操作？" label="确认，批准当前队列" onCancel={()=>setBatch(null)} onConfirm={()=>onApproveAll(batch.map(p=>p.id))}>
      <p>项目目录：{snapshot.workspace}</p><p>将逐条批准以下请求，可能执行终端命令或修改文件。</p><pre>{batch.map(p=>p.action+' · '+p.resources.join(', ')+'\n'+JSON.stringify(p.metadata || {})).join('\n\n')}</pre><p>后续新增的工具请求仍需批准。</p>
    </ApprovalConfirm>}
    <ApprovalRequest key={JSON.stringify([permission.id,permission.action,permission.save])} permission={permission} snapshot={snapshot} deciding={deciding} onDecide={onDecide}/>
  </section>;
}
function ApprovalRequest({permission:p,snapshot,deciding,onDecide}:{permission:Permission;snapshot:Snapshot;deciding:string;onDecide:Decide}){
  const [error,setError]=useState(''),[confirm,setConfirm]=useState(false),[submitting,setSubmitting]=useState(false);
  const lock=useRef(false),dialog=useRef<HTMLDialogElement>(null),alwaysButton=useRef<HTMLButtonElement>(null);
  const save=Array.isArray(p.save)?p.save:[];
  const canSave=save.length>0 && save.every(rule=>typeof rule==='string' && !!rule.trim());
  const disabled=!!deciding || submitting;
  const source=snapshot.messages.find(message=>message.id===p.source?.messageID)?.content?.find(tool=>tool.id===p.source?.id);
  const metadata=p.metadata && typeof p.metadata==='object'?p.metadata as Record<string,unknown>:{};
  const input=source?.state?.input && typeof source.state.input==='object'?source.state.input as Record<string,unknown>:{};
  const command=typeof input.command==='string'?input.command:typeof metadata.command==='string'?metadata.command:'';
  useEffect(()=>{if(confirm)dialog.current?.showModal();},[confirm]);
  function close(){if(lock.current)return;dialog.current?.close();setConfirm(false);alwaysButton.current?.focus();}
  async function decide(decision:ApprovalDecision){
    if(lock.current || disabled)return;
    lock.current=true;setSubmitting(true);setError('');
    try{await onDecide(p.id,decision,decision==='always'?{confirmed:true,confirmedAction:p.action,confirmedRules:save}:undefined);dialog.current?.close();setConfirm(false);}
    catch(e){setError(e instanceof Error?e.message:'审批失败，请重试。');}
    finally{lock.current=false;setSubmitting(false);}
  }
  return <>
    <p>Strip Bot 请求{({shell:'执行终端命令',read:'读取文件',edit:'修改文件',external_directory:'访问外部目录'} as Record<string,string>)[p.action] || '调用工具：'+p.action}</p>
    {command && <pre aria-label="待执行命令">{command}</pre>}
    {!!p.resources.length && <pre aria-label="操作资源">{p.resources.join('\n')}</pre>}
    <p className="strip-approval-muted">项目目录：{snapshot.workspace}</p>
    {p.message && <p>{p.message}</p>}
    <details><summary>查看操作详情</summary><pre>{JSON.stringify({action:p.action,resources:p.resources,input:source?.state?.input,metadata:p.metadata,save:p.save},null,2)}</pre></details>
    <div className="strip-approval-actions">
      <button className="strip-approval-primary" disabled={disabled} onClick={()=>void decide('once')}>允许本次</button>
      <button ref={alwaysButton} disabled={disabled || !canSave} title={canSave?'查看并确认项目授权规则':'引擎未提供可保存规则'} onClick={()=>{setError('');setConfirm(true);}}>始终允许同类操作</button>
      <button disabled={disabled} onClick={()=>void decide('reject')}>拒绝</button>
    </div>
    {!canSave && <small className="strip-approval-muted">引擎未提供可保存规则，仅可批准本次。</small>}
    <small className="strip-approval-muted">拒绝可能同时取消当前会话的其他待审批操作，由 OpenCode 处理。</small>
    {submitting && <p role="status">正在提交审批…</p>}
    {error && !confirm && <p role="alert" className="strip-approval-error">{error}</p>}
    {confirm && <dialog ref={dialog} className="strip-approval-dialog" aria-labelledby="strip-approval-confirm-title" onCancel={event=>{event.preventDefault();close();}}>
      <h3 id="strip-approval-confirm-title">确认项目长期授权</h3>
      <p>OpenCode 将在当前项目保存以下规则，后续会话也可能自动批准匹配操作，并可能放行其他已匹配的待审批请求。</p>
      <p>项目：{snapshot.workspace}</p><p>操作：{p.action}</p><pre>{save.join('\n')}</pre>
      <p>这些规则由引擎提供，请核对通配符的匹配范围。</p>
      {error && <p role="alert" className="strip-approval-error">{error}</p>}
      <div className="strip-approval-actions"><button autoFocus disabled={disabled} onClick={close}>取消</button><button className="strip-approval-primary" disabled={disabled} onClick={()=>void decide('always')}>{submitting?'正在提交…':'确认并始终允许'}</button></div>
    </dialog>}
  </>;
}
