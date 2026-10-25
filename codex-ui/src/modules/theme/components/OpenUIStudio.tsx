import {useEffect,useState} from 'react';
import {applyImportedTheme,clearImportedTheme,hasImportedTheme,parseOpenUITheme} from '../state/generated-theme';
import '../styles/openui-studio.css';

type OpenUIStatus={online:boolean;url:string;source:string};
const example=`:root {
  --bg: #f7f9fc;
  --fg: #263044;
  --accent: #819fc4;
  --card-bg: #ffffff;
  --sidebar-bg: #edf1f8;
}`;

export function OpenUIStudio(){
 const [service,setService]=useState<OpenUIStatus|null>(null);
 const [loading,setLoading]=useState(true);
 const [showFrame,setShowFrame]=useState(false);
 const [code,setCode]=useState(example);
 const [message,setMessage]=useState('');
 const [hasCustom,setHasCustom]=useState(hasImportedTheme);
 async function refresh(){
   setLoading(true);
   try{
     const response=await fetch('/api/openui/status',{cache:'no-store'});
     const result=await response.json() as OpenUIStatus&{error?:string};
     if(!response.ok)throw new Error(result.error||'OpenUI 连接失败');
     setService(result);
   }catch{setService({online:false,url:'http://127.0.0.1:7878/',source:''});}
   finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{
   const sync=()=>setHasCustom(hasImportedTheme());
   window.addEventListener('strip:openui-theme-changed',sync);
   return ()=>window.removeEventListener('strip:openui-theme-changed',sync);
 },[]);
 function apply(){
   try{
     const palette=parseOpenUITheme(code);
     if(!window.confirm('将生成的颜色应用到 StripBot 各模块？原来的主题可以恢复。'))return;
     applyImportedTheme(palette);
     setMessage('已经导入 '+Object.keys(palette).length+' 项主题颜色，可以随时恢复。');
   }catch(error){setMessage(error instanceof Error?error.message:'颜色导入失败');}
 }
 return <section className="strip-connection-card strip-openui-studio" aria-label="OpenUI 生成式界面">
   <div className="strip-openui-studio__header"><div><h2>生成式 UI · OpenUI</h2><p>使用自然语言描述界面，实时预览，反复调整，再把颜色导入 StripBot。</p></div>
     <span className={'strip-openui-status'+(service?.online?' is-ready':'')}>{loading?'检测中…':service?.online?'已连接 OpenUI':'OpenUI 未启动'}</span>
   </div>
   <div className="strip-openui-actions">
     <button className="strip-btn strip-btn--secondary" type="button" disabled={!service?.online} onClick={()=>setShowFrame(v=>!v)}>{showFrame?'收起生成器':'打开 OpenUI 生成器'}</button>
     <a className="strip-btn strip-btn--secondary" href="http://127.0.0.1:7878/ai" target="_blank" rel="noopener noreferrer">浏览器打开</a>
     <button className="strip-btn strip-btn--secondary" type="button" disabled={loading} onClick={()=>void refresh()}>刷新状态</button>
   </div>
   {!service?.online&&<div className="strip-openui-help" role="status">
      <strong>先运行 OpenUI（本地独立服务）</strong>
      <p>在项目根目录执行 <code>powershell -ExecutionPolicy Bypass -File scripts/openui/Start-OpenUI.ps1</code>。需要 Docker Desktop，首次运行会下载构建依赖。</p>
      <p>AI 模型在 OpenUI 内独立配置；不会读取或转发 StripBot 已保存的 API 密钥。</p>
   </div>}
   {showFrame&&service?.online&&<div className="strip-openui-frame"><iframe title="OpenUI 本地界面设计器" src="http://127.0.0.1:7878/ai" loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin allow-downloads allow-popups"/></div>}
   <div className="strip-openui-import">
      <h3>将生成的主题应用到 StripBot</h3>
      <p>在 OpenUI 中要求模型输出 <code>:root</code> 格式 CSS 变量，把颜色粘贴到这里。只接受安全的十六进制颜色，不执行生成的 HTML、脚本或任意 CSS。</p>
      <label htmlFor="strip-openui-css">主题颜色变量</label>
      <textarea id="strip-openui-css" rows={7} spellCheck={false} value={code} onChange={event=>setCode(event.target.value)}/>
      <div className="strip-openui-actions">
        <button className="strip-btn strip-btn--primary" type="button" onClick={apply}>确认并应用</button>
        <button className="strip-btn strip-btn--secondary" type="button" disabled={!hasCustom} onClick={()=>{clearImportedTheme();setMessage('已恢复 StripBot 原有主题颜色。');}}>恢复原主题</button>
      </div>
      {message&&<p className="strip-openui-feedback" role="status">{message}</p>}
   </div>
 </section>;
}
