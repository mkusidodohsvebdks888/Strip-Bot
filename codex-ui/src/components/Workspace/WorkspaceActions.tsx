import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {Snapshot} from '../AgentPanel';
import {Icon} from '../../Icons';
import './workspace-actions.css';

/** Commands run against the session workspace, not in a sandbox. */
export type CommandResult={command:string;cwd:string;stdout:string;stderr:string;exitCode:number|null;timedOut:boolean;truncated:boolean;durationMs:number;error?:string};
export type CommandRecord=CommandResult & {id:string;running?:boolean};
type CommandDisplay={id:string;command:string;stdout:string;stderr:string;error?:string|null;exitCode:number|null;timedOut:boolean;truncated:boolean;durationMs:number;status?:'running'|'done'|'exit'|'timeout'|'failed';running?:boolean;cwd?:string};
type Change={path:string;patch:string;additions?:number;deletions?:number};
const asChange=(value:unknown):Change|null=>{
  if(!value || typeof value!=='object')return null;
  const item=value as Record<string,unknown>,name=item.path || item.file || item.filePath;
  if(typeof name!=='string'||!name)return null;
  return {path:name,patch:typeof item.patch==='string'?item.patch:typeof item.diff==='string'?item.diff:'',additions:typeof item.additions==='number'?item.additions:undefined,deletions:typeof item.deletions==='number'?item.deletions:undefined};
};
function saveText(name:string,body:string,type='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([body],{type}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),2500);
}
async function copy(value:string){await navigator.clipboard.writeText(value);}
const validSession=(session:string)=>/^ses_[a-zA-Z0-9]+$/.test(session);

/** Small on-demand composer popover; never occupies the empty chat page. */
export function CommandPalette({open,session,workspace,executing,agentRunning,disabledReason,results,onClose,onRun,onError}:{
  open:boolean;session:string;workspace:string;executing:boolean;agentRunning:boolean;disabledReason?:string;results:CommandDisplay[];onError:(text:string)=>void;
  onClose:()=>void;onRun:(command:string)=>Promise<boolean>;
}){
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const command=drafts[session] || '';
  const setCommand=(value:string)=>setDrafts(previous=>({...previous,[session]:value}));
  const input=useRef<HTMLInputElement>(null),panel=useRef<HTMLDivElement>(null);
  const available=validSession(session);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement as HTMLElement|null,node=panel.current;input.current?.focus();
    return()=>{if(document.activeElement===document.body || node?.contains(document.activeElement))previous?.focus();};
  },[open,session]);
  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();}};
    const onPointer=(event:PointerEvent)=>{
      if(!(event.target instanceof Node))return;
      if(panel.current?.contains(event.target))return;
      onClose();
    };
    document.addEventListener('keydown',onKey);
    document.addEventListener('pointerdown',onPointer);
    return()=>{document.removeEventListener('keydown',onKey);document.removeEventListener('pointerdown',onPointer);};
  },[open,onClose]);
  if(!open)return null;
  async function submit(event:FormEvent){
    event.preventDefault();
    if(!command.trim()||!available||executing||agentRunning||disabledReason)return;
    if(await onRun(command.trim()))setCommand('');
  }
  return <div ref={panel} className="strip-workflow-command-popup" role="dialog" aria-label="执行项目命令" aria-modal="false">
    <div className="strip-workflow-command-popup-head">
      <span className="strip-workflow-command-popup-icon"><Icon name="terminal-soft"/></span>
      <div><strong>运行项目命令</strong><p>仅在需要时手动运行，不占用聊天区域</p></div>
      <button type="button" className="strip-workflow-command-close" aria-label="关闭命令输入" title="关闭（Esc）" onClick={onClose}>×</button>
    </div>
    <form className="strip-workflow-command-popup-form" onSubmit={event=>void submit(event)}>
      <label htmlFor="strip-workflow-command-input">命令</label>
      <div className="strip-workflow-command-row"><span>$</span><input ref={input} id="strip-workflow-command-input" spellCheck={false} autoComplete="off" placeholder="例如 npm test 或 git status" value={command} maxLength={4096} onChange={event=>setCommand(event.target.value)} disabled={executing}/><button type="submit" disabled={!available||!command.trim()||executing||agentRunning||Boolean(disabledReason)} title={disabledReason || undefined}>{executing?'运行中…':'运行'}</button></div>
    </form>
    {!!results.length && <section className="strip-workflow-run-list strip-workflow-command-history" aria-label="手动命令执行记录">
      <p className="strip-workflow-run-subheading">手动执行 · {results.length} 条命令</p>
      {results.map((item,index)=>{
        const itemOpen=!!expanded[item.id];
        const running=item.status?item.status==='running':Boolean(item.running);
        const timedOut=item.status?item.status==='timeout':item.timedOut;
        const failed=item.status?item.status==='failed':Boolean(item.error);
        const success=item.status?item.status==='done':!running&&!timedOut&&!item.truncated&&!failed&&item.exitCode===0;
        const status=running?'运行中':item.truncated?'输出达上限':timedOut?'已超时':success?'已完成':failed?'启动失败':`退出码 ${item.exitCode ?? '?'}`;
        const output=[item.stdout,item.stderr,item.error].filter(Boolean).join('\n');
        return <article className="strip-workflow-run-step" data-result={running?'running':success?'success':'error'} key={item.id}>
          <span className="strip-workflow-run-rail" aria-hidden="true"><Icon name="terminal-soft"/></span>
          <div className="strip-workflow-run-body">
            <button type="button" className="strip-workflow-run-toggle" aria-expanded={itemOpen} onClick={()=>setExpanded(previous=>({...previous,[item.id]:!previous[item.id]}))}>
              <span className="strip-workflow-run-title"><strong>运行命令</strong><code title={item.command}>$ {item.command}</code></span>
              <span className="strip-workflow-run-status">{status} · {running?'等待结果':((item.durationMs ?? 0)/1000).toFixed(1)+'s'} <span className={'strip-workflow-run-chevron'+(itemOpen?' is-open':'')}>⌄</span></span>
            </button>
            {itemOpen && <div className="strip-workflow-run-detail">
              <div className="strip-workflow-run-detail-header"><span title={item.cwd}>{item.cwd||'当前项目目录'}</span><div><button type="button" onClick={()=>void copy(output || '$ '+item.command).catch(()=>onError('复制失败'))}>复制输出</button><button type="button" onClick={()=>saveText(`command-${index+1}.txt`,`$ ${item.command}\n${output}`)}>导出 .txt</button></div></div>
              {output?<pre><code>{output}</code></pre>:<p className="strip-workflow-run-empty">{running?'命令正在运行，完成后显示输出。':'命令没有产生标准输出。'}</p>}
              {item.truncated && <p className="strip-workflow-warning">输出已达到 128 KB 限制，命令已停止。</p>}
            </div>}
          </div>
        </article>;
      })}
    </section>}
    <div className="strip-workflow-command-popup-foot">

      <span title={workspace}>{available?(workspace||'当前会话工作区'):'发送第一条消息后可用'}</span>
      <small>{disabledReason || (agentRunning?'已有任务正在执行，请稍候':'每条命令单独确认 · 本机运行，非沙箱')}</small>
    </div>
  </div>;
}

