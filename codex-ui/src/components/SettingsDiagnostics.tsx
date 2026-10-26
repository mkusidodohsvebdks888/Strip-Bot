import {useState} from 'react';

type Diagnostic={label:string;state:'ok'|'warn'|'error';detail:string};
type Props={mode:string;workspace:string;configured:boolean;hasKey:boolean;model:string;onRefresh:()=>void};
async function getJson(url:string){
  const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('HTTP '+response.status);
  return response.json();
}
export function SettingsDiagnostics({mode,workspace,configured,hasKey,model,onRefresh}:Props){
  const [results,setResults]=useState<Diagnostic[]>([]);
  const [running,setRunning]=useState(false);
  const [checkedAt,setCheckedAt]=useState('');
  async function diagnose(){
    setRunning(true);
    const items:Diagnostic[]=[];
    try{
      const status=await getJson('/api/connection/status');
      items.push({label:'连接配置',state:status.configured?'ok':'warn',detail:status.configured?'已保存连接':'尚未保存 API 连接'});
      items.push({label:'模型选择',state:status.model?'ok':'warn',detail:status.model||'尚未选择模型'});
      if(mode==='direct')items.push({label:'API 凭据',state:status.hasKey?'ok':'warn',detail:status.hasKey?'已安全保存（不显示密钥）':'未保存密钥；本地免认证接口可忽略'});
    }catch(error){items.push({label:'连接配置',state:'error',detail:error instanceof Error?error.message:'无法读取'});}
    try{
      const data=await getJson('/api/agent/tasks');
      items.push({label:'Agent 任务服务',state:'ok',detail:Array.isArray(data?.tasks)?'服务可用 · '+data.tasks.length+' 项任务':'服务响应正常'});
    }catch(error){items.push({label:'Agent 任务服务',state:'warn',detail:'当前无法读取任务状态：'+(error instanceof Error?error.message:'未知错误')});}
    items.push({label:'当前项目',state:workspace.trim()?'ok':'warn',detail:workspace.trim()||'尚未设置项目目录'});
    setResults(items);setCheckedAt(new Date().toLocaleString());setRunning(false);
  }
  return <section className="strip-connection-card strip-settings-diagnostics" aria-label="设置诊断">
    <div className="strip-settings-diagnostics__header"><h2>设置诊断</h2><button type="button" className="strip-btn strip-btn--secondary strip-btn--sm" disabled={running} onClick={()=>void diagnose()}>{running?'检查中…':'检查当前配置'}</button></div>
    <p className="strip-muted">仅检查本地服务和已保存的配置，不会调用付费模型，也不会读取或显示 API Key。</p>
    <p className="strip-muted">当前连接：{mode==='opencode'?'Codex CLI':mode==='ccswitch'?'CC Switch':'API'} · {configured?'已配置':'未配置'} · {hasKey?'凭据已保存':'无已保存凭据'} · {model||'未选择模型'}</p>
    {checkedAt&&<p className="strip-muted">检查时间：{checkedAt}</p>}
    {results.length>0&&<div role="status">{results.map(item=><p key={item.label}><strong>{item.state==='ok'?'✓':item.state==='warn'?'!':'×'} {item.label}</strong>：{item.detail}</p>)}</div>}
    <button type="button" className="strip-btn strip-btn--ghost strip-btn--sm" onClick={onRefresh}>刷新模型与连接状态</button>
  </section>;
}
