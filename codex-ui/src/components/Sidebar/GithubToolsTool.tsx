import {useCallback,useEffect,useState} from 'react';
import {Icon} from '../../Icons';
import {workspaceRequest as call,shortError} from './workspace-api';
import './extension-workspace.css';

type ToolRepo={id:string;label:string;key:string;url:string;sha:string;folder:string;runtime:'node'|'python'|'unknown';mcpLikely:boolean;launch:string[];scriptNames:string[];packageName:string;envNames:string[];requiresDependencies:boolean;readmeSummary:string};
type McpIntegration={id:string;enabled:boolean;command?:string[]};
export function GithubToolsTool({onOpenSkills}:{onOpenSkills:()=>void}){
  const [repos,setRepos]=useState<ToolRepo[]>([]);
  const [integrations,setIntegrations]=useState<McpIntegration[]>([]);
  const [commands,setCommands]=useState<Record<string,string>>({});
  const [url,setUrl]=useState('');
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [error,setError]=useState('');
  const [info,setInfo]=useState('');
  const refresh=useCallback(async()=>{
    const data=await call<{items:ToolRepo[];integrations:McpIntegration[]}>('/api/github-tools');
    setRepos(data.items);setIntegrations(data.integrations);
    setCommands(current=>Object.fromEntries(data.items.map(item=>[item.id,current[item.id]??JSON.stringify(item.launch)])));
  },[]);
  useEffect(()=>{void refresh().catch(e=>setError(shortError(e)));},[refresh]);
  async function run(fn:()=>Promise<unknown>,success:string,shouldReload=false){
    setBusy(true);setError('');setInfo('');
    try{await fn();await refresh();setInfo(success);if(shouldReload)setDirty(true);}
    catch(e){setError(shortError(e));}finally{setBusy(false);}
  }
  function importRepo(e:React.FormEvent){
    e.preventDefault();
    if(!window.confirm('将下载公开 GitHub 仓库源码到 Strip Bot 本地目录（不会运行代码或安装依赖）。是否继续？'))return;
    void run(()=>call('/api/github-tools/import',{url:url.trim(),confirmed:true}),'仓库下载完成。请审核运行环境和命令后，再注册 MCP 工具。');
  }
  function register(item:ToolRepo){
    let command:unknown;
    try{command=JSON.parse(commands[item.id] || '[]');}catch{setError('启动命令不是有效 JSON 数组。');return;}
    if(!Array.isArray(command)||!command.length){setError('该仓库尚未识别出可运行的 MCP 入口。请阅读 README 后填写实际启动命令。');return;}
    if(!window.confirm(`将 ${item.label} 注册为 MCP 工具（默认禁用）？\n启动命令：${JSON.stringify(command)}\n\n请确保仓库代码可信。`))return;
    void run(()=>call('/api/github-tools/register',{id:item.id,command,confirmed:true}),'已注册 MCP 服务（默认停用）。审查后启用，再应用到 Agent。',true);
  }
  function toggle(item:ToolRepo,integration:McpIntegration){
    const enabled=!integration.enabled;
    if(enabled&&!window.confirm(`启用 ${item.label} 后，OpenCode 可能启动它的程序并向模型提供工具。第三方代码可能访问本机文件或网络。仅在确认信任并配置好依赖后继续。`))return;
    void run(()=>call('/api/integrations/enable',{id:integration.id,enabled,confirmed:enabled}),enabled?'已启用，请应用到 Agent。':'已停用，请应用到 Agent。',true);
  }
  function prepare(item:ToolRepo){
    if(!window.confirm(`为 ${item.label} 安装 Node.js 依赖？\n使用 npm ci/install --ignore-scripts，禁用安装脚本，但仍会下载第三方依赖。请检查仓库来源。`))return;
    void run(()=>call('/api/github-tools/dependencies',{id:item.id,confirmed:true}),'依赖准备完成。若需要编译（例如 TypeScript），请先按仓库文档在可信环境构建。');
  }
  function remove(item:ToolRepo){
    if(!window.confirm(`移除 ${item.label}、本地下载目录以及对应 MCP 注册？请先结束使用该工具的 Agent 任务。`))return;
    void run(()=>call('/api/github-tools/remove',{id:item.id,confirmed:true}),'仓库和对应 MCP 注册已移除；如果 Agent 已启动，请应用更新。',true);
  }
  async function reload(){
    setBusy(true);setError('');setInfo('');
    try{const result=await call<{message:string}>('/api/integrations/reload',{});setInfo(result.message||'已应用到 Agent。');setDirty(false);}
    catch(e){setError(shortError(e));}finally{setBusy(false);}
  }
  return <section className="strip-tool-content strip-extension" aria-label="GitHub 智能体工具">
    <p className="strip-tool-description">导入公开 GitHub 项目，读取说明与依赖，注册为本地 MCP 服务器供 Agent 调用。普通 GitHub 仓库不能自动视作 MCP 工具。</p>
    <div className="strip-ext-banner"><Icon name="package"/><span><strong>GitHub 工具库</strong><small>仓库分析 · 运行配置 · MCP 注册</small></span><span className="strip-ext-counter">{repos.length}</span></div>
    <form className="strip-ext-form" onSubmit={importRepo}>
      <label htmlFor="strip-gh-url">GitHub 仓库地址</label>
      <input id="strip-gh-url" value={url} onChange={e=>setUrl(e.target.value)} required spellCheck={false} placeholder="https://github.com/owner/mcp-server"/>
      <button className="strip-tool-action" type="submit" disabled={busy}><Icon name="download"/> 下载并分析</button>
    </form>
    <p className="strip-ext-sub">如果仓库提供的是 SKILL.md 指令而非 MCP 服务，请使用 <button type="button" className="strip-ext-text-button" onClick={onOpenSkills}>Skills 加入页面 <Icon name="arrow-up-right"/></button>。</p>
    <div className="strip-tool-separator"/>
    <h3 className="strip-tool-section-heading">已导入仓库</h3>
    {!repos.length&&<div className="strip-tool-empty">还没有导入 GitHub 工具。导入后先审查，再授权启动。</div>}
    {repos.map(item=>{
      const integration=integrations.find(x=>x.id==='gh_'+item.id.slice(7));
      return <div className="strip-ext-card" key={item.id}>
        <div className="strip-ext-card-head"><strong>{item.label}</strong><span className={'strip-ext-state'+(integration?.enabled?' is-on':'')}>{integration?.enabled?'已启用':integration?'已注册':'待注册'}</span></div>
        <p className="strip-ext-mini">{item.runtime.toUpperCase()} · {item.mcpLikely?'检测到 MCP 线索':'未确认 MCP 协议'} · commit {item.sha.slice(0,9)}</p>
        <code className="strip-ext-path" title={item.folder}>{item.folder}</code>
        {item.packageName&&<p className="strip-ext-sub">包名：{item.packageName}</p>}
        {!!item.envNames.length&&<details className="strip-ext-details"><summary>环境变量名称（不包含密钥）</summary><p>{item.envNames.join('、')}</p></details>}
        {!!item.scriptNames.length&&<details className="strip-ext-details"><summary>仓库定义的 npm 脚本</summary><p>{item.scriptNames.join('、')}</p></details>}
        {!!item.readmeSummary&&<details className="strip-ext-details"><summary>README 摘要（来自第三方）</summary><pre>{item.readmeSummary}</pre></details>}
        {item.requiresDependencies&&<button type="button" className="strip-tool-action strip-ext-small-action" disabled={busy} onClick={()=>prepare(item)}>准备 Node 依赖（禁用安装脚本）</button>}
        {!item.launch.length&&<p className="strip-ext-warning">没有发现现成的可执行 JS/Python 入口，可能需要手动构建或配置。</p>}
        <label className="strip-ext-inline-label" htmlFor={'strip-gh-command-'+item.id}>本地 MCP 启动命令 · JSON 数组</label>
        <textarea id={'strip-gh-command-'+item.id} spellCheck={false} rows={3} value={commands[item.id]??'[]'} onChange={e=>setCommands(s=>({...s,[item.id]:e.target.value}))}/>
        <div className="strip-ext-actions">
          <button type="button" disabled={busy} onClick={()=>register(item)}>{integration?'更新注册':'注册 MCP'}</button>
          {integration&&<button type="button" className={!integration.enabled?'is-primary':''} disabled={busy} onClick={()=>toggle(item,integration)}>{integration.enabled?'停用':'启用'}</button>}
          <button type="button" disabled={busy} onClick={()=>remove(item)} aria-label={'移除'+item.label}><Icon name="trash-bin-trash"/></button>
        </div>
      </div>;
    })}
    <button type="button" className="strip-tool-action" disabled={busy} onClick={()=>void reload()}><Icon name="refresh"/> 应用到 Agent {dirty?'· 待更新':''}</button>
    {info&&<p className="strip-ext-feedback" role="status">{info}</p>}{error&&<p className="strip-ext-feedback is-error" role="alert">{error}</p>}
    <p className="strip-tool-note">只接受公开 GitHub 仓库；下载不执行源码。启用本地 MCP 后会运行仓库命令，请自行确认许可证、依赖、运行入口、密钥环境变量和权限。并非所有 GitHub 项目都能直接转成 MCP 工具。</p>
  </section>;
}