/** Downloads remain in the thread; command output lives inside the floating palette. */
export function WorkspaceActions({snapshot,session,onError}:{snapshot:Snapshot|null;session:string;onError:(text:string)=>void}){
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const changes=(snapshot?.diff || []).map(asChange).filter((x):x is Change=>!!x);
  function downloadPatch(){
    const patches=changes.filter(change=>change.patch.trim()).map(change=>change.patch).join('\n');
    if(!patches)return onError('当前会话没有可用的补丁内容；仍可下载实际修改的文件。');
    saveText('strip-bot-changes.patch',patches+'\n');
  }
  if(!changes.length)return null;
  return <div className="strip-workflow-surface" aria-label="会话输出文件">
    {!!changes.length && <section className="strip-workflow-outputs" aria-label="输出文件">
      <header className="strip-workflow-heading"><span>◫</span><strong>输出文件</strong><span className="strip-workflow-muted">{changes.length} 个文件有变更</span><button type="button" onClick={downloadPatch} disabled={!changes.some(c=>c.patch.trim())}>导出 .patch</button></header>
      <div className="strip-workflow-file-list">{changes.map((item,index)=>{
        let relative=item.path;
        if(snapshot?.workspace){const base=snapshot.workspace.replace(/\\/g,'/').replace(/\/$/,'')+'/';if(relative.replace(/\\/g,'/').toLowerCase().startsWith(base.toLowerCase()))relative=relative.slice(base.length);}
        const href=validSession(session) && relative ? '/api/agent/sessions/'+encodeURIComponent(session)+'/output?path='+encodeURIComponent(relative):'';
        return <div className="strip-workflow-file" key={item.path+index}>
          <span className="strip-workflow-file-icon">≡</span><code title={item.path}>{relative}</code>
          <span className="strip-workflow-delta">{item.additions!==undefined?`+${item.additions}`:''} {item.deletions!==undefined?`−${item.deletions}`:''}</span>
          {href && <a href={href} download aria-label={`下载 ${relative}`}>下载</a>}
          {item.patch && <button type="button" aria-expanded={!!expanded[session+':'+item.path]} onClick={()=>setExpanded(previous=>({...previous,[session+':'+item.path]:!previous[session+':'+item.path]}))}>{expanded[session+':'+item.path]?'收起':'差异'}</button>}
          {!!expanded[session+':'+item.path]&& <pre className="strip-workflow-patch">{item.patch}</pre>}
        </div>;
      })}</div>
    </section>}
  </div>;
}
