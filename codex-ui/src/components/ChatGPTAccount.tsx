import {useState} from 'react';
export function ChatGPTAccount({account,model,onModel,onRefresh,busy}:{account:{connected:boolean;models:{id:string;name:string}[];attempt?:{status:string}};model:string;onModel:(value:string)=>void;onRefresh:()=>void;busy:boolean}){
  const [url,setUrl]=useState(''),[working,setWorking]=useState(false),[error,setError]=useState('');
  async function action(name:'login'|'cancel'){
    setWorking(true);setError('');
    try{const response=await fetch('/api/connection/account/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const value=await response.json();if(!response.ok)throw new Error(value.error || '授权请求失败');setUrl(name==='login'?value.url:'');onRefresh();}
    catch(e){setError(e instanceof Error?e.message:'授权请求失败');}finally{setWorking(false);}
  }
  const pending=Boolean(url && account.attempt?.status!=='complete' && account.attempt?.status!=='failed' && account.attempt?.status!=='expired');
  return <section className="strip-connection-card"><h2>ChatGPT 账号登录</h2>
    <p role="status">{account.attempt?.status==='pending'?'等待浏览器授权':account.connected?'已连接 ChatGPT 账号': '尚未连接账号'}{account.attempt?.status==='failed'?' · 本次授权失败':''}{account.attempt?.status==='expired'?' · 本次授权已过期':''}</p>
    <div className="strip-connection-actions"><button className="strip-btn strip-btn--primary" disabled={busy || working} onClick={()=>void action('login')}>{working?'正在处理…':account.connected?'重新授权':'登录 ChatGPT'}</button><button className="strip-btn strip-btn--secondary" disabled={busy || working} onClick={onRefresh}>刷新状态</button></div>
    {pending && <p><a href={url} target="_blank" rel="noreferrer">打开浏览器完成授权 ↗</a> <button className="strip-btn strip-btn--ghost" disabled={working} onClick={()=>void action('cancel')}>取消本次授权</button></p>}
    {account.connected && <label>3. OpenAI 模型<select aria-label="ChatGPT 模型" value={model} disabled={busy} onChange={e=>onModel(e.target.value)}>{account.models.map(item=><option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label>}
    <p className="strip-muted">聊天与编程通过 Codex CLI 使用此账号。授权凭据由本机 Codex 管理；可用模型与额度取决于你的账号，登录成功不代表额度充足。</p>
    {error && <div role="alert">{error}<button aria-label="关闭授权提示" onClick={()=>setError('')}>×</button></div>}
  </section>;
}
