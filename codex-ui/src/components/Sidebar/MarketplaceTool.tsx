import {Button as KitButton} from '../../vendor/codex-ui-kit/Button';
import {useEffect,useState} from 'react';
import './marketplace-tool.css';
type Entry={id:string;name:string;version:string;description:string;repository:string;manifest?:string;endpoint?:string;transport?:string;access?:string};
type Registry={schemaVersion:number;plugins:Entry[];mcpServers:Entry[]};
export function MarketplaceTool({onOpenMcp}:{onOpenMcp?:()=>void}={}){
 const [registry,setRegistry]=useState<Registry|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [installed,setInstalled]=useState<string[]>([]);
 useEffect(()=>{fetch('/api/marketplace').then(async response=>{if(!response.ok)throw new Error('无法加载插件市场');return response.json();}).then(setRegistry).catch(e=>setError(e.message));fetch('/api/marketplace/installed').then(r=>r.json()).then(data=>setInstalled(data.items||[])).catch(()=>{});},[]);
 async function install(entry:Entry,kind:'plugin'|'mcp'){
  if(!window.confirm('确认登记 '+entry.name+'？此操作不会下载或运行第三方代码。'))return;
  setBusy(true);setError('');
  try{const response=await fetch('/api/marketplace/install',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:entry.id,kind})});const data=await response.json();if(!response.ok)throw new Error(data.error||'操作失败');setInstalled(data.items);}
  catch(e){setError(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}
 }
 async function uninstall(id:string){
  setBusy(true);try{const response=await fetch('/api/marketplace/uninstall',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const data=await response.json();if(!response.ok)throw new Error(data.error||'操作失败');setInstalled(data.items);}catch(e){setError(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}
 }
 return <section className="strip-marketplace"><h3>插件与 MCP 市场</h3><p>订阅不会自动安装或运行插件。</p>{error&&<p role="alert">{error}</p>}{!registry&&<p>正在加载市场…</p>}{registry&&<>{([['插件',registry.plugins,'plugin'],['MCP 服务',registry.mcpServers,'mcp']] as const).map(([label,entries,kind])=><div key={kind}><h4>{label}</h4>{entries.length===0&&<p>暂无条目</p>}{entries.map(entry=><article key={entry.id}><div><strong>{entry.name}</strong><span> v{entry.version}</span><p>{entry.description}</p><small>{entry.repository}</small></div><div className="strip-marketplace__actions">{kind==='mcp'&&entry.id==='stripbot-cloud'&&<KitButton tone="primary" size="small" type="button" onClick={onOpenMcp}>连接 MCP</KitButton>}{installed.includes(entry.id)?<KitButton tone="ghost" size="small" disabled={busy} onClick={()=>void uninstall(entry.id)}>移除订阅</KitButton>:<KitButton tone="secondary" size="small" disabled={busy} onClick={()=>void install(entry,kind)}>订阅</KitButton>}</div></article>)}</div>)}</>}</section>;
}
