import {useEffect,useState} from 'react';
import './desktop-updates.css';
export type UpdateState={status:string;version:string;nextVersion:string;progress:number;message:string};
function useUpdates(){
  const [state,setState]=useState<UpdateState|null>(null);
  useEffect(()=>{const api=window.stripUpdates;if(!api)return;let live=true;void api.status().then(value=>{if(live)setState(value);}).catch(()=>{});const off=api.onStatus(value=>{if(live)setState(value);});return ()=>{live=false;off();};},[]);
  return state;
}
export function DesktopUpdates({notice=false,busy=false}:{notice?:boolean;busy?:boolean}){
  const state=useUpdates();const [error,setError]=useState('');const [dismissed,setDismissed]=useState('');
  if(notice&&(!state||!['available','downloading','downloaded'].includes(state.status)||dismissed===state.nextVersion))return null;
  async function act(action:'check'|'download'|'install'){setError('');try{await window.stripUpdates?.[action]();}catch{setError('操作失败，请稍后重试。');}}
  const pending=state?.status==='checking'||state?.status==='downloading';
  return <section className={notice?'strip-update-notice':'strip-connection-card'} aria-label="软件更新" aria-live="polite">
    <h2>{notice?'Strip Bot 有可用更新':'软件更新'}</h2>
    {!state?<p>自动更新仅在 Windows 桌面安装版中提供。</p>:<>
      <p>当前版本 {state.version}{state.nextVersion?' · 新版本 '+state.nextVersion:''}</p>
      <p>{state.message}</p>
      {state.status==='downloading'&&<progress max="100" value={state.progress} aria-label="更新下载进度"/>}
      <div className="strip-update-actions">
        {!notice&&<button type="button" className="strip-btn strip-btn--secondary" disabled={pending||state.status==='unsupported'||state.status==='downloaded'} onClick={()=>void act('check')}>检查更新</button>}
        {state.status==='available'&&<button type="button" className="strip-btn" onClick={()=>void act('download')}>下载更新</button>}
        {state.status==='downloaded'&&<button type="button" className="strip-btn" disabled={busy} onClick={()=>void act('install')}>重启并更新</button>}
        {notice&&<button type="button" className="strip-btn strip-btn--secondary" onClick={()=>setDismissed(state.nextVersion)}>稍后</button>}
      </div>
      {state.status==='downloaded'&&<p>重启前请保存当前输入，等待正在进行的任务完成。</p>}
    </>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
