import {useCallback,useEffect,useState} from 'react';
import {Icon} from '../../Icons';
import {workspaceRequest as call,shortError} from './workspace-api';
import './extension-workspace.css';
type Plugin={id:string;name?:string;description?:string;enabled:boolean;available:boolean;actions?:{id:string;label:string}[];detail?:{dependency:string;command:string;description:string};error?:string};
export function BuiltinPluginsTool(){
  const [items,setItems]=useState<Plugin[]>([]);
  const [forms,setForms]=useState<Record<string,{action:string;input:string;output:string}>>({});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const refresh=useCallback(async()=>{const result=await call<{items:Plugin[]}>('/api/plugins/bundled');setItems(result.items);},[]);
  useEffect(()=>{void refresh().catch(e=>setError(shortError(e)));},[refresh]);
  const change=(id:string,key:'action'|'input'|'output',value:string)=>{
    setForms(prev=>({...prev,[id]:{action:prev[id]?.action||items.find(x=>x.id===id)?.actions?.[0]?.id||'',input:prev[id]?.input||'',output:prev[id]?.output||'',[key]:value}}));
  };
  async function toggle(item:Plugin){
    const enabled=!item.enabled;
    if(!window.confirm((enabled?'启用':'停用')+'插件 '+(item.name||item.id)+'？'))return;
    setBusy(true);setMessage('');setError('');
    try{await call('/api/plugins/bundled/enable',{id:item.id,enabled,confirmed:true});await refresh();setMessage('插件状态已更新。');}
    catch(e){setError(shortError(e));}finally{setBusy(false);}
  }
  async function execute(item:Plugin){
    const data=forms[item.id];
    if(!data?.input.trim()||!data.output.trim()){setError('请填写完整的本地绝对路径。');return;}
    if(!window.confirm('确定运行 '+item.name+'？\n读取：'+data.input+'\n写入：'+data.output+'\n请确保文件可信。'))return;
    setBusy(true);setError('');setMessage('');
    try{const result=await call<{message:string;output:string}>('/api/plugins/bundled/execute',{id:item.id,...data,confirmed:true});setMessage(result.message+' 输出：'+result.output);}
    catch(e){setError(shortError(e));}finally{setBusy(false);}
  }
  return <section className="strip-tool-content strip-extension" aria-label="内置插件">
    <p className="strip-tool-description">7-Zip 和 PDF 转换已改为本地插件。插件默认关闭，启用后每次执行仍需确认。</p>
    <div className="strip-ext-banner"><Icon name="package"/><span><strong>插件中心</strong><small>本地插件 · 无会员 · 无云端 API</small></span><span className="strip-ext-counter">{items.length}</span></div>
    {items.map(item=>{
      const f=forms[item.id]||{action:item.actions?.[0]?.id||'',input:'',output:''};
      return <div key={item.id} className="strip-ext-card">
        <div className="strip-ext-card-head"><strong>{item.name||item.id}</strong><span className={'strip-ext-state'+(item.enabled?' is-on':'')}>{item.enabled?'已启用':'已停用'}</span></div>
        <p className="strip-ext-sub">{item.description}</p>
        <p className="strip-ext-mini">{item.detail?.description||item.error}</p>
        <p className="strip-ext-mini">运行程序：{item.detail?.command||'未检测到'}</p>
        <div className="strip-ext-actions"><button type="button" disabled={busy||!item.available} onClick={()=>void toggle(item)}>{item.enabled?'停用插件':'启用插件'}</button></div>
        {item.enabled&&item.available&&<div className="strip-ext-form">
          <label htmlFor={'plugin-action-'+item.id}>功能</label>
          <select id={'plugin-action-'+item.id} value={f.action} onChange={e=>change(item.id,'action',e.target.value)}>{item.actions?.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select>
          <label htmlFor={'plugin-input-'+item.id}>本地源文件 / 文件夹绝对路径</label>
          <input id={'plugin-input-'+item.id} value={f.input} onChange={e=>change(item.id,'input',e.target.value)} placeholder="C:\文件\输入.docx"/>
          <label htmlFor={'plugin-output-'+item.id}>输出路径（PDF 为文件夹，压缩为 .7z/.zip，解压为新文件夹）</label>
          <input id={'plugin-output-'+item.id} value={f.output} onChange={e=>change(item.id,'output',e.target.value)} placeholder="C:\文件\输出"/>
          <button type="button" className="strip-tool-action" disabled={busy} onClick={()=>void execute(item)}>确认执行</button>
        </div>}
      </div>;
    })}
    <button type="button" className="strip-tool-action" disabled={busy} onClick={()=>void refresh().catch(e=>setError(shortError(e)))}>刷新插件</button>
    {message&&<p className="strip-ext-feedback" role="status">{message}</p>}
    {error&&<p className="strip-ext-feedback is-error" role="alert">{error}</p>}
    <p className="strip-tool-note">需要单独安装免费的 LibreOffice 和 7-Zip 执行程序。仓库内原有目录保留作源码备份。不要对不可信压缩包或文档执行本地插件。</p>
  </section>;
}
