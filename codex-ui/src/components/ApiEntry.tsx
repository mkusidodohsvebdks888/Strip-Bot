import {useEffect,useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import type {StripAppearance} from '../state/useAppearance';
import {baseAppearance} from '../state/useAppearance';
import {apiPresets} from './api-presets';
import {resolveKeyProvider} from './api-key-provider.mjs';
import {discoverModels} from './api-models';
import {pickEntryModel} from './entry-model-selection.mjs';
import {NonoBrand} from './Brand/NonoBrand';
import './api-entry.css';

type Step = ''|'api'|'cc'|'account';
type SavedConnection = {baseUrl?:string;model?:string;protocol?:string;hasKey?:boolean};
const cleanUrl=(url:string)=>url.replace(/\/+$/,'');
async function jsonResponse(response:Response,fallback:string){
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(typeof value.error==='string'?value.error:fallback);
  return value;
}

/**
 * The key-first login intentionally has no default vendor. Generic sk- keys are
 * used by multiple vendors and must be paired with an explicit destination.
 */
export function ApiEntry({onEntered,appearance,onThemeChange}:{onEntered:(settings?:boolean)=>void;appearance:StripAppearance;onThemeChange?:(value:StripAppearance)=>void}){
  const [key,setKey]=useState('');
  const [showKey,setShowKey]=useState(false);
  const [manualVendor,setManualVendor]=useState('');
  const [showVendorPicker,setShowVendorPicker]=useState(false);
  const [action,setAction]=useState<Step>('');
  const [error,setError]=useState('');
  const [progress,setProgress]=useState('');
  const [saved,setSaved]=useState<SavedConnection|null>(null);
  const [initializing,setInitializing]=useState(true);
  const [hover,setHover]=useState(false);
  const [shake,setShake]=useState(false);
  const [typingTick,setTypingTick]=useState(0);
  const [tagline,setTagline]=useState('写代码、查资料、整理文档');
  const [authUrl,setAuthUrl]=useState('');
  const card=useRef<HTMLDivElement>(null);
  const typing=useRef({line:0,pos:13,deleting:false});
  const previousLight=useRef<StripAppearance>('warm');
  const keyInput=useRef<HTMLInputElement>(null);
  const vendorSelect=useRef<HTMLSelectElement>(null);
  const lock=useRef(false);

  const busy=Boolean(action) || initializing;
  const typedKey=key.trim();
  const hasSavedKey=Boolean(saved?.hasKey && saved.baseUrl);
  const savedPreset=apiPresets.find(item=>item.id!=='custom' && cleanUrl(item.baseUrl)===cleanUrl(saved?.baseUrl || '') && item.protocol===(saved?.protocol || 'openai'));
  
  const selectedVendor=typedKey?(showVendorPicker?manualVendor:resolveKeyProvider(typedKey,manualVendor)):(hasSavedKey?(savedPreset?.id || 'custom'):manualVendor);
  const preset=apiPresets.find(item=>item.id===selectedVendor);
  
  const baseUrl=typedKey?(preset?.baseUrl || ''):hasSavedKey?saved?.baseUrl || '':preset?.baseUrl || '';
  const protocol=typedKey?(selectedVendor==='custom'?'openai':preset?.protocol || 'openai'):saved?.protocol || 'openai';
  const fallbackModel=typedKey?(selectedVendor==='custom'?'':preset?.model || ''):saved?.model || '';

  useEffect(()=>{
    if(!error)return;
    setShake(true);
    const timer=window.setTimeout(()=>setShake(false),450);
    return()=>window.clearTimeout(timer);
  },[error]);

  useEffect(()=>{
    let live=true;
    void fetch('/api/connection/status',{signal:AbortSignal.timeout(9000)})
      .then(response=>response.ok?response.json():null)
      .then((value:SavedConnection|null)=>{if(live && value)setSaved(value);})
      .catch(()=>{})
      .finally(()=>{if(live)setInitializing(false);});
    return()=>{live=false;};
  },[]);

  function updateKey(value:string){
    setKey(value);
    // A newly entered key must not silently inherit an old vendor/destination.
    const replacement=Boolean(typedKey) && !value.startsWith(key) && !key.startsWith(value);
    if(replacement){setManualVendor('');setShowVendorPicker(false);}

    setError('');setProgress('');
  }
  function chooseVendor(value:string){
    setManualVendor(value);setShowVendorPicker(true);setError('');
  }
  function requireProvider(){
    if(!typedKey && hasSavedKey)return true;
    if(!typedKey){setError('请先输入 API Key。');keyInput.current?.focus();return false;}
    if(!selectedVendor){setError('无法仅凭密钥格式确定服务商，请先选择密钥对应的服务商。');vendorSelect.current?.focus();return false;}
    if(!baseUrl){setError('请填写当前服务提供的 API 地址。');return false;}
    return true;
  }
  async function enterApi(){
    if(busy || lock.current || !requireProvider())return;
    lock.current=true;
    setError('');setAction('api');setProgress('正在读取可用模型…');
    try{
      let chosen='';
      if(!chosen){
        try{
          const discovered=await discoverModels({baseUrl,...(typedKey?{apiKey:typedKey}:{}),refresh:true});
          chosen=pickEntryModel(discovered.models,fallbackModel,fallbackModel);
        }catch(err){
          if(!fallbackModel){
            throw new Error((err instanceof Error?err.message:'读取模型列表失败')+' 请在设置中配置可用模型。');
          }
          chosen=fallbackModel;
          setProgress('未读取到模型目录，尝试验证推荐模型…');
        }
      }
      if(!chosen)chosen=fallbackModel;
      if(!chosen){
        throw new Error('服务商未提供可用聊天模型，请检查服务配置。');
      }
      setProgress('正在验证密钥和模型…');
      // Transactional: wrong key/model must NOT overwrite a working saved connection.
      const response=await fetch('/api/connection/connect',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({baseUrl,protocol,model:chosen,...(typedKey?{apiKey:typedKey}:{})}),
        signal:AbortSignal.timeout(35000),
      });
      await jsonResponse(response,'API 连接失败。');
      setKey('');
      localStorage.setItem('strip_connection_mode_v1','direct');
      onEntered();
    }catch(err){
      setError(err instanceof Error?err.message:'API 连接失败，请重试。');

    }finally{lock.current=false;setAction('');setProgress('');}
  }

  useEffect(()=>{
    if(hover || typeof window==='undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const lines=['写代码、查资料、整理文档','一个 Key，马上开始','支持 CC Switch 与 ChatGPT 账号连接'];
    const t=typing.current,full=lines[t.line];
    const timer=window.setTimeout(()=>{
      if(!t.deleting && t.pos<full.length)t.pos++;
      else if(!t.deleting)t.deleting=true;
      else if(t.pos>0)t.pos--;
      else {t.deleting=false;t.line=(t.line+1)%lines.length;}
      setTagline(lines[t.line].slice(0,t.pos));setTypingTick(v=>v+1);
    },t.deleting?35:t.pos>=full.length?1400:70);
    return()=>window.clearTimeout(timer);
  },[typingTick,hover]);
  function enterMode(mode:'ccswitch'|'opencode'){
    localStorage.setItem('strip_connection_mode_v1',mode);onEntered();
  }
  async function connectCC(){
    if(busy || lock.current)return;
    lock.current=true;setAction('cc');setError('');setProgress('正在检测 CC Switch…');
    try{
      const value=await jsonResponse(await fetch('/api/cc-switch/status',{signal:AbortSignal.timeout(12000)}),'无法读取 CC Switch。');
      if(!value.healthy || !value.codex?.model)throw new Error('请先在 CC Switch 启用 Codex 本地路由并配置模型。');
      enterMode('ccswitch');
    }catch(err){setError(err instanceof Error?err.message:'CC Switch 连接失败。');}
    finally{lock.current=false;setAction('');setProgress('');}
  }
  async function connectAccount(){
    if(busy || lock.current)return;
    lock.current=true;setAction('account');setError('');setProgress('正在读取 ChatGPT 授权状态…');
    try{
      const status=await jsonResponse(await fetch('/api/connection/account/status',{signal:AbortSignal.timeout(15000)}),'读取账号状态失败。');
      if(status.connected){enterMode('opencode');lock.current=false;setAction('');setProgress('');return;}
      const result=await jsonResponse(await fetch('/api/connection/account/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)}),'启动授权失败。');
      const url=new URL(result.url);
      if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('授权地址无效。');
      setAuthUrl(url.href);setProgress('请打开授权页面完成登录，完成后会自动进入。');
    }catch(err){lock.current=false;setAction('');setProgress('');setError(err instanceof Error?err.message:'ChatGPT 授权失败。');}
  }
  useEffect(()=>{
    if(action!=='account' || !authUrl)return;
    let live=true,polling=false;const controller=new AbortController();
    const poll=async()=>{
      if(polling)return;polling=true;
      try{
        const status=await jsonResponse(await fetch('/api/connection/account/status',{signal:controller.signal}),'读取授权状态失败。');
        if(!live)return;
        if(status.connected){live=false;setAuthUrl('');setAction('');setProgress('');lock.current=false;enterMode('opencode');}
        else if(['failed','expired','cancelled'].includes(status.attempt?.status)){
          live=false;setError('本次授权未完成，请重试。');setAuthUrl('');setAction('');setProgress('');lock.current=false;
        }
      }catch(err){if(live){setError(err instanceof Error?err.message:'授权状态读取失败。');setAuthUrl('');setAction('');setProgress('');lock.current=false;}}
      finally{polling=false;}
    };
    const timer=window.setInterval(()=>void poll(),2000);
    const deadline=window.setTimeout(()=>{if(live){live=false;setError('等待授权超时，请重新连接。');setAuthUrl('');setAction('');setProgress('');lock.current=false;}},180000);
    return()=>{live=false;controller.abort();window.clearInterval(timer);window.clearTimeout(deadline);};
  },[action,authUrl]);
  async function cancelAccount(){
    try{await jsonResponse(await fetch('/api/connection/account/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)}),'取消授权失败。');}
    catch(err){setError(err instanceof Error?err.message:'取消授权失败。');}
    finally{setAuthUrl('');setAction('');setProgress('');lock.current=false;}
  }
  function moveCard(event:PointerEvent<HTMLDivElement>){
    if(event.pointerType!=='mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const el=card.current;if(!el)return;const rect=el.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
    el.style.setProperty('--mx',`${x*100}%`);el.style.setProperty('--my',`${y*100}%`);
    el.style.setProperty('--rx',`${(.5-y)*4}deg`);el.style.setProperty('--ry',`${(x-.5)*4}deg`);
  }
  return <main className="strip-api-entry strip-api-entry--merged" data-appearance={baseAppearance(appearance)} data-theme={baseAppearance(appearance)==='dark'?'dark':'light'}>
    <div className="strip-entry-orbs" aria-hidden="true"><i/><i/><i/></div>
    {onThemeChange && <button type="button" className="strip-entry-theme" aria-label="切换主题" onClick={()=>{if(baseAppearance(appearance)==='dark')onThemeChange(previousLight.current);else{previousLight.current=appearance;onThemeChange('dark');}}}>◐ 主题</button>}
    <div ref={card} className={`strip-entry-card${shake?' is-shake':''}`} onPointerMove={moveCard} onPointerLeave={()=>{card.current?.style.setProperty('--rx','0deg');card.current?.style.setProperty('--ry','0deg');}} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
      <div className="strip-entry-monogram"><NonoBrand/><span>Strip Bot</span></div>
      <h1>连接你的模型，<em>开始工作</em></h1>
      <p className="strip-entry-tagline">{tagline}<span className="strip-entry-caret" aria-hidden="true"/></p>
      <div className="strip-entry-steps" aria-label="连接步骤"><span><b>1</b>粘贴 Key</span><span><b>2</b>或一键授权</span><span><b>3</b>进入工作台</span></div>
      <form className="strip-entry-form" data-state={action==='api'?'loading':undefined} aria-busy={busy} onSubmit={event=>{event.preventDefault();void enterApi();}}>
        <label htmlFor="strip-entry-api-key">API Key</label>
        <div className="strip-api-secret">
          <input ref={keyInput} id="strip-entry-api-key" aria-label="API Key" aria-describedby={error?'strip-entry-error':undefined} type={showKey?'text':'password'} value={key} disabled={busy} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={hasSavedKey?'已保存密钥 · 留空可继续':'sk-…'} onChange={event=>updateKey(event.target.value)}/>
          <button type="button" className="strip-api-visibility" disabled={busy} aria-label={showKey?'隐藏 API Key':'显示 API Key'} aria-pressed={showKey} onClick={()=>setShowKey(v=>!v)}>{showKey?'隐藏':'显示'}</button>
        </div>
        {typedKey && !resolveKeyProvider(typedKey,'') && <label className="strip-entry-required-provider" htmlFor="strip-entry-vendor">请选择密钥对应的服务商<select ref={vendorSelect} id="strip-entry-vendor" disabled={busy} value={manualVendor} onChange={event=>chooseVendor(event.target.value)}><option value="">请选择服务商</option>{apiPresets.filter(item=>item.id!=='custom').map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {!typedKey && hasSavedKey && <p className="strip-entry-saved">可沿用本机已保存的 API 连接。</p>}
        <button type="submit" className={`strip-api-enter ${action==='api'?'is-busy':''}`} aria-label={action==='api'?'正在连接 API':'连接并进入'} aria-busy={action==='api'} disabled={busy || (!typedKey && !hasSavedKey)}>{action==='api'?'连接中…':'使用 API Key 进入'}</button>
      </form>
      <div className="strip-entry-divider"><span>或</span></div>
      <div className="strip-entry-oauth">
        <button type="button" className={`strip-entry-oauth-btn ${action==='cc'?'is-busy':''}`} aria-label="CC Switch 连接并进入" aria-busy={action==='cc'} disabled={busy} onClick={()=>void connectCC()}><span aria-hidden="true">↗</span><span>CC Switch 连接并进入</span><i className="strip-entry-arrow" aria-hidden="true">→</i></button>
        <button type="button" className={`strip-entry-oauth-btn ${action==='account'?'is-busy':''}`} aria-label="ChatGPT 授权连接并进入" aria-busy={action==='account'} disabled={busy} onClick={()=>void connectAccount()}><span aria-hidden="true">◎</span><span>ChatGPT 授权连接并进入</span><i className="strip-entry-arrow" aria-hidden="true">→</i></button>
      </div>
      {authUrl && <div className="strip-entry-auth"><a href={authUrl} target="_blank" rel="noreferrer">打开授权页面 ↗</a><button type="button" aria-label="取消授权" onClick={()=>void cancelAccount()}>取消授权</button></div>}
      {progress && <p className="strip-entry-progress" role="status">{progress}</p>}
      {error && <p id="strip-entry-error" className="strip-api-error" role="alert">{error}</p>}
      <p className="strip-api-hint">API 密钥验证后在本机加密保存，仅发送至对应服务商。</p>
    </div>
  </main>;
}

