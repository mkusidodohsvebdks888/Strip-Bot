import {useCallback,useEffect,useState} from 'react';
import {Icon} from '../../Icons';
import {workspaceRequest as call,shortError} from './workspace-api';
import './extension-workspace.css';

type Backend={id:string;label:string;path:string;apiUrl:string;frameworks:string[];databases:string[]};
type Inspection={path:string;apiUrl:string;frameworks:string[];databases:string[];sampleRoutes:string[];entrypoints:string[];envNames:string[];filesScanned:number;needs:string[]};
export function BackendProjectsTool({onSelect,disabled,modelName}:{onSelect:(path:string)=>void;disabled:boolean;modelName:string}){
  const [items,setItems]=useState<Backend[]>([]);
  const [folder,setFolder]=useState('');
  const [name,setName]=useState('');
  const [url,setUrl]=useState('');
  const [analysis,setAnalysis]=useState<Inspection|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [info,setInfo]=useState('');
  const refresh=useCallback(async()=>setItems((await call<{items:Backend[]}>('/api/backend-projects')).items),[]);
  useEffect(()=>{void refresh().catch(e=>setError(shortError(e)));},[refresh]);
  async function work(fn:()=>Promise<unknown>,message=''){
    setBusy(true);setError('');setInfo('');
    try{await fn();if(message)setInfo(message);}catch(e){setError(shortError(e));}finally{setBusy(false);}
  }
  const inspect=(e:React.FormEvent)=>{e.preventDefault();void work(async()=>setAnalysis(await call<Inspection>('/api/backend-projects/inspect',{path:folder.trim(),url:url.trim()})),'分析完成 · 已分析项目结构信息');};
  const connect=()=>{
    if(!analysis)return;
    if(!window.confirm(`允许 Strip Bot 在 Agent 工作区访问以下本地后端源码？\n${analysis.path}\n\nAgent 写入文件仍通过会话权限审批。`))return;
    void work(async()=>{await call('/api/backend-projects/connect',{path:analysis.path,label:name.trim(),url:url.trim(),confirmed:true});await refresh();},'已授权该项目；点击「切换工作区」即可让 Agent 读取与修改源码。');
  };
  const remove=(item:Backend)=>{
    if(!window.confirm(`取消「${item.label}」的本地项目授权？不会删除源码或数据库；已建立的会话仍绑定原项目。`))return;
    void work(async()=>{await call('/api/backend-projects/remove',{id:item.id,confirmed:true});await refresh();},'已取消新会话的项目授权；已建立的会话请单独停止或删除。');
  };
  const health=(item:Backend)=>void work(async()=>{
    const result=await call<{ok:boolean;message:string}>('/api/backend-projects/health',{id:item.id});
    setInfo(`${item.label} · ${result.message}`);
  });
  return <section className="strip-tool-content strip-extension" aria-label="本地后端连接">
    <p className="strip-tool-description">读取本地项目结构，识别后端所需信息，并授权 Agent 在该项目中开发。运行中 API 需另外填写本机地址。</p>
    <div className="strip-ext-banner"><Icon name="server"/><span><strong>本地后端</strong><small>源码授权 · 环境识别 · API 连通性</small></span><span className="strip-ext-counter">{items.length}</span></div>
    <p className="strip-ext-sub">当前模型：{modelName || '尚未选择模型'}。外部工具调用需要模型支持 function/tool calling；Strip Bot 无法仅凭模型名称断定其具备此能力。</p>
    <h3 className="strip-tool-section-heading">已授权项目</h3>
    {items.length===0&&<div className="strip-tool-empty">尚未接入后端。先填写源码目录并点击「分析项目」。</div>}
    {items.map(item=><div key={item.id} className="strip-ext-card">
      <div className="strip-ext-card-head"><strong>{item.label}</strong><span className="strip-ext-state">已授权</span></div>
      <code className="strip-ext-path" title={item.path}>{item.path}</code>
      <p className="strip-ext-mini">{[...item.frameworks,...item.databases].join(' · ') || '未识别框架'}{item.apiUrl?' · API 已填写':''}</p>
      <div className="strip-ext-actions"><button type="button" className="is-primary" disabled={disabled||busy} onClick={()=>onSelect(item.path)}>切换工作区</button>{!!item.apiUrl&&<button type="button" disabled={busy} onClick={()=>health(item)}>测试 API</button>}<button type="button" disabled={busy} onClick={()=>remove(item)} aria-label={'移除'+item.label}><Icon name="trash-bin-trash"/></button></div>
    </div>)}
    <div className="strip-tool-separator"/>
    <h3 className="strip-tool-section-heading">接入新的本地后端</h3>
    <form className="strip-ext-form" onSubmit={inspect}>
      <label htmlFor="strip-backend-folder">后端源码目录 <span>必填</span></label>
      <input id="strip-backend-folder" value={folder} onChange={e=>{setFolder(e.target.value);setAnalysis(null);}} placeholder="D:\\projects\\my-backend" required spellCheck={false}/>
      <label htmlFor="strip-backend-name">项目显示名称 <span>选填</span></label>
      <input id="strip-backend-name" value={name} onChange={e=>setName(e.target.value)} placeholder="例如：用户管理后端"/>
      <label htmlFor="strip-backend-api">本机 API 探测地址 <span>选填</span></label>
      <input id="strip-backend-api" value={url} onChange={e=>setUrl(e.target.value)} placeholder="http://127.0.0.1:8080/actuator/health" spellCheck={false}/>
      <button className="strip-tool-action" type="submit" disabled={busy}><Icon name="search"/> 分析项目结构</button>
    </form>
    {analysis&&<div className="strip-ext-results" aria-live="polite">
      <h3><Icon name="check"/> 项目识别结果</h3>
      <div className="strip-ext-metric">扫描源文件 <strong>{analysis.filesScanned}</strong></div>
      <div className="strip-ext-metric">技术框架 <strong>{analysis.frameworks.join(' / ') || '未发现'}</strong></div>
      <div className="strip-ext-metric">数据库线索 <strong>{analysis.databases.join(' / ') || '未发现'}</strong></div>
      {!!analysis.entrypoints.length&&<details><summary>项目配置入口 · {analysis.entrypoints.length}</summary><ul>{analysis.entrypoints.map(x=><li key={x}>{x}</li>)}</ul></details>}
      {!!analysis.sampleRoutes.length&&<details><summary>静态识别的路由 · {analysis.sampleRoutes.length}</summary><ul>{analysis.sampleRoutes.map(x=><li key={x}>{x}</li>)}</ul></details>}
      {!!analysis.envNames.length&&<details><summary>可能需要的环境变量名称 · {analysis.envNames.length}</summary><p>仅显示变量名称，不读取真实密钥值。</p><ul>{analysis.envNames.map(x=><li key={x}>{x}</li>)}</ul></details>}
      <h4>完整接入所需信息</h4><ul>{analysis.needs.map(x=><li key={x}>{x}</li>)}</ul>
      <button className="strip-tool-action" type="button" disabled={busy} onClick={connect}><Icon name="plug"/> 授权连接此项目</button>
    </div>}
    {info&&<p className="strip-ext-feedback" role="status">{info}</p>}{error&&<p className="strip-ext-feedback is-error" role="alert">{error}</p>}
    <p className="strip-tool-note">安全范围：仅分析部分源码与配置名称；不会执行后端代码、读取 .env 值、自动连接数据库或部署生产服务。授权后可作为 Agent 工作区使用。</p>
  </section>;
}
