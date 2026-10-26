import {useCallback,useEffect,useState} from 'react';
import './integrations-tool.css';
import {StripButton} from '../ui/StripButton';

type Integration = {id:string;label:string;type:'local'|'remote';enabled:boolean;command?:string[];cwd?:string;url?:string};
type RequestResult = {ok?:boolean;error?:string;message?:string};
type Diagnostic = {id:string;configured:boolean;connected:boolean|null;checks:{name:string;ok:boolean|null;message:string}[]};
type CloudState = {registered:boolean;enabled:boolean;credentialsLoaded:boolean;url:string;authentication:string};
async function request<T>(url:string, data?:unknown):Promise<T>{
  const response=await fetch(url,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}


type ServiceCategory='business'|'data'|'monitoring'|'code';
function classifyMcpTool(name:string,description:string):ServiceCategory{
  const value=(name+' '+description).toLowerCase();
  if(/(?:write_file|edit_file|apply_patch|git_commit|git_push|source.code|source_code|modify.code|terminal|shell|exec_command|run_command|install_dependency)/.test(value))return 'code';
  if(/(?:database|sql|query|record|table|user|order|customer|inventory|data)/.test(value))return 'data';
  if(/(?:health|status|log|metric|monitor|cpu|memory|uptime|trace)/.test(value))return 'monitoring';
  return 'business';
}
const serviceCategoryLabel:Record<ServiceCategory,string>={business:'业务功能',data:'数据服务',monitoring:'运行监控',code:'代码与系统操作（非业务控制）'};

export function IntegrationsTool(){
  const [items,setItems]=useState<Integration[]>([]);
  const [cloudToken,setCloudToken]=useState('');
  const [cloudState,setCloudState]=useState<CloudState|null>(null);
  const [toolArguments,setToolArguments]=useState<Record<string,string>>({});
  const [toolOutputs,setToolOutputs]=useState<Record<string,string>>({});
  const [projectTabs,setProjectTabs]=useState<Record<string,'overview'|'services'|'permissions'>>({});
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
  const [query,setQuery]=useState('');
  const [expanded,setExpanded]=useState<string[]>([]);
  const [copied,setCopied]=useState<string|null>(null);
  const [importText,setImportText]=useState('');
  const [showImport,setShowImport]=useState(false);
  const [selectedImport,setSelectedImport]=useState('');
  const [diagnostics,setDiagnostics]=useState<Record<string,Diagnostic>>({});
  const [inspecting,setInspecting]=useState<string|null>(null);
  const [probeResults,setProbeResults]=useState<Record<string,string>>({});
  const [discoveredTools,setDiscoveredTools]=useState<Record<string,{name:string;description:string}[]>>({});
  const [toolListIncomplete,setToolListIncomplete]=useState<Record<string,boolean>>({});
  const [toolPermissions,setToolPermissions]=useState<Record<string,Record<string,string>>>({});
  const [approvalDialog,setApprovalDialog]=useState<{requestId:string;server:string;tool:string;expiresAt:number}|null>(null);
  const [approvalBusy,setApprovalBusy]=useState(false);
  const [showSensitiveConfig,setShowSensitiveConfig]=useState(false);
  const refresh=useCallback(async()=>{
    const data=await request<{items:Integration[]}>('/api/integrations');
    setItems(data.items);
  },[]);
  useEffect(()=>{let alive=true;request<{items:Integration[]}>('/api/integrations').then(data=>{if(alive){setItems(data.items);setError('');}}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return ()=>{alive=false;};},[]);
  useEffect(()=>{let active=true;request<CloudState>('/api/integrations/cloud/status').then(data=>{if(active)setCloudState(data);}).catch(()=>{});return ()=>{active=false;};},[]);
  const connectCloud=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(busy||cloudToken.trim().length<24){setError('请输入 Render 中生成的完整 MCP Token（至少24位）');return;}
    if(!window.confirm('确认连接 StripBot Cloud？Token 仅放在当前本地程序内存，不会上传 GitHub 或保存到磁盘。'))return;
    setBusy(true);setError('');setInfo('');
    try{
      await request('/api/integrations/cloud/connect',{token:cloudToken.trim(),confirmed:true});
      setCloudToken('');
      await refresh();
      setCloudState(await request<CloudState>('/api/integrations/cloud/status'));
      setInfo('云端已连接，请测试握手。');
    }catch(e){setError(e instanceof Error?e.message:'云端连接失败');}
    finally{setBusy(false);}
  };
  async function operate(fn:()=>Promise<RequestResult>,done:string){
    if(busy)return;
    setBusy(true);setError('');setInfo('');
    try {await fn();await refresh();setDirty(true);setInfo(done+'；点击「应用到 Agent」使其生效。');}
    catch(e){setError(e instanceof Error ? e.message:'操作失败');}
    finally{setBusy(false);}
  }
  const inspect=async(item:Integration)=>{
    if(inspecting)return;
    setInspecting(item.id);setError('');
    try{const result=await request<Diagnostic>('/api/integrations/inspect',{id:item.id});setDiagnostics(previous=>({...previous,[item.id]:result}));}
    catch(e){setError(e instanceof Error?e.message:'诊断失败');}
    finally{setInspecting(null);}
  };
  const probe=async(item:Integration)=>{
    if(inspecting)return;
    if(!window.confirm(item.type==='local'?'将启动本地 MCP 程序并读取工具列表，可能运行外部代码。请仅测试可信项目。是否继续？':'将向 MCP HTTPS 服务发送认证握手并读取工具列表（不执行工具），是否继续？'))return;
    setInspecting(item.id);setError('');
    try{const result=await request<{connected:boolean;protocolVersion:string;tools:{name:string;description:string}[];hasMore?:boolean}>('/api/integrations/probe',{id:item.id,confirmed:true});setProbeResults(current=>({...current,[item.id]:result.connected?'握手成功 · 协议 '+result.protocolVersion:'连接失败'}));setDiscoveredTools(current=>({...current,[item.id]:result.tools||[]}));
      const policies=await request<{tools:Record<string,string>}>('/api/integrations/permissions',{id:item.id});setToolPermissions(current=>({...current,[item.id]:policies.tools}));setToolListIncomplete(current=>({...current,[item.id]:result.hasMore===true}));}
    catch(e){setProbeResults(current=>({...current,[item.id]:'连接失败'}));setError(e instanceof Error?e.message:'连接失败');}
    finally{setInspecting(null);}
  };
  const callBusinessTool=async(item:Integration,tool:string)=>{
    const key=item.id+':'+tool;
    const isCloudStatus=item.type==='remote'&&item.id==='stripbot_cloud'&&tool==='service_status';
    if(item.type==='remote'&&!isCloudStatus){setError('其他远程服务器禁止直接执行工具。');return;}
    let args:unknown;
    try{args=JSON.parse(toolArguments[key]||'{}');if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('参数必须是 JSON 对象');}
    catch(e){setError(e instanceof Error?e.message:'JSON 参数无效');return;}
    if(!window.confirm(isCloudStatus?'确认查询云端 MCP 的只读状态？':'确认调用本地业务工具 '+tool+'？该操作可能改变业务数据。'))return;
    setInspecting(item.id);setError('');
    try{const result=await request<{result:unknown}>('/api/integrations/service/call',{id:item.id,tool,arguments:args,confirmed:true});setToolOutputs(current=>({...current,[key]:JSON.stringify(result.result,null,2)}));}
    catch(e){setError(e instanceof Error?e.message:'MCP 工具调用失败');}
    finally{setInspecting(null);}
  };
  const changePermission=async(item:Integration,tool:string,mode:string)=>{
    try{await request('/api/integrations/permission',{id:item.id,tool,mode});setToolPermissions(current=>({...current,[item.id]:{...(current[item.id]||{}),[tool]:mode}}));setInfo('工具权限已保存。');setError('');}
    catch(e){setError(e instanceof Error?e.message:'权限保存失败');}
  };
  const previewApproval=async(item:Integration,tool:string)=>{
    if(approvalBusy||approvalDialog)return;
    setApprovalBusy(true);setError('');
    try{
      const result=await request<{requestId:string|null;reason:string;expiresAt?:number}>('/api/integrations/approval/request',{id:item.id,tool});
      if(result.requestId&&result.expiresAt)setApprovalDialog({requestId:result.requestId,server:item.label,tool,expiresAt:result.expiresAt});
      else setInfo(result.reason==='permitted'?'该工具已设置为允许，无需批准。':'当前策略不允许发起批准请求。');
    }catch(e){setError(e instanceof Error?e.message:'创建批准请求失败');}
    finally{setApprovalBusy(false);}
  };
  const decidePreview=async(allow:boolean)=>{
    if(!approvalDialog||approvalBusy)return;
    setApprovalBusy(true);setError('');
    try{
      const result=await request<{allowed:boolean;reason:string}>('/api/integrations/approval/decide',{requestId:approvalDialog.requestId,allow});
      setInfo(result.allowed?'允许预览已记录（未执行）':'拒绝预览已记录（未执行）');
      setApprovalDialog(null);
    }catch(e){setError(e instanceof Error?e.message:'提交批准决定失败');setApprovalDialog(null);}
    finally{setApprovalBusy(false);}
  };
  const copyConfig=async(item:Integration)=>{
    if(!window.confirm(`复制「${item.label}」的连接配置？配置可能包含访问令牌、私有路径或认证参数，请勿分享给不可信的人。`))return;
    const config=item.type==='local'?{command:item.command,cwd:item.cwd}:{url:item.url};
    try{await navigator.clipboard.writeText(JSON.stringify({id:item.id,label:item.label,type:item.type,...config},null,2));setCopied(item.id);setInfo('连接配置已复制，请妥善保管。');setError('');}
    catch{setError('无法访问剪贴板，请检查系统权限。');}
  };
  const importConfig=()=>{
    try{
      const parsed:unknown=JSON.parse(importText);
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('配置必须是 JSON 对象');
      const data=parsed as Record<string,unknown>;
      const servers=data.mcpServers;
      const source=servers&&typeof servers==='object'&&!Array.isArray(servers)?Object.entries(servers).find(([name])=>name===selectedImport):null;
      if(servers&&typeof servers==='object'&&!Array.isArray(servers)&&!source)throw new Error('请先选择要导入的服务器');
      const raw=source?source[1]:data;
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('没有找到 MCP 服务器配置');
      const config=raw as Record<string,unknown>;
      const nextId=String(source?.[0]||data.id||'').trim();
      if(!/^[a-z][a-z0-9_-]{1,39}$/.test(nextId))throw new Error('服务器标识需要 2–40 个小写字母、数字、下划线或连字符');
      const nextName=String(config.label||data.label||nextId).trim();
      if(!nextName||nextName.length>64)throw new Error('服务器名称长度不符合要求');
      if(typeof config.url==='string'){
        const target=new URL(config.url);
        if(!['http:','https:'].includes(target.protocol))throw new Error('仅支持 HTTP 或 HTTPS');
        setType('remote');setUrl(config.url);
      }else{
        const cmd=typeof config.command==='string'?[config.command,...(Array.isArray(config.args)?config.args:[])]:config.command;
        if(!Array.isArray(cmd)||!cmd.length||!cmd.every(part=>typeof part==='string'&&part.trim()))throw new Error('启动命令格式无效');
        setType('local');setCommand(JSON.stringify(cmd,null,2));setCwd(typeof config.cwd==='string'?config.cwd:'');
      }
      setId(nextId);setName(nextName);setShowForm(true);setShowImport(false);setError('');
      setInfo('配置已填入，请确认后保存。');
    }catch(e){setError(e instanceof Error?e.message:'无法识别 JSON 配置');}
  };
  const add=async(event:React.FormEvent)=>{
    event.preventDefault();
    let payload:Record<string,unknown>={id:id.trim(),label:name.trim(),type};
    if(type==='local'){
      try{const parsed:unknown=JSON.parse(command);if(!Array.isArray(parsed)||parsed.length===0||!parsed.every(part=>typeof part==='string'&&part.trim()))throw new Error('invalid');payload.command=parsed;}catch{setError('启动命令必须是非空 JSON 字符串数组，例如 ["node", "server.js"]。');return;}
      if(cwd.trim()) payload.cwd=cwd.trim();
    }else {
      try{const target=new URL(url.trim());if(!['http:','https:'].includes(target.protocol)||!target.hostname)throw new Error('invalid');}catch{setError('请输入有效的 HTTP 或 HTTPS MCP 服务地址。');return;}
      payload.url=url.trim();
    }
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
  const redact=(value:string)=>value.replace(/(bearer\s+)[^\s]+/gi,'$1••••').replace(/((?:token|key|secret|password|authorization)[=:]\s*)[^\s&,]+/gi,'$1••••');
  const importChoices=(()=>{try{const value:unknown=JSON.parse(importText);if(value&&typeof value==='object'&&!Array.isArray(value)){const servers=(value as Record<string,unknown>).mcpServers;if(servers&&typeof servers==='object'&&!Array.isArray(servers))return Object.keys(servers);}return [];}catch{return [];}})();
  const search=query.trim().toLocaleLowerCase();
  const visibleItems=items.filter(item=>(filter==='all'||(filter==='enabled'?item.enabled:!item.enabled))&&(!search||[item.id,item.label,item.type,item.type==='local'?item.command?.join(' '):item.url].some(value=>value?.toLocaleLowerCase().includes(search))));
  const projectGroups=Object.entries(visibleItems.reduce<Record<string,Integration[]>>((groups,item)=>{
    let key:string;
    if(item.type==='local')key=item.cwd?.trim()?('本地项目 · '+item.cwd.trim()):('独立本地服务 · '+item.label);
    else{try{key='远程项目 · '+new URL(item.url||'').origin;}catch{key='远程项目 · '+item.label;}}
    (groups[key]??=[]).push(item);
    return groups;
  },{}));
  return <section className="strip-tool-content strip-integrations" aria-label="项目工具连接">
    {approvalDialog&&<div className="strip-integrations__approval-backdrop"><div className="strip-integrations__approval-dialog" role="dialog" aria-modal="true" aria-labelledby="strip-mcp-approval-title"><h3 id="strip-mcp-approval-title">MCP 工具批准预览</h3><p>服务器：{approvalDialog.server}</p><p>工具：<code>{approvalDialog.tool}</code></p><p>有效期至：{new Date(approvalDialog.expiresAt).toLocaleTimeString()}</p><p className="strip-tool-note">仅预览，不执行工具。</p><div className="strip-integrations__approval-actions"><StripButton variant="secondary" disabled={approvalBusy} onClick={()=>void decidePreview(false)}>拒绝</StripButton><StripButton variant="primary" disabled={approvalBusy} onClick={()=>void decidePreview(true)}>允许一次（演示）</StripButton></div></div></div>}
    <div className="strip-integrations__intro"><div><span className="strip-integrations__eyebrow">MODEL CONTEXT PROTOCOL</span><h3>项目与 MCP 连接</h3></div><StripButton size="sm" variant="primary" aria-expanded={showForm} aria-controls="strip-mcp-create" onClick={()=>setShowForm(value=>!value)}>{showForm?'收起表单':'+ 添加服务器'}</StripButton></div>
    <section className="strip-integrations__cloud" aria-label="StripBot Render 云端连接">
      <div className="strip-integrations__cloud-heading"><div><strong>StripBot Cloud · Render</strong><p>HTTPS · 只读</p></div><span className="strip-integrations__cloud-status">{cloudState?.credentialsLoaded?'Token 已载入':cloudState?.registered?'需要重新输入 Token':'尚未连接'}</span></div>
      <code>https://stripbot-mcp-v2.onrender.com/mcp</code>
      <form className="strip-integrations__cloud-form" onSubmit={event=>void connectCloud(event)}>
        <label htmlFor="strip-cloud-token">Render Token</label>
        <div className="strip-integrations__cloud-input"><input id="strip-cloud-token" type="password" autoComplete="off" value={cloudToken} minLength={24} maxLength={512} onChange={event=>setCloudToken(event.target.value)} placeholder="粘贴 Render 环境变量中设置的 Token"/><StripButton type="submit" variant="primary" disabled={busy||cloudToken.length<24}>{cloudState?.registered?'更新 Token / 重新连接':'连接云端 MCP'}</StripButton></div>
      </form>
      <p className="strip-tool-note">Token 仅在本次运行中保存；重启后需重新输入。</p>
    </section>
    <div className="strip-integrations__summary"><div className="strip-integrations__metric"><strong>{items.length}</strong><span>服务器总数</span></div><div className="strip-integrations__metric"><strong>{items.filter(x=>x.enabled).length}</strong><span>已启用</span></div><div className="strip-integrations__metric"><strong>{items.filter(x=>!x.enabled).length}</strong><span>未启用</span></div></div>
    <div className="strip-integrations__filters" role="group" aria-label="筛选 MCP 服务器">{([["all","全部"],["enabled","已启用"],["disabled","未启用"]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    <label className="strip-integrations__sensitive-toggle"><input type="checkbox" checked={showSensitiveConfig} onChange={event=>setShowSensitiveConfig(event.target.checked)}/>显示完整连接参数（可能包含敏感信息）</label>
    <label className="strip-integrations__search-label" htmlFor="strip-mcp-search">搜索服务器</label>
    <input id="strip-mcp-search" type="search" className="strip-integrations__search" placeholder="按名称、标识或地址搜索" value={query} onChange={event=>setQuery(event.target.value)}/>
    {loading && <p className="strip-tool-note">读取连接列表中…</p>}
    {!loading && !items.length && <p className="strip-tool-note">还没有连接项目。请在下方新增一个 MCP 服务器。</p>}
    {!loading && items.length>0 && visibleItems.length===0 && <p className="strip-tool-note">没有符合条件的 MCP 服务器。</p>}
    {projectGroups.map(([project,servers])=><section key={project} className="strip-integrations__project"><header className="strip-integrations__project-head"><div><span className="strip-integrations__eyebrow">PROJECT</span><h4>{project}</h4><p>{servers.length} 个服务 · {servers.filter(server=>server.enabled).length} 个已启用</p></div></header><nav className="strip-integrations__project-tabs" aria-label={`${project} 管理视图`}>{([['overview','项目概览'],['services','功能与数据'],['permissions','权限与诊断']] as const).map(([tab,label])=><button key={tab} type="button" aria-pressed={(projectTabs[project]||'overview')===tab} onClick={()=>setProjectTabs(current=>({...current,[project]:tab}))}>{label}</button>)}</nav><div className="strip-integrations__project-servers">{servers.map(item=><div key={item.id} className="strip-integrations__item">
      <div className="strip-integrations__item-head"><strong>{item.label}</strong><span className={'strip-integrations__badge'+(item.enabled?' is-enabled':'')}>{item.enabled?'已启用':'未启用'}</span></div>
      {(projectTabs[project]||'overview')==='overview'&&<div className="strip-integrations__detail"><span className="strip-integrations__protocol">{item.type==='local'?'STDIO':'HTTP'}</span><code>{showSensitiveConfig?(item.type==='local'?item.command?.join(' '):item.url):redact(item.type==='local'?item.command?.join(' ')||'':item.url||'')}</code></div>}
      <div className="strip-integrations__item-buttons"><StripButton size="sm" variant="ghost" aria-expanded={expanded.includes(item.id)} aria-controls={`strip-mcp-detail-${item.id}`} onClick={()=>setExpanded(current=>current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id])}>{expanded.includes(item.id)?'收起详情':'查看详情'}</StripButton><StripButton size="sm" variant={item.enabled?'secondary':'primary'} disabled={busy} onClick={()=>toggle(item)}>{item.enabled?'停用':'启用'}</StripButton><StripButton size="sm" variant="secondary" disabled={inspecting!==null} onClick={()=>void probe(item)}>{item.type==='local'?'测试本地 MCP':'测试远程握手'}</StripButton><StripButton size="sm" variant="ghost" disabled={inspecting!==null} onClick={()=>void inspect(item)}>{inspecting===item.id?'诊断中…':'检查配置'}</StripButton><StripButton size="sm" variant="ghost" onClick={()=>void copyConfig(item)}>{copied===item.id?'已复制':'复制配置'}</StripButton><StripButton size="sm" variant="danger" disabled={busy} onClick={()=>remove(item)}>移除</StripButton></div>
      {(projectTabs[project]||'overview')==='services'&& !discoveredTools[item.id]&&<p className="strip-tool-note">点击「测试握手」查看工具。</p>}
      {(projectTabs[project]||'overview')==='services'&&discoveredTools[item.id]&&<div className="strip-integrations__diagnostic"><strong>发现的工具（{discoveredTools[item.id].length}{toolListIncomplete[item.id]?'，还有更多':''}）</strong>{discoveredTools[item.id].map((tool,index)=><div key={tool.name+index}><span>{tool.name} · {serviceCategoryLabel[classifyMcpTool(tool.name,tool.description)]}</span><small>{tool.description}</small>{((item.type==='local'&&classifyMcpTool(tool.name,tool.description)!=='code')||(item.type==='remote'&&item.id==='stripbot_cloud'&&tool.name==='service_status'))&&<div className="strip-integrations__service-call">{item.type==='local'&&<textarea rows={2} aria-label={`${tool.name} JSON 参数`} placeholder="工具参数 JSON，例如 {}" value={toolArguments[item.id+':'+tool.name]??'{}'} onChange={event=>setToolArguments(current=>({...current,[item.id+':'+tool.name]:event.target.value}))}/>}<StripButton size="sm" variant="secondary" disabled={inspecting!==null||!item.enabled||(toolPermissions[item.id]?.[tool.name]||'ask')!=='allow'} onClick={()=>void callBusinessTool(item,tool.name)}>{item.type==='remote'?'查询云端状态':'调用业务工具'}</StripButton>{toolOutputs[item.id+':'+tool.name]&&<pre>{toolOutputs[item.id+':'+tool.name]}</pre>}</div>}{classifyMcpTool(tool.name,tool.description)==='code'&&<small>代码与系统工具不允许在这里调用。</small>}{item.enabled&&(toolPermissions[item.id]?.[tool.name]||'ask')==='ask'&&<StripButton size="sm" variant="ghost" disabled={approvalBusy} onClick={()=>void previewApproval(item,tool.name)}>预览批准</StripButton>}<label className="strip-integrations__permission">权限<select value={toolPermissions[item.id]?.[tool.name]||'ask'} onChange={event=>void changePermission(item,tool.name,event.target.value)}><option value="ask">每次询问</option><option value="allow">允许</option><option value="deny">禁止</option></select></label></div>)}</div>}
      {probeResults[item.id]&&<p className="strip-integrations__feedback" role="status">{probeResults[item.id]}</p>}
      {(projectTabs[project]||'overview')==='permissions'&&diagnostics[item.id]&&<div className="strip-integrations__diagnostic" role="status"><strong>配置诊断（不执行连接）</strong>{diagnostics[item.id].checks.map(check=><div key={check.name}><span>{check.ok===true?'✓':check.ok===false?'!':'·'} {check.name}</span><small>{check.message}</small></div>)}</div>}
      {(projectTabs[project]||'overview')==='permissions'&&expanded.includes(item.id)&&<div id={`strip-mcp-detail-${item.id}`} className="strip-integrations__expanded"><div><span>服务器标识</span><code>{item.id}</code></div><div><span>传输协议</span><code>{item.type==='local'?'stdio':'Streamable HTTP'}</code></div>{item.cwd&&<div><span>工作目录</span><code>{item.cwd}</code></div>}</div>}
    </div>)}</div></section>)}
    <StripButton variant="primary" className="strip-integrations__apply" disabled={busy || loading} onClick={()=>void reload()}>应用到 Agent {dirty?'· 待更新':''}</StripButton>
    <div className="strip-integrations__import-toggle"><StripButton size="sm" variant="ghost" aria-expanded={showImport} aria-controls="strip-mcp-import" onClick={()=>setShowImport(value=>!value)}>{showImport?'收起导入':'从 JSON 导入配置'}</StripButton></div>
    {showImport && <div id="strip-mcp-import" className="strip-integrations__create"><label className="strip-tool-label" htmlFor="strip-mcp-import-json">粘贴单个服务器配置或 mcpServers JSON</label><textarea id="strip-mcp-import-json" className="strip-integrations__import-input" rows={6} spellCheck={false} value={importText} onChange={event=>setImportText(event.target.value)}/>{importChoices.length>0&&<><label className="strip-tool-label" htmlFor="strip-mcp-import-select">选择服务器（共 {importChoices.length} 个）</label><select id="strip-mcp-import-select" className="strip-integrations__import-select" value={selectedImport} onChange={event=>setSelectedImport(event.target.value)}><option value="">请选择服务器</option>{importChoices.map(name=><option key={name} value={name}>{name}</option>)}</select></>}<StripButton size="sm" variant="primary" onClick={importConfig} disabled={!importText.trim()||(importChoices.length>0&&!selectedImport)}>解析并填入表单</StripButton></div>}
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
    <p className="strip-tool-note">连接启用不代表工具已获授权；云端只读工具不会自动开放给 Agent。</p>
  </section>;
}
