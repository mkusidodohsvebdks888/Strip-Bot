import {createPortal} from 'react-dom';
import {appearanceLabels,type StripAppearance} from '../../state/useAppearance';
import {useEffect,useRef,useState} from 'react';
import {Icon} from '../../Icons';
import type {ConnectionMode} from '../../state/useConnection';

interface ApiConnectionStatus {
  baseUrl:string;
  model:string;
  protocol:string;
  hasKey:boolean;
  configured:boolean;
}
type AccountPage = 'main'|'usage'|'help'|'confirm';

type Props = {
  mode:ConnectionMode;
  model:string;
  busy:boolean;
  appearance:StripAppearance;
  onWorkspace:()=>void;
  onSettings:()=>void;
  onToggleTheme:()=>void;
  onDisconnected:()=>void;
};

function safeHost(address:string){
  try{return new URL(address).host;}catch{return '';} // Never use an upstream URL as HTML.
}

function ExitIcon(){
  return <svg aria-hidden="true" className="strip-account-row__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5M15 12H4"/><path d="M12 4h5a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-5"/></svg>;
}

export function ApiAccountMenu({mode,model,busy,appearance,onWorkspace,onSettings,onToggleTheme,onDisconnected}:Props){
  const [opened,setOpened]=useState(false);
  const [position,setPosition]=useState({left:64,bottom:60});
  const [page,setPage]=useState<AccountPage>('main');
  const [status,setStatus]=useState<ApiConnectionStatus|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [disconnecting,setDisconnecting]=useState(false);
  const lock=useRef(false);
  const rootRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const panelRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!opened)return;
    const controller=new AbortController();
    setStatus(null);setError('');
    if(mode==='direct'){
      setLoading(true);
      void fetch('/api/connection/status',{signal:controller.signal,cache:'no-store'})
        .then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error || '读取连接失败');return result as ApiConnectionStatus;})
        .then(value=>{if(!controller.signal.aborted)setStatus(value);})
        .catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:'读取连接状态失败');})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    }else setLoading(false);
    const onOutside=(event:PointerEvent)=>{if(event.target instanceof Node && !rootRef.current?.contains(event.target) && !panelRef.current?.contains(event.target))setOpened(false);};
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.stopPropagation();setOpened(false);setPage('main');triggerRef.current?.focus();
      }
    };
    const place=()=>{const rect=triggerRef.current?.getBoundingClientRect();if(rect)setPosition({left:Math.max(8,Math.min(rect.right+8,window.innerWidth-Math.min(320,window.innerWidth-80)-8)),bottom:Math.max(12,Math.min(window.innerHeight-rect.bottom,window.innerHeight-110))});};
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    document.addEventListener('pointerdown',onOutside);
    document.addEventListener('keydown',onEscape);
    requestAnimationFrame(()=>panelRef.current?.focus());
    return ()=>{controller.abort();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',onOutside);document.removeEventListener('keydown',onEscape);};
  },[opened,mode]);

  function show(){setPage('main');setError('');setOpened(value=>!value);}
  function run(action:()=>void){setOpened(false);setPage('main');action();}
  async function disconnect(){
    if(busy || disconnecting)return;
    if(lock.current)return;lock.current=true;setDisconnecting(true);setError('');
    try{
      const response=await fetch('/api/connection/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      const value=await response.json();
      if(!response.ok || value.hasKey)throw new Error(value.error || '清除本机 API 凭据失败。');
      setOpened(false);onDisconnected();
    }catch(err){setError(err instanceof Error?err.message:'退出授权失败，请重试。');}
    finally{lock.current=false;setDisconnecting(false);}
  }
  const host=safeHost(status?.baseUrl || '');
  const connectionLabel=mode==='direct'?'API Key 授权':mode==='ccswitch'?'CC Switch 连接':'ChatGPT 账号连接';
  const subLabel=mode==='direct'?(loading?'读取连接状态中…':error && !status?'连接状态无法读取':status?.hasKey?'已保存本机凭据':status?.configured?'未保存 API Key':'尚未配置 API 连接'):'通过已配置的连接调用模型';

  return <div className="strip-account-anchor" ref={rootRef}>
    <button type="button" ref={triggerRef} className={'strip-tool-btn strip-account-trigger'+(opened?' is-active':'')} aria-label="账户与授权" title="账户与授权" aria-haspopup="dialog" aria-expanded={opened} aria-controls="strip-account-menu" onClick={show}>
      <span className="strip-account-avatar" aria-hidden="true">{mode==='direct'?'API':mode==='ccswitch'?'CC':'AI'}</span>
    </button>
    {opened && createPortal(<div style={position} onKeyDown={event=>{if(event.key!=='Tab')return;const nodes=panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey && (document.activeElement===first || document.activeElement===panelRef.current)){event.preventDefault();last.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}}} id="strip-account-menu" className="strip-account-menu" role="dialog" aria-label="账户与连接菜单" tabIndex={-1} ref={panelRef}>
      {page==='main' ? <>
        <div className="strip-account-profile">
          <span className="strip-account-profile__avatar" aria-hidden="true"><Icon name="user"/></span>
          <div className="strip-account-profile__identity"><strong>{connectionLabel}</strong><span>{subLabel}</span></div>
          <span className={'strip-account-profile__status'+(status?.hasKey?' has-key':'')} aria-hidden="true"/>
        </div>
        <div className="strip-account-details">
          <div><span>服务地址</span><strong title={status?.baseUrl || ''}>{mode==='direct'?(host || '未配置'):mode==='ccswitch'?'由 CC Switch 管理':'OpenCode 原生连接'}</strong></div>
          <div><span>当前模型</span><strong title={status?.model || model}>{model || status?.model || '未选择'}</strong></div>
        </div>
        <div className="strip-account-separator"/>
        <button type="button" className="strip-account-row" onClick={()=>run(onWorkspace)}><Icon name="folder-open"/><span>工作区设置</span></button>
        <button type="button" className="strip-account-row" onClick={()=>run(onSettings)}><Icon name="settings"/><span>API 连接与密钥管理</span></button>
        <button type="button" className="strip-account-row" onClick={()=>setPage('usage')}><Icon name="info"/><span>用量与额度说明</span><Icon name="chevron-right"/></button>
        <div className="strip-account-separator"/>
        <button type="button" className="strip-account-row" onClick={onToggleTheme}><Icon name="sliders-horizontal"/><span>外观：{appearanceLabels[appearance]}</span><span className="strip-account-row__hint">设置</span></button>
        <button type="button" className="strip-account-row" onClick={()=>setPage('help')}><Icon name="circle-help"/><span>帮助与授权说明</span><Icon name="chevron-right"/></button>
        {mode==='direct' && <><div className="strip-account-separator"/><button type="button" className="strip-account-row strip-account-row--danger" disabled={busy || disconnecting} onClick={()=>setPage('confirm')}><ExitIcon/><span>退出 API Key 授权</span></button></>}
      </>: <>
        <button type="button" className="strip-account-back" disabled={disconnecting} onClick={()=>{setPage('main');setError('');}}><Icon name="arrow-left"/>返回账户菜单</button>
        {page==='usage' && <div className="strip-account-subpage"><h3>用量与额度</h3><p>API 服务的实际余额、剩余额度和计费由对应服务商管理。</p><p>Strip Bot 目前没有通用余额查询接口，因此不会显示未经验证的剩余额度。</p><button type="button" className="strip-account-subpage__action" onClick={()=>run(onSettings)}>打开连接设置</button></div>}
        {page==='help' && <div className="strip-account-subpage"><h3>API 授权说明</h3><p>这里展示的是本机 API 连接，并非 OpenAI 或其他服务商的个人登录身份。</p><p>密钥保存在本机加密存储中，菜单只读取连接状态，不显示密钥原文。</p><p>需要更换服务商、API Key 或协议，请打开“API 连接与密钥管理”。</p></div>}
        {page==='confirm' && <div className="strip-account-subpage"><h3>退出 API Key 授权？</h3><p>将清除 Strip Bot 在此 Windows 用户下保存的 API Key，并回到 API 接入页。</p><p>不会删除聊天记录、模型 ID 或项目目录，也不会撤销服务商平台上生成的密钥。</p><div className="strip-account-confirm-actions"><button type="button" disabled={disconnecting} onClick={()=>setPage('main')}>取消</button><button type="button" className="is-danger" disabled={busy || disconnecting} onClick={()=>void disconnect()}>{disconnecting?'正在退出…':'确认退出授权'}</button></div>{busy && <p>当前有正在执行的任务，请等待完成后退出。</p>}</div>}
      </>}
      {error && <p className="strip-account-error" role="alert">{error}</p>}
    </div>,document.body)}
  </div>;
}
