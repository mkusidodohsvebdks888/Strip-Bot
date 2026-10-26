import {useEffect,useId,useState,type ReactNode} from 'react';
import type {ConnectionMode} from '../state/useConnection';
import './connection-settings.css';
import {ControlIcon} from './ControlIcon';
import type {ModelMetrics} from './AgentPanel';
import {ChatGPTAccount} from './ChatGPTAccount';
import {modelVendor,modelVendors} from './model-vendors';
import {discoverModels} from './api-models';
import {NonoPluginSettings} from './NonoPluginSettings';
import {SettingsDiagnostics} from './SettingsDiagnostics';
import type {DiscoveredModel} from './api-models';
const settingsGroups=[
  {label:'AI 与模型',pages:[{id:'model',label:'模型与厂商'},{id:'api',label:'API 连接'},{id:'models',label:'模型列表'}]},
  {label:'工作区与运行',pages:[{id:'project',label:'项目与目录'},{id:'diagnostics',label:'运行诊断'}]},
  {label:'外观与扩展',pages:[{id:'performance',label:'显示与性能'},{id:'appearance',label:'主题与生成式 UI'},{id:'nono',label:'桌面宠物'}]}
] as const;
const settingsPages=settingsGroups.flatMap(group=>group.pages);
type SettingsPage=typeof settingsPages[number]['id'];
const pageKey='strip_settings_page_v1';
function storedPage():SettingsPage {try{const value=localStorage.getItem(pageKey);return settingsPages.find(item=>item.id===value)?.id || 'model';}catch{return 'model';}}
type ApiConfig={baseUrl:string;model:string;protocol:string;hasKey:boolean;configured:boolean;reasoningEnabled:boolean;reasoningEffort:string};
export function ConnectionSettings({pageRequest,appearanceSettings,displayRate,metrics,mode,onMode,onBack,onSaved,busy,account,nativeModel,onNativeModel,workspace,workspaceLocked,onWorkspace}:{pageRequest?:{page:'project'};appearanceSettings?:ReactNode;displayRate:{rate:number|null;commit:(value:number|null)=>void;error:string};metrics?:ModelMetrics|null;workspace:string;workspaceLocked:boolean;onWorkspace:(value:string)=>void;account:{connected:boolean;models:{id:string;name:string}[];attempt?:{status:string}};nativeModel:string;onNativeModel:(value:string)=>void;mode:ConnectionMode;onMode:(value:ConnectionMode)=>void;onBack:()=>void;onSaved:()=>void;busy:boolean}){
  const [page,setPage]=useState<SettingsPage>(storedPage);
  const pageId=useId();
  const [confirmClear,setConfirmClear]=useState(false);
  useEffect(()=>{if(pageRequest)changePage(pageRequest.page);},[pageRequest]);
  function changePage(value:SettingsPage){setPage(value);try{localStorage.setItem(pageKey,value);}catch{/* Tabs still work when storage is blocked. */}}
  const panelProps=(value:SettingsPage)=>({role:'tabpanel' as const,id:pageId+'-'+value,'aria-labelledby':pageId+'-tab-'+value,hidden:page!==value,tabIndex:0});
  const [config,setConfig]=useState<ApiConfig>({baseUrl:'https://api.openai.com/v1',model:'',protocol:'responses',hasKey:false,configured:false,reasoningEnabled:false,reasoningEffort:''});
  const [key,setKey]=useState(''),[working,setWorking]=useState(false),[loading,setLoading]=useState(true),[feedback,setFeedback]=useState(''),[clearKey,setClearKey]=useState(false),[dirty,setDirty]=useState(false);
  const [discovered,setDiscovered]=useState<DiscoveredModel[]>([]),[modelsAt,setModelsAt]=useState(''),[modelMessage,setModelMessage]=useState(''),[fetching,setFetching]=useState(false);
  const [vendor,setVendor]=useState('');
  const [savedModels,setSavedModels]=useState<Record<string,string[]>>(()=>{try{const value=JSON.parse(localStorage.getItem('strip_api_model_history_v1') || '{}');return value && typeof value==='object' && !Array.isArray(value)?Object.fromEntries(Object.entries(value).filter((entry):entry is [string,string[]]=>Array.isArray(entry[1]) && entry[1].every(item=>typeof item==='string'))):{};}catch{return {};}});
  const savedVendor=Object.entries(savedModels).find(([group,ids])=>group.endsWith('|'+config.baseUrl) && ids.includes(config.model))?.[0].split('|')[0];
  const selectedVendor=mode==='opencode'?'openai':mode==='ccswitch'?modelVendor(nativeModel):vendor || savedVendor || modelVendor(config.model);
  const modelHistoryKey=selectedVendor+'|'+config.baseUrl;
  const availableModels=Array.from(new Set([...(modelsAt===config.baseUrl?discovered:[]).map(item=>item.id),...(savedModels[modelHistoryKey] || []),...(config.model?[config.model]:[])]));
  function rememberModel(model:string){const next={...savedModels,[modelHistoryKey]:Array.from(new Set([model,...(savedModels[modelHistoryKey] || [])])).slice(0,30)};setSavedModels(next);try{localStorage.setItem('strip_api_model_history_v1',JSON.stringify(next));}catch{/* Saving a connection must not depend on browser storage. */}}
  function chooseVendor(value:string){
    setVendor(value);
    if(value!==selectedVendor){setConfig(previous=>({...previous,model:'',reasoningEnabled:false,reasoningEffort:''}));setDirty(true);}
    if(mode!=='direct' && (mode==='ccswitch' || value!=='openai'))onMode('direct');
    setFeedback('请选择该厂商的连接方式与模型。API 地址、协议和密钥需与你使用的服务一致。');
  }
  useEffect(()=>{let cancelled=false;fetch('/api/connection/status').then(async response=>{const value=await response.json();if(!response.ok)throw new Error(value.error);if(!cancelled){setConfig({...value,baseUrl:value.baseUrl || 'https://api.openai.com/v1'});if(value.configured){void discoverModels().then(result=>{if(!cancelled){setDiscovered(result.models);setModelsAt(value.baseUrl);setModelMessage(`从 API 获取 ${result.models.length} 个模型。`);}}).catch(e=>{if(!cancelled)setModelMessage(e instanceof Error?e.message:'读取模型失败，可手动填写。');});}}}).catch(e=>{if(!cancelled)setFeedback(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[]);
  async function refreshModels(){
    if(!config.baseUrl.trim()){setModelMessage('请先填写 API 地址。');return;}
    setFetching(true);setModelMessage('正在查询 API /models…');
    try{
      const data=await discoverModels({baseUrl:config.baseUrl.trim(),...key.trim()?{apiKey:key.trim()}:{},clearKey,refresh:true});
      setDiscovered(data.models);setModelsAt(config.baseUrl);
      if(data.models.length && !config.model)setConfig(old=>({...old,model:data.models[0].id}));
      setModelMessage(data.models.length?`从 API 获取 ${data.models.length} 个模型；请选择要使用的模型。`:'服务未返回任何模型，可手动输入模型 ID。');
    }catch(e){setDiscovered([]);setModelMessage((e instanceof Error?e.message:'读取模型失败')+' 可手动填写模型 ID。');}
    finally{setFetching(false);}
  }
  async function save(){
    try{const url=new URL(config.baseUrl);if(!['http:','https:'].includes(url.protocol))throw new Error();}catch{setFeedback('请填写有效的 HTTP 或 HTTPS API 地址。');changePage('api');return;}
    if(!config.model.trim()){setFeedback('请先选择或填写模型 ID。');changePage('models');return;}
    setWorking(true);setFeedback('');try{const response=await fetch('/api/connection/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseUrl:config.baseUrl,model:config.model,protocol:config.protocol,reasoningEnabled:config.reasoningEnabled,...key?{apiKey:key}:{},clearKey})});const value=await response.json();if(!response.ok)throw new Error(value.error);rememberModel(value.model);setConfig(value);setKey('');setClearKey(false);setDirty(false);setFeedback('连接已保存。可在输入框下方切换模型和推理强度，新对话会使用新配置。');onSaved();}catch(e){setFeedback(e instanceof Error?e.message:'保存失败');}finally{setWorking(false);}}
  async function check(){setWorking(true);setFeedback('正在发送真实模型请求…');try{const response=await fetch('/api/connection/check',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(35000)});const value=await response.json();if(!response.ok)throw new Error(value.error);setFeedback(value.message || '检测完成');}catch(e){setFeedback(e instanceof Error?e.message:'检测失败');}finally{setWorking(false);}}
  const locked=busy || working || loading || fetching;
  function safeBack(){if(dirty&&!window.confirm('API 设置存在未保存的修改，确定离开设置吗？'))return;onBack();}
  useEffect(()=>{if(!dirty)return;const handler=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);
  return <div className="strip-connection-settings">
    <button className="strip-btn strip-btn--ghost strip-btn--sm" onClick={safeBack}><ControlIcon name="left"/> 返回对话</button>
    <h1>设置</h1>
    <nav className="strip-settings-tabs strip-settings-tabs--grouped" aria-label="设置分类">
      {settingsGroups.map(group=><div className="strip-settings-tab-group" key={group.label}>
        <span className="strip-settings-tab-group-title">{group.label}</span>
        <div role="tablist" aria-label={group.label}>
          {group.pages.map(item=><button key={item.id} type="button" role="tab" id={pageId+'-tab-'+item.id} aria-controls={pageId+'-'+item.id} aria-selected={page===item.id} tabIndex={page===item.id?0:-1} onClick={()=>changePage(item.id)} onKeyDown={event=>{
            const index=settingsPages.findIndex(entry=>entry.id===item.id);
            const next=event.key==='Home'?0:event.key==='End'?settingsPages.length-1:event.key==='ArrowRight'||event.key==='ArrowDown'?(index+1)%settingsPages.length:event.key==='ArrowLeft'||event.key==='ArrowUp'?(index+settingsPages.length-1)%settingsPages.length:-1;
            if(next<0)return;event.preventDefault();changePage(settingsPages[next].id);
            document.getElementById(pageId+'-tab-'+settingsPages[next].id)?.focus();
          }}>{item.label}</button>)}
        </div>
      </div>)}
    </nav>
    <section className="strip-settings-page" {...panelProps('model')}>
<h2 className="strip-settings-section-title">模型设置</h2><p className="strip-muted">管理模型连接、账号授权及聊天与编程使用的模型。</p>
    <div className="strip-vendor-first"><label>1. 模型厂商<select aria-label="模型厂商" disabled={locked} value={selectedVendor} onChange={event=>chooseVendor(event.target.value)}>{modelVendors.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="strip-muted">{mode==='ccswitch'?'当前厂商按路由模型识别；在下方 CC Switch 中切换供应商。此处选择其他厂商会转为 API 连接。':'先选择厂商，再设置连接并选择模型。其他厂商需提供 OpenAI 兼容接口。'}</p></div>
    <h3 className="strip-settings-step">2. 连接方式</h3>
    <div className="strip-connection-choices" role="group" aria-label="连接方式">
      <button type="button" aria-pressed={mode==='direct'} disabled={locked} onClick={()=>onMode('direct')}><strong>API Key 连接</strong><span>直接连接 OpenAI 或兼容服务。</span></button>
      <button type="button" aria-pressed={mode==='ccswitch'} disabled={locked} onClick={()=>onMode('ccswitch')}><strong>CC Switch</strong><span>使用当前 Codex 本地代理路由。</span></button>
      <button type="button" aria-pressed={mode==='opencode'} disabled={locked} onClick={()=>onMode('opencode')}><strong>ChatGPT 账号</strong><span>Codex CLI 授权与模型目录。</span></button>
    </div>
      <button type="button" className="strip-btn strip-btn--secondary" onClick={()=>changePage('api')}>配置连接</button>
    </section>
    <div className="strip-settings-page" {...panelProps('api')}>
      {mode==='opencode'?<ChatGPTAccount account={account} model={nativeModel} onModel={onNativeModel} onRefresh={onSaved} busy={busy}/>:mode==='ccswitch'?<section className="strip-connection-card"><h2>CC Switch</h2><p>当前模型：<code>{nativeModel || '尚未读取'}</code></p><p>接口：<code>http://127.0.0.1:15721/v1/responses</code></p><p>请在 CC Switch 的 Codex 页面配置并启用 API 供应商。</p><button className="strip-btn strip-btn--secondary" disabled={locked} onClick={()=>{onSaved();setFeedback('已刷新路由。上游认证状态需以真实请求结果为准。');}}>刷新连接</button><p className="strip-muted">代理在线不代表模型认证或额度可用。</p></section>:<form noValidate className="strip-connection-card" onSubmit={event=>{event.preventDefault();changePage('models');}}>
      <h2>API 连接</h2>
      <label>API 地址<input required type="url" disabled={locked} value={config.baseUrl} placeholder="https://api.openai.com/v1" onChange={e=>{setDiscovered([]);setModelsAt('');setConfig({...config,baseUrl:e.target.value});setDirty(true);}}/><small>填写带版本路径的 Base URL，公网地址须使用 HTTPS。</small></label>
      <label>协议类型<select disabled={locked} value={config.protocol} onChange={e=>{setConfig({...config,protocol:e.target.value,reasoningEnabled:false,reasoningEffort:''});setDirty(true);}}><option value="responses">Responses</option><option value="openai">Chat Completions</option></select></label>
      <label>API Key<input type="password" autoComplete="off" spellCheck={false} disabled={locked} value={key} placeholder={config.hasKey?'已保存密钥，留空保持不变':'填写此 API 服务的密钥'} onChange={e=>{setDiscovered([]);setKey(e.target.value);setDirty(true);}} onBlur={()=>{ /* Credentials are only sent after an explicit discovery or save action. */ }}/><small>密钥使用 Windows 用户加密保存，不会回显。更换 API 地址需重新填写密钥。</small></label>
      {config.hasKey && <label className="strip-key-clear"><input type="checkbox" disabled={locked} checked={clearKey} onChange={e=>{if(e.target.checked&&!window.confirm('确定要在下次保存时清除已保存的 API Key 吗？'))return;setClearKey(e.target.checked);setDirty(true);}}/>清除已保存密钥（用于无需认证的本机接口）</label>}
      <button type="submit" className="strip-btn strip-btn--secondary">下一步：选择模型</button>
      </form>}
    </div>
    <div className="strip-settings-page" {...panelProps('models')}>
      {mode==='direct'?<form noValidate className="strip-connection-card" onSubmit={event=>{event.preventDefault();void save();}}>
      <h2>可用模型</h2>
      <div className="strip-api-discovery-bar"><strong>模型目录</strong><button className="strip-btn strip-btn--secondary strip-btn--sm" type="button" disabled={locked || !config.baseUrl.trim()} onClick={()=>void refreshModels()}>{fetching?'正在读取…':'从 API 获取模型'}</button></div>
      {modelMessage && <p className="strip-api-discovery-status" role="status">{modelMessage}</p>}
      <label>模型<select aria-label="API 模型选择" disabled={locked} value={config.model} onChange={e=>{setConfig({...config,model:e.target.value,reasoningEffort:''});setDirty(true);}}><option value="">选择模型 / 手动填写</option>{availableModels.map(id=><option key={id} value={id}>{discovered.find(item=>item.id===id)?.name && discovered.find(item=>item.id===id)?.name!==id?discovered.find(item=>item.id===id)?.name+' · '+id:id}</option>)}</select><input aria-label="API 模型 ID" required disabled={locked} value={config.model} placeholder="也可以手动填写准确模型 ID" onChange={e=>{setConfig({...config,model:e.target.value,reasoningEffort:''});setDirty(true);}}/><small>来自当前 API 的实时模型会优先显示；历史模型 ID 仅供参考。保存后即可从聊天输入框直接切换模型。</small></label>
      <label className="strip-key-clear"><input type="checkbox" disabled={locked} checked={config.reasoningEnabled} onChange={e=>{setConfig({...config,reasoningEnabled:e.target.checked,reasoningEffort:''});setDirty(true);}}/>允许发送兼容推理强度参数（可选）</label>
      <p className="strip-muted strip-api-reasoning-note">开启后可在 Codex 风格的推理强度滑条中选择「轻度 / 中 / 高 / 极高 / Ultra」。仅适用于支持 reasoning.effort 或 reasoning_effort 的服务，其他服务可能报参数错误。此设置不能改变服务商的实际生成 tok/s。</p>
      <div className="strip-connection-actions"><button type="submit" className="strip-btn strip-btn--primary" disabled={locked}>{working?'正在处理…':'保存连接'}</button><button type="button" className="strip-btn strip-btn--secondary" disabled={locked || dirty || !config.configured} onClick={()=>void check()}>检测真实请求</button></div>
      <p className="strip-muted">检测会向所填服务发送一条简短请求，可能产生少量用量费用。聊天与编程共用此连接。</p>
      </form>:<section className="strip-connection-card"><h2>可用模型</h2>
        {mode==='opencode'?<><p>{account.connected?'已授权 ChatGPT 账号':'请先在 API 连接页完成授权。'}</p><label>ChatGPT 模型<select aria-label="可用 ChatGPT 模型" value={nativeModel} disabled={locked || !account.connected} onChange={event=>onNativeModel(event.target.value)}>{account.models.map(item=><option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label></>:<><p>当前 CC Switch 模型：<code>{nativeModel || '尚未读取'}</code></p><p className="strip-muted">在 CC Switch 中切换供应商和模型，然后刷新连接。</p></>}
        <button type="button" className="strip-btn strip-btn--secondary" disabled={locked} onClick={onSaved}>刷新模型</button>
      </section>}
    </div>
    <div className="strip-settings-page" {...panelProps('performance')}>
    <section className="strip-connection-card" aria-label="显示与性能"><h2>显示与性能</h2>
      <label>文字显示速度 <output>{displayRate.rate===null?'不限速（最高）':displayRate.rate+' tok/s'}</output><input aria-label="文字显示速度" type="range" min="10" max="210" step="10" value={displayRate.rate ?? 210} onChange={event=>displayRate.commit(Number(event.target.value)===210?null:Number(event.target.value))}/><small>默认最高档，不限制文字显示；此选项不改变模型实际生成速度。</small></label>
      {displayRate.error && <p role="alert">{displayRate.error}</p>}
      <p>当前模型：<code>{nativeModel || '尚未选择'}</code></p>
      <p>调用渠道：{mode==='opencode'?'ChatGPT · Codex CLI':mode==='ccswitch'?'CC Switch':'API Key 连接'}</p>
      <p className="strip-muted">{metrics?.model===nativeModel && metrics.provider===({opencode:'Codex CLI · ChatGPT',ccswitch:'CC Switch',direct:'API 连接'})[mode]?`最近会话实测：${metrics.tokensPerSecond==null?'速率未测量':'≈ '+metrics.tokensPerSecond.toFixed(1)+' tok/s'} · 首输出 ${metrics.ttftMs==null?'未测量':Math.round(metrics.ttftMs)+' ms'}`:'当前模型暂无测速数据。'} 推理强度以模型实际提供的档位为准。</p>
    </section>
    </div>
    <div className="strip-settings-page" {...panelProps('project')}>
    <section className="strip-connection-card strip-workspace-settings" aria-label="项目设置"><h2>项目设置</h2><label>项目目录<input aria-label="项目目录" value={workspace} disabled={workspaceLocked} onChange={event=>onWorkspace(event.target.value)} placeholder="选择 G:\p 内的项目目录"/></label><p className="strip-muted">新对话使用此目录；已有会话保留绑定目录。文件与命令仍逐次审批。</p></section>
    </div>
    <div className="strip-settings-page" {...panelProps('diagnostics')}><SettingsDiagnostics mode={mode} workspace={workspace} configured={config.configured} hasKey={config.hasKey} model={config.model} onRefresh={onSaved}/></div>
    <div className="strip-settings-page" {...panelProps('appearance')}>{appearanceSettings || <p className="strip-muted">当前环境未提供外观设置。</p>}</div>
    {page==='nono' && <div className="strip-settings-page" {...panelProps('nono')}><NonoPluginSettings/></div>}
    {feedback && <div className="strip-connection-feedback" role="status">{feedback}<button type="button" aria-label="关闭连接提示" onClick={()=>setFeedback('')}><ControlIcon name="close" size={16}/></button></div>}
    <p className="strip-muted">切换连接后使用新对话；旧会话记录和工具审批保持保留。</p>
  </div>;
}
