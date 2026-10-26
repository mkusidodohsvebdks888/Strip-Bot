import {useCallback,useEffect,useMemo,useState} from 'react';
import {Icon} from '../../Icons';
import {workspaceRequest as call,shortError} from './workspace-api';
import './builtin-plugins.css';

type PluginAction={id:string;label:string};
type Plugin={
  id:string;name?:string;description?:string;category?:string;
  enabled:boolean;available:boolean;actions?:PluginAction[];
  detail?:{dependency?:string;command?:string;description?:string;installed?:boolean;supported?:boolean};
  runtime?:{running:boolean;state:string;error:string};error?:string;
};
type Form={action:string;input:string;output:string};
type Filter='all'|'enabled'|'disabled';

const CATEGORIES=[
  {id:'desktop-pet',label:'桌面宠物'},
  {id:'archive',label:'文件与压缩'},
  {id:'document',label:'文档转换'}
] as const;
const PLUGIN_META:Record<string,{icon:string;summary:string}>={
  'nono-desktop':{icon:'bot',summary:'桌面陪伴与交互'},
  'deepseek-harness-pet':{icon:'sparkles',summary:'Q版蓝发鲸鱼娘 · 动画、漫游和互动'},
  'archive-7zip':{icon:'package',summary:'压缩和解压本地文件'},
  'office-pdf':{icon:'file',summary:'Office 文档转 PDF'}
};
const FILE_PLUGINS=new Set(['archive-7zip','office-pdf']);
const FILTERS:{id:Filter;name:string}[]=[
  {id:'all',name:'全部'},
  {id:'enabled',name:'已启用'},
  {id:'disabled',name:'未启用'}
];

function statusOf(plugin:Plugin){
  if(!plugin.available || plugin.detail?.supported===false)return '不可用';
  if(plugin.runtime?.running)return '运行中';
  if(plugin.detail?.installed===false)return '待安装';
  if(plugin.enabled)return plugin.id==='deepseek-harness-pet'?'已启用 · 未启动':'已启用';
  return '未启用';
}
function initialForm(plugin:Plugin):Form{
  return {action:plugin.actions?.[0]?.id||'',input:'',output:''};
}

