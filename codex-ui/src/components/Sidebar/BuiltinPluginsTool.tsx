import {useCallback,useEffect,useState} from 'react';
import {Icon} from '../../Icons';
import {workspaceRequest as call,shortError} from './workspace-api';
import './extension-workspace.css';

type PluginAction={id:string;label:string};
type Plugin={id:string;name?:string;description?:string;category?:string;enabled:boolean;available:boolean;
  actions?:PluginAction[];detail?:{dependency?:string;command?:string;description?:string;installed?:boolean;supported?:boolean};
  runtime?:{running:boolean;state:string;error:string};error?:string};
type Form={action:string;input:string;output:string};
const CATEGORY_ORDER=['desktop-pet','archive','document'];
const CATEGORY_NAMES:Record<string,string>={'desktop-pet':'桌面宠物','archive':'文件压缩与解压','document':'文档与 PDF 转换'};
const FILE_PLUGINS=new Set(['archive-7zip','office-pdf']);

export function BuiltinPluginsTool(){
  const [items,setItems]=useState<Plugin[]>([]);
  const [forms,setForms]=useState<Record<string,Form>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const refresh=useCallback(async()=>{
    const result=await call<{items:Plugin[]}>('/api/plugins/bundled');
    setItems(result.items);
  },[]);
  useEffect(()=>{void refresh().catch(e=>setError(shortError(e)));},[refresh]);
  const change=(id:string,key:keyof Form,value:string)=>{
    setForms(previous=>({...previous,[id]:{
      action:previous[id]?.action||items.find(p=>p.id===id)?.actions?.[0]?.id||'',
      input:previous[id]?.input||'',output:previous[id]?.output||'',[key]:value
    }}));
  };
  async function toggle(item:Plugin){
    const next=!item.enabled;
    if(!window.confirm((next?'启用':'停用')+'「'+(item.name||item.id)+'」插件？'+(item.id==='nono-desktop'?'（会启动或关闭桌宠窗口）':'')))return;
    setBusy(true);setError('');setMessage('');
    try{
      await call('/api/plugins/bundled/enable',{id:item.id,enabled:next,confirmed:true});
      await refresh();
      setMessage(next?'插件已启用。':'插件已停用。');
    }catch(e){setError(shortError(e));}finally{setBusy(false);}
  }
  async function execute(item:Plugin){
    const isPet=item.id==='deepseek-harness-pet';
    const state=forms[item.id]||{action:item.actions?.[0]?.id||'',input:'',output:''};
    if(!isPet&&(!state.input.trim()||!state.output.trim())){
      setError('请输入源文件和输出位置的绝对路径。');return;
    }
    const prompt=isPet
      ? '确认启动已安装的 DeepSeek Harness 桌宠？不会下载软件或安装依赖。'
      : '确认执行「'+item.name+'」？\n功能：'+state.action+'\n读取：'+state.input+'\n输出：'+state.output;
    if(!window.confirm(prompt))return;
    setBusy(true);setError('');setMessage('');
    try{
      const result=await call<{message:string;output?:string}>('/api/plugins/bundled/execute',{
        id:item.id,action:isPet?'launch':state.action,
        ...(isPet?{}:{input:state.input.trim(),output:state.output.trim()}),confirmed:true
      });
      setMessage(result.message+(result.output?' 路径：'+result.output:''));
    }catch(e){setError(shortError(e));}finally{setBusy(false);}
  }
  const groups=CATEGORY_ORDER.map(category=>({
    category,items:items.filter(item=>item.category===category)
  })).filter(group=>group.items.length>0);
  return <section className="strip-tool-content strip-extension" aria-label="StripBot 插件管理">
    <p className="strip-tool-description">将桌宠、7-Zip 和 LibreOffice 统一归入插件管理。各插件独立启停，文件操作和启动程序需要单独确认。</p>
    <div className="strip-ext-banner"><Icon name="package"/><span><strong>插件中心</strong><small>桌宠 · 解压缩 · PDF 转换</small></span><span className="strip-ext-counter">{items.length}</span></div>
    {groups.map(group=><div key={group.category} className="strip-ext-form">
      <h3 className="strip-tool-section-heading">{CATEGORY_NAMES[group.category]}</h3>
      {group.items.map(item=>{
        const state=forms[item.id]||{action:item.actions?.[0]?.id||'',input:'',output:''};
        return <div className="strip-ext-card" key={item.id}>
          <div className="strip-ext-card-head">
            <strong>{item.name||item.id}</strong>
            <span className={'strip-ext-state'+(item.enabled?' is-on':'')}>{item.enabled?'已启用':'未启用'}</span>
          </div>
          <p className="strip-ext-sub">{item.description}</p>
          {item.detail&&<p className="strip-ext-mini">{item.detail.description}
            {item.detail.command&&<><br/>运行入口：{item.detail.command}</>}
          </p>}
          {item.runtime&&<p className="strip-ext-mini">桌宠状态：{item.runtime.running?'运行中':item.runtime.state||'未运行'}{item.runtime.error?' · '+item.runtime.error:''}</p>}
          {!item.available&&<p className="strip-ext-warning">{item.error||'当前设备不支持，或插件文件不完整。'}</p>}
          <div className="strip-ext-actions">
            <button type="button" disabled={busy||!item.available} onClick={()=>void toggle(item)}>{item.enabled?'停用插件':'启用插件'}</button>
          </div>
          {item.enabled&&item.available&&item.id==='deepseek-harness-pet'&&
            <button className="strip-tool-action" type="button" disabled={busy} onClick={()=>void execute(item)}>启动桌宠</button>}
          {item.enabled&&item.available&&FILE_PLUGINS.has(item.id)&&<div className="strip-ext-form">
            <label htmlFor={'plugin-action-'+item.id}>插件功能</label>
            <select id={'plugin-action-'+item.id} value={state.action} onChange={e=>change(item.id,'action',e.target.value)}>
              {item.actions?.map(action=><option key={action.id} value={action.id}>{action.label}</option>)}
            </select>
            <label htmlFor={'plugin-input-'+item.id}>输入文件 / 文件夹绝对路径</label>
            <input id={'plugin-input-'+item.id} value={state.input} onChange={e=>change(item.id,'input',e.target.value)} placeholder="C:/Files/example.docx"/>
            <label htmlFor={'plugin-output-'+item.id}>{item.id==='office-pdf'?'PDF 输出文件夹':state.action==='extract'?'解压输出文件夹':'压缩包输出路径（.7z 或 .zip）'}</label>
            <input id={'plugin-output-'+item.id} value={state.output} onChange={e=>change(item.id,'output',e.target.value)} placeholder="C:/Files/output"/>
            <button className="strip-tool-action" type="button" disabled={busy} onClick={()=>void execute(item)}>确认并执行</button>
          </div>}
        </div>;
      })}
    </div>)}
    {!items.length&&<p className="strip-tool-empty">当前没有发现本地插件。</p>}
    <button type="button" className="strip-tool-action" disabled={busy} onClick={()=>void refresh().catch(e=>setError(shortError(e)))}>刷新插件状态</button>
    {message&&<p className="strip-ext-feedback" role="status">{message}</p>}
    {error&&<p className="strip-ext-feedback is-error" role="alert">{error}</p>}
    <p className="strip-tool-note">糯糯通过现有桌宠运行时启停；DeepSeek Harness 桌宠须先安装本地可信 EXE；7-Zip 和 LibreOffice 需要各自的本地命令行程序。本页面不会自动下载安装第三方程序，也不会自动授权 AI 执行。</p>
  </section>;
}
