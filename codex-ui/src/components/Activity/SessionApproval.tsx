import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {ApprovalMode} from '../AgentPanel';
import {ControlIcon} from '../ControlIcon';
import {Button as KitButton} from '../../vendor/codex-ui-kit/Button';
import './session-approval.css';
import {useAnchoredPopup} from '../useAnchoredPopup';

export function ApprovalConfirm({title,children,label,onConfirm,onCancel}:{title:string;children:ReactNode;label:string;onConfirm:()=>Promise<void>;onCancel:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),lock=useRef(false);
  const [working,setWorking]=useState(false),[error,setError]=useState('');
  useEffect(()=>{dialog.current?.showModal();},[]);
  async function submit(){if(lock.current)return;lock.current=true;setWorking(true);setError('');try{await onConfirm();onCancel();}catch(e){setError(e instanceof Error?e.message:'操作失败，请重试。');}finally{lock.current=false;setWorking(false);}}
  return <dialog ref={dialog} className="strip-approval-dialog" aria-label={title} onCancel={event=>{event.preventDefault();if(!lock.current)onCancel();}}>
    <h3>{title}</h3>{children}{error && <p role="alert" className="strip-approval-error">{error}</p>}
    <div className="strip-approval-actions"><KitButton type="button" tone="secondary" autoFocus disabled={working} onClick={onCancel}>取消</KitButton><KitButton type="button" tone="primary" className="strip-approval-primary" loading={working} disabled={working} onClick={()=>void submit()}>{working?'正在提交…':label}</KitButton></div>
  </dialog>;
}
export function SessionApproval({mode,updating,disabled,workspace,onChange,docked=false}:{mode:ApprovalMode;updating:boolean;disabled:boolean;workspace:string;onChange:(mode:ApprovalMode)=>Promise<void>;docked?:boolean}){
  const [confirm,setConfirm]=useState(false),[error,setError]=useState('');
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLSpanElement>(null),button=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),lock=useRef(false);
  const popupPosition=useAnchoredPopup(open && !docked,button,menu,{width:300,align:'start',gap:8});
  useEffect(()=>{if(disabled || updating)setOpen(false);},[disabled,updating]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);button.current?.focus();}if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();const nodes=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]:not(:disabled)') || []);const index=nodes.indexOf(document.activeElement as HTMLButtonElement);const next=event.key==='Home'?0:event.key==='End'?nodes.length-1:(index+(event.key==='ArrowUp'?-1:1)+nodes.length)%nodes.length;nodes[next]?.focus();
    }};
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked=true]')?.focus();document.addEventListener('pointerdown',outside);menu.current?.addEventListener('keydown',key);
    const current=menu.current;return()=>{document.removeEventListener('pointerdown',outside);current?.removeEventListener('keydown',key);};
  },[open]);
  async function choose(next:ApprovalMode){
    if(lock.current || updating)return;
    setError('');setOpen(false);
    if(next==='allow-all'){setConfirm(true);return;}
    lock.current=true;try{await onChange('ask');button.current?.focus();}catch(e){setError(e instanceof Error?e.message:'保存权限模式失败');}finally{lock.current=false;}
  }
  return <span ref={root} className={'strip-session-approval'+(mode==='allow-all'?' is-auto':'')+(docked?' is-docked':'')}>
    {docked && <span className="strip-approval-inline" role="group" aria-label="权限模式">
      <button type="button" disabled={updating || disabled} aria-pressed={mode==='ask'} onClick={()=>void choose('ask')}><strong>逐次批准</strong><small>每项工具操作执行前确认</small></button>
      <button type="button" disabled={updating || disabled} aria-pressed={mode==='allow-all'} onClick={()=>void choose('allow-all')}><strong>允许全部</strong><small>当前项目后续工具操作自动批准</small></button>
    </span>}
    {!docked && <button ref={button} type="button" disabled={updating || disabled} aria-label={'权限模式：'+(mode==='allow-all'?'允许全部':'逐次批准')} aria-haspopup="menu" aria-expanded={open} title="选择并记住此项目的权限模式" onClick={()=>setOpen(value=>!value)}>
      {updating?'正在更新…':mode==='allow-all'?'允许全部':'逐次批准'}<ControlIcon name="down" size={13}/>
    </button>}
    {!docked && open && <div ref={menu} role="menu" aria-label="权限模式" className="strip-approval-menu" style={popupPosition}>
      <div className="strip-approval-menu-title">权限模式</div>
      <button type="button" role="menuitemradio" aria-checked={mode==='ask'} onClick={()=>void choose('ask')}><span><strong>逐次批准</strong><small>工具请求执行前，由你确认</small></span>{mode==='ask' && <ControlIcon name="check" size={15}/>}</button>
      <button type="button" role="menuitemradio" aria-checked={mode==='allow-all'} onClick={()=>void choose('allow-all')}><span><strong>允许全部</strong><small>自动批准当前会话的工具请求</small></span>{mode==='allow-all' && <ControlIcon name="check" size={15}/>}</button>
      <p>选择后记住为此项目、此连接的新对话默认值。</p>
    </div>}
    {error && <span role="alert" className="strip-approval-error">{error}</span>}
    {confirm && <ApprovalConfirm title="启用并记住自动批准？" label="确认并记住" onCancel={()=>{setConfirm(false);button.current?.focus();}} onConfirm={()=>onChange('allow-all')}>
      <p>当前会话后续的终端命令、文件读写和其他工具请求将自动批准，可能以当前系统用户权限执行。请仅在可信项目使用。</p>
      <p>项目目录：{workspace || '尚未设置'}</p>
      <p>此选择会作为当前项目、当前连接的新对话默认值，重新打开应用后仍会保留。其他项目与历史会话不会自动更改。</p>
      <p>可随时切回逐次批准。停止任务、拒绝操作或重启服务会清除已有会话的自动批准；新对话仍按保存的默认选择创建。不写入引擎永久规则。已执行的操作无法撤销。</p>
    </ApprovalConfirm>}
  </span>;
}