export function BuiltinPluginsTool(){
  const [items,setItems]=useState<Plugin[]>([]);
  const [forms,setForms]=useState<Record<string,Form>>({});
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [expanded,setExpanded]=useState<string|null>(null);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  const refresh=useCallback(async()=>{
    setLoading(true);
    setError('');
    try{
      const result=await call<{items:Plugin[]}>('/api/plugins/bundled');
      setItems(result.items);
    }catch(cause){
      setError(shortError(cause));
    }finally{
      setLoading(false);
    }
  },[]);
  useEffect(()=>{void refresh();},[refresh]);

  const countEnabled=items.filter(item=>item.enabled).length;
  const visible=useMemo(()=>{
    const search=query.trim().toLocaleLowerCase();
    return items.filter(item=>{
      if(filter==='enabled'&&!item.enabled)return false;
      if(filter==='disabled'&&item.enabled)return false;
      if(!search)return true;
      const category=CATEGORIES.find(cat=>cat.id===item.category)?.label||'';
      return [item.name,item.id,item.description,PLUGIN_META[item.id]?.summary,category]
        .some(value=>value?.toLocaleLowerCase().includes(search));
    });
  },[items,filter,query]);

  function updateForm(id:string,key:keyof Form,value:string){
    setForms(previous=>{
      const selected=items.find(item=>item.id===id);
      const current=previous[id]||initialForm(selected||{id,enabled:false,available:false});
      return {...previous,[id]:{...current,[key]:value}};
    });
  }

  async function toggle(plugin:Plugin){
    const enabled=!plugin.enabled;
    setBusyId(plugin.id);setError('');setMessage('');
    try{
      await call('/api/plugins/bundled/enable',{id:plugin.id,enabled,confirmed:true});
      const updated=await call<{items:Plugin[]}>('/api/plugins/bundled');
      setItems(updated.items);
    }catch(cause){setError(shortError(cause));}
    finally{setBusyId(null);}
  }

  async function execute(plugin:Plugin){
    const isPet=plugin.id==='deepseek-harness-pet';
    const form=forms[plugin.id]||initialForm(plugin);
    if(!isPet&&(!form.input.trim()||!form.output.trim())){
      setError('请填写输入和输出的本地绝对路径。');
      return;
    }
    const prompt=isPet
      ? plugin.runtime?.running?'确认停止由 StripBot 启动的 DeepSeek Q版桌宠？':'确认启动 DeepSeek Q版桌宠？（首次使用需要先构建本地源码）'
      : '确认执行「'+(plugin.name||plugin.id)+'」？\n动作：'+form.action+
        '\n读取：'+form.input+'\n写入：'+form.output+
        '\n\n请只处理可信文件，插件不会覆盖已存在的目标。';
    if(!window.confirm(prompt))return;
    setBusyId(plugin.id);setError('');setMessage('');
    try{
      const result=await call<{message:string;output?:string}>('/api/plugins/bundled/execute',{
        id:plugin.id,action:isPet?(plugin.runtime?.running?'stop':'launch'):form.action,
        ...(isPet?{}:{input:form.input.trim(),output:form.output.trim()}),
        confirmed:true
      });
      setMessage((result.message||'操作完成。')+(result.output?' 输出：'+result.output:''));
      if(isPet){const updated=await call<{items:Plugin[]}>('/api/plugins/bundled');setItems(updated.items);}
    }catch(cause){setError(shortError(cause));}
    finally{setBusyId(null);}
  }

  return <section className="strip-tool-content strip-plugin-manager" aria-label="本地工具与插件" aria-busy={loading||busyId!==null}>
    <div className="spm-overview">
      <div className="spm-overview__heading">
        <div><strong>本地工具与插件</strong></div>
        <button className="spm-icon-button" type="button" title="刷新插件" aria-label="刷新插件状态" onClick={()=>void refresh()} disabled={loading||busyId!==null}><Icon name="refresh"/></button>
      </div>
      <div className="spm-overview__stats"><span><strong>{countEnabled}</strong> 已启用</span><i aria-hidden="true"/><span><strong>{items.length}</strong> 个插件</span></div>
    </div>

    <label className="spm-search">
      <Icon name="search"/>
      <span className="spm-sr-only">搜索插件</span>
      <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索插件、功能…" autoComplete="off"/>
    </label>

    <div className="spm-filter" role="group" aria-label="按启用状态筛选">
      {FILTERS.map(option=><button key={option.id} type="button" aria-pressed={filter===option.id} onClick={()=>setFilter(option.id)}>{option.name}</button>)}
    </div>

    {error&&<div className="spm-notice spm-notice--error" role="alert">{error}</div>}
    {message&&<div className="spm-notice" role="status">{message}</div>}

    {loading&&items.length===0?<div className="spm-empty" role="status">正在读取插件…</div>:null}
    {!loading&&visible.length===0&&<div className="spm-empty">
      <Icon name="search"/>
      <strong>{items.length===0?'没有找到插件':'没有匹配的插件'}</strong>
      
      {(query||filter!=='all')&&<button type="button" onClick={()=>{setQuery('');setFilter('all');}}>清除筛选</button>}
    </div>}

    <div className="spm-groups">
      {CATEGORIES.map(category=>{
        const plugins=visible.filter(item=>item.category===category.id);
        if(!plugins.length)return null;
        return <section key={category.id} className="spm-group" aria-label={category.label}>
          <div className="spm-group__title"><span>{category.label}</span><small>{plugins.length}</small></div>
          <div className="spm-list">
            {plugins.map(plugin=>{
              const open=expanded===plugin.id;
              const meta=PLUGIN_META[plugin.id]||{icon:'plug',summary:'本地扩展'};
              const state=statusOf(plugin);
              const isBusy=busyId!==null;
              const form=forms[plugin.id]||initialForm(plugin);
              const canToggle=plugin.available&&plugin.detail?.supported!==false;
              return <article key={plugin.id} className={'spm-plugin'+(open?' is-open':'')} data-plugin-id={plugin.id}>
                <div className="spm-plugin__row">
                  <span className="spm-plugin__icon" aria-hidden="true"><Icon name={meta.icon}/></span>
                  <button type="button" className="spm-plugin__select" aria-expanded={open} aria-controls={open?'spm-detail-'+plugin.id:undefined} onClick={()=>setExpanded(open?null:plugin.id)}>
                    <strong>{plugin.name||plugin.id}</strong>
                    <span>{meta.summary}</span>
                  </button>
                  <button type="button" className={'spm-switch'+(plugin.enabled?' is-on':'')} role="switch" aria-checked={plugin.enabled} aria-label={(plugin.enabled?'停用':'启用')+(plugin.name||plugin.id)} title={(plugin.enabled?'停用':'启用')+'插件'} disabled={!canToggle||isBusy} onClick={()=>void toggle(plugin)}>
                    <span aria-hidden="true"/>
                  </button>
                  <button type="button" className="spm-expand" aria-label={(open?'收起':'展开')+(plugin.name||plugin.id)+'详情'} aria-expanded={open} aria-controls={open?'spm-detail-'+plugin.id:undefined} onClick={()=>setExpanded(open?null:plugin.id)}><Icon name={open?'chevron-up':'chevron-down'}/></button>
                </div>
                <div className="spm-plugin__footer"><span className={'spm-status'+(plugin.enabled?' is-on':'')+(state==='不可用'||state==='待安装'?' needs-setup':'')}><span className="spm-status__dot" aria-hidden="true"/>{state}</span><span className="spm-plugin__id">{plugin.id}</span></div>

                {open&&<div className="spm-detail" id={'spm-detail-'+plugin.id}>
                  <p className="spm-detail__desc">{plugin.description||meta.summary}</p>
                  {plugin.error&&<div className="spm-detail__warning">{plugin.error}</div>}
                  {plugin.detail?.description&&<p className="spm-detail__hint">{plugin.detail.description}</p>}
                  {plugin.runtime&&<p className="spm-detail__hint">运行状态：{plugin.runtime.running?'运行中':plugin.runtime.state||'未启动'}{plugin.runtime.error?' · '+plugin.runtime.error:''}</p>}
                  {plugin.detail&&(plugin.detail.dependency||plugin.detail.command)&&<div className="spm-detail__meta">
                    {plugin.detail.dependency&&<div><span>运行依赖</span><strong>{plugin.detail.dependency}</strong></div>}
                    {plugin.detail.command&&<div><span>本地入口</span><code title={plugin.detail.command}>{plugin.detail.command}</code></div>}
                  </div>}
                  
                  {plugin.enabled&&plugin.available&&FILE_PLUGINS.has(plugin.id)&&
                    <div className="spm-form">
                      <label htmlFor={'spm-action-'+plugin.id}>执行操作</label>
                      <select id={'spm-action-'+plugin.id} value={form.action} onChange={event=>updateForm(plugin.id,'action',event.target.value)} disabled={isBusy}>
                        {plugin.actions?.map(action=><option key={action.id} value={action.id}>{action.label}</option>)}
                      </select>
                      <label htmlFor={'spm-input-'+plugin.id}>输入路径</label>
                      <input id={'spm-input-'+plugin.id} value={form.input} placeholder="C:/Files/example.docx" onChange={event=>updateForm(plugin.id,'input',event.target.value)} disabled={isBusy}/>
                      <label htmlFor={'spm-output-'+plugin.id}>{plugin.id==='office-pdf'?'PDF 输出文件夹':form.action==='extract'?'解压到新文件夹':'压缩包输出路径'}</label>
                      <input id={'spm-output-'+plugin.id} value={form.output} placeholder={form.action==='compress'?'C:/Files/example.7z':'C:/Files/output'} onChange={event=>updateForm(plugin.id,'output',event.target.value)} disabled={isBusy}/>
                      <button type="button" className="spm-primary" disabled={isBusy} onClick={()=>void execute(plugin)}><Icon name="play"/>确认并执行</button>
                    </div>}
                  
                </div>}
              </article>;
            })}
          </div>
        </section>;
      })}
    </div>
    <p className="spm-footnote">文件插件需要本地依赖；执行前需确认。</p>
  </section>;
}
