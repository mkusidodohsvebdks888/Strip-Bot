import {useCallback,useEffect,useState} from 'react';
import './integrations-tool.css';
import {StripButton} from '../ui/StripButton';

type Integration = {id:string;label:string;type:'local'|'remote';enabled:boolean;command?:string[];cwd?:string;url?:string};
type RequestResult = {ok?:boolean;error?:string;message?:string};
async function request<T>(url:string, data?:unknown):Promise<T>{
  const response=await fetch(url,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

export function IntegrationsTool(){
  const [items,setItems]=useState<Integration[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [info,setInfo]=useState('');
  const [error,setError]=useState('');
  const [name,setName]=useState('');
  const [id,setId]=useState('');
  const [type,setType]=useState<'local'|'remote'>('local');
  const [command,setCommand]=useState('["node", "D:\\\\projects\\\\my-app\\\\mcp-server.js"]');
  const [cwd,setCwd]=useState('');
  const [url,setUrl]=useState('http://127.0.0.1:3001/mcp');
  const [showForm,setShowForm]=useState(false);
  const [filter,setFilter]=useState<'all'|'enabled'|'disabled'>('all');
  const refresh=useCallback(async()=>{
    const data=await request<{items:Integration[]}>('/api/integrations');
    setItems(data.items);
  },[]);
  useEffect(()=>{let alive=true;request<{items:Integration[]}>('/api/integrations').then(data=>{if(alive){setItems(data.items);setError('');}}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return ()=>{alive=false;};},[]);
  async function operate(fn:()=>Promise<RequestResult>,done:string){
    if(busy)return;
    setBusy(true);setError('');setInfo('');
    try {await fn();await refresh();setDirty(true);setInfo(done+'；点击「应用到 Agent」使其生效。');}
    catch(e){setError(e instanceof Error ? e.message:'操作失败');}
    finally{setBusy(false);}
  }
  const add=async(event:React.FormEvent)=>{
    event.preventDefault();
    let payload:Record<string,unknown>={id:id.trim(),label:name.trim(),type};
    if(type==='local'){
      try{payload.command=JSON.parse(command);}catch{setError('命令必须是 JSON 数组，例如 ["node", "D:\\\\projects\\\\my-app\\\\mcp.js"]。');return;}
      if(cwd.trim()) payload.cwd=cwd.trim();
    }else payload.url=url.trim();
    await operate(()=>request('/api/integrations',payload),'项目连接已保存（默认关闭）');
  };
  const toggle=(item:Integration)=>{
    const next=!item.enabled;
    if(next && !window.confirm(`启用「${item.label}」后，AI 可以发现并请求调用它提供的工具。外部项目可能读取数据、修改文件或执行操作，请只启用你信任的项目。是否继续？`))return;
    void operate(()=>request('/api/integrations/enable',{id:item.id,enabled:next,confirmed:next}),next?'已启用':'已禁用');
  };
  const remove=(item:Integration)=>{
    if(!window.confirm(`移除项目连接「${item.label}」？不会删除项目本身。`))return;
    void operate(()=>request('/api/integrations/remove',{id:item.id,confirmed:true}),'连接已移除');
  };
  const reload=async()=>{
    if(busy)return;
    setBusy(true);setError('');setInfo('');
    try{const result=await request<RequestResult>('/api/integrations/reload',{});setDirty(false);setInfo(result.message || '项目工具配置已应用。');}
    catch(e){setError(e instanceof Error?e.message:'应用失败');}
    finally{setBusy(false);}
  };
  const visibleItems=items.filter(item=>filter==='all'||(filter==='enabled'?item.enabled:!item.enabled));
  return <section className="strip-tool-content strip-integrations" aria-label="项目工具连接">
    <div className="strip-integrations__intro"><div><span className="strip-integrations__eyebrow">MODEL CONTEXT PROTOCOL</span><h3>MCP 服务器</h3><p className="strip-tool-description">连接本地或远程工具服务，授权 Agent 使用。</p></div><StripButton size="sm" variant="primary" aria-expanded={showForm} aria-controls="strip-mcp-create" onClick={()=>setShowForm(value=>!value)}>{showForm?'收起表单':'+ 添加服务器'}</StripButton></div>
    <div className="strip-integrations__summary"><div className="strip-integrations__metric"><strong>{items.length}</strong><span>服务器总数</span></div><div className="strip-integrations__metric"><strong>{items.filter(x=>x.enabled).length}</strong><span>已启用</span></div><div className="strip-integrations__metric"><strong>{items.filter(x=>!x.enabled).length}</strong><span>未启用</span></div></div>
    <div className="strip-integrations__filters" role="group" aria-label="筛选 MCP 服务器">{([["all","全部"],["enabled","已启用"],["disabled","未启用"]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    {loading && <p className="strip-tool-note">读取连接列表中…</p>}
    {!loading && !items.length && <p className="strip-tool-note">还没有连接项目。请在下方新增一个 MCP 服务器。</p>}
    {visibleItems.map(item=><div key={item.id} className="strip-integrations__item">
      <div className="strip-integrations__item-head"><strong>{item.label}</strong><span className={'strip-integrations__badge'+(item.enabled?' is-enabled':'')}>{item.enabled?'已启用':'未启用'}</span></div>
      <div className="strip-integrations__detail" title={item.type==='local'?item.command?.join(' '):item.url}><span className="strip-integrations__protocol">{item.type==='local'?'STDIO':'HTTP'}</span><code>{item.type==='local'?item.command?.join(' '):item.url}</code></div>
      <div className="strip-integrations__item-buttons"><StripButton size="sm" variant={item.enabled?'secondary':'primary'} disabled={busy} onClick={()=>toggle(item)}>{item.enabled?'停用':'启用'}</StripButton><StripButton size="sm" variant="danger" disabled={busy} onClick={()=>remove(item)}>移除</StripButton></div>
    </div>)}
    <StripButton variant="primary" className="strip-integrations__apply" disabled={busy || loading} onClick={()=>void reload()}>应用到 Agent {dirty?'· 待更新':''}</StripButton>
    {showForm && <div id="strip-mcp-create" className="strip-integrations__create"><h3 className="strip-tool-section-heading">新增 MCP 服务器</h3>
    <form className="strip-integrations__form" onSubmit={event=>void add(event)}>
      <label className="strip-tool-label" htmlFor="strip-integ-name">项目名称</label>
      <input id="strip-integ-name" className="strip-tool-input" value={name} maxLength={64} onChange={event=>setName(event.target.value)} placeholder="例如：我的桌面玩偶" required/>
      <label className="strip-tool-label" htmlFor="strip-integ-id">工具标识（英文）</label>
      <input id="strip-integ-id" className="strip-tool-input" value={id} onChange={event=>setId(event.target.value)} placeholder="desktop_pet" pattern="[a-z][a-z0-9_-]{1,39}" required/>
      <label className="strip-tool-label" htmlFor="strip-integ-type">连接方式</label>
      <select id="strip-integ-type" className="strip-tool-input" value={type} onChange={event=>setType(event.target.value as 'local'|'remote')}><option value="local">本地 MCP 进程 (stdio)</option><option value="remote">MCP HTTP 服务</option></select>
      {type==='local'?<>
        <label className="strip-tool-label" htmlFor="strip-integ-command">启动命令（JSON 数组，不经过 Shell）</label>
        <textarea id="strip-integ-command" className="strip-tool-input" rows={3} spellCheck={false} value={command} onChange={event=>setCommand(event.target.value)} required/>
        <label className="strip-tool-label" htmlFor="strip-integ-cwd">工作目录（可选，绝对路径）</label>
        <input id="strip-integ-cwd" className="strip-tool-input" value={cwd} onChange={event=>setCwd(event.target.value)} placeholder="D:\\projects\\my-app"/>
      </>:<>
        <label className="strip-tool-label" htmlFor="strip-integ-url">MCP Streamable HTTP 地址</label>
        <input id="strip-integ-url" className="strip-tool-input" value={url} onChange={event=>setUrl(event.target.value)} required/>
      </>}
      <StripButton type="submit" variant="primary" disabled={busy}>保存连接</StripButton>
    </form></div>}
    {info && <p className="strip-integrations__feedback" role="status">{info}</p>}
    {error && <p className="strip-integrations__feedback is-error" role="alert">{error}</p>}
    <p className="strip-tool-note">连接默认关闭；启用后需点击“应用到 Agent”。已有任务运行时不能重新加载。普通 REST API 需要先封装为 MCP 服务，不能直接填在这里。工具执行仍由 Agent 权限策略控制。</p>
  </section>;
}
