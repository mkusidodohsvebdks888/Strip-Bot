import {useEffect,useState} from 'react';
import './agent-panel.css';
import {ApprovalPanel, type PermissionDecision, type PermissionRequest} from './Approval/ApprovalPanel';
import type {Config} from '../domain/chat';
type Model = {id:string;providerID:string;name:string};
type Permission = PermissionRequest;
type FormField = {key:string;type:string;title?:string;description?:string;required?:boolean;hidden?:boolean;default?:string|number|boolean|string[];options?:{value:string;label:string}[];when?:{key:string;op:string;value:unknown}[]};
type AgentForm = {id:string;title:string;fields:FormField[]};
type Tool = {type:string;id?:string;name?:string;text?:string;state?:{status:string;input?:unknown;content?:unknown;error?:unknown}};
type Message = {id:string;type:string;text?:string;command?:string;output?:unknown;error?:unknown;content?:Tool[]};
export type Snapshot = {running:boolean;messages:Message[];permissions:Permission[];diff:unknown[];workspace:string;forms:AgentForm[];model?:Model;configurationChanged?:boolean};
type Session = {id:string;title:string};
async function api<T>(route:string,body?:unknown):Promise<T> {
  const response = await fetch('/api/agent'+route,{method:body === undefined ? 'GET':'POST',headers:{'Content-Type':'application/json'},body:body === undefined ? undefined:JSON.stringify(body)});
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
  return value;
}
function saved<T>(key:string,fallback:T):T {try {return JSON.parse(localStorage.getItem(key)||'null') ?? fallback;} catch {return fallback;}}
function pretty(value:unknown) {return typeof value === 'string' ? value : JSON.stringify(value,null,2);}
export function QuestionForm({form,onAnswer}:{form:AgentForm;onAnswer:(answer:Record<string,unknown>) => Promise<void>}) {
  const [answer,setAnswer] = useState<Record<string,unknown>>(() => Object.fromEntries(form.fields.map(f => [f.key,f.default ?? (f.type === 'multiselect' ? []:f.type === 'boolean' ? false:'')])));
  const [error,setError] = useState(''),[submitting,setSubmitting] = useState(false);
  const visible = (f:FormField) => !f.hidden && (f.when || []).every(condition => {
    const value = answer[condition.key],equal = Array.isArray(value) ? value.includes(condition.value):value === condition.value;
    return condition.op === 'eq' ? equal:!equal;
  });
  function set(key:string,value:unknown) {setAnswer(a => ({...a,[key]:value}));}
  return <form className="strip-agent-question" onSubmit={async e => {
    e.preventDefault();setSubmitting(true);
    try {await onAnswer(Object.fromEntries(form.fields.filter(visible).map(f => [f.key,answer[f.key]])));}
    catch(e) {setError(e instanceof Error ? e.message:'答复失败');}finally {setSubmitting(false);}
  }}><strong>{form.title}</strong>{form.fields.filter(visible).map(field => <label key={field.key}>
    <span>{field.title || field.key}</span>{field.description && <small>{field.description}</small>}
    {field.type === 'multiselect' ? field.options?.map(option => <label key={option.value}><input type="checkbox" checked={Array.isArray(answer[field.key]) && (answer[field.key] as string[]).includes(option.value)} onChange={e => set(field.key,e.target.checked ? [...(answer[field.key] as string[]),option.value]:(answer[field.key] as string[]).filter(v => v !== option.value))}/>{option.label}</label>)
      :field.type === 'boolean' ? <input type="checkbox" checked={Boolean(answer[field.key])} onChange={e => set(field.key,e.target.checked)}/>
      :field.options?.length ? <select required={field.required} value={String(answer[field.key] || '')} onChange={e => set(field.key,e.target.value)}><option value="">请选择</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      :<input required={field.required} type={['integer','number'].includes(field.type) ? 'number':'text'} value={String(answer[field.key] ?? '')} onChange={e => set(field.key,['integer','number'].includes(field.type) ? Number(e.target.value):e.target.value)}/>}
  </label>)}{error && <p className="strip-error">{error}</p>}<button className="strip-btn strip-btn--primary" disabled={submitting}>提交答复</button></form>;
}
export function AgentPanel({config,currentModel}:{config:Config;currentModel?:string}) {
  const sessionKey = config.provider === 'ccswitch' ? 'strip_cc_agent_sessions_v1':'strip_agent_sessions_v1';
  const activeKey = config.provider === 'ccswitch' ? 'strip_cc_agent_active_v1':'strip_agent_active_v1';
  const [workspace,setWorkspace] = useState('');
  const [models,setModels] = useState<Model[]>([]),[model,setModel] = useState('');
  const [sessions,setSessions] = useState<Session[]>(() => saved(sessionKey,[]));
  const [active,setActive] = useState<string>(() => saved(activeKey,''));
  const [snapshot,setSnapshot] = useState<Snapshot|null>(null),[draft,setDraft] = useState('');
  const [error,setError] = useState(''),[loading,setLoading] = useState(true),[sending,setSending] = useState(false);
  const [deciding,setDeciding] = useState('');
  const [approvalError,setApprovalError] = useState('');
  useEffect(() => {
    let disposed = false;
    if (active) {setLoading(false);return;}
    setLoading(true);setError('');
    (async () => {
      const status = await api<{installed:boolean;workspace:string}>('/status');
      if (!disposed) setWorkspace(status.workspace);
      if (!status.installed) throw new Error('尚未安装 OpenCode 引擎。');
      await api('/configure',{endpoint:config.endpoint,model:config.model,provider:config.provider});
      const result = await api<{models:Model[]}>('/models');
      if (!disposed) {setModels(result.models);setModel(result.models[0]?.id || '');}
    })().catch(e => {if (!disposed) setError(e.message);}).finally(() => {if (!disposed) setLoading(false);});
    return () => {disposed = true;};
  },[config.endpoint,config.model,config.provider,currentModel,active]);
  useEffect(() => {
    try {localStorage.setItem(sessionKey,JSON.stringify(sessions));localStorage.setItem(activeKey,JSON.stringify(active));} catch {setError('无法保存 Agent 会话索引。');}
  },[sessions,active,sessionKey,activeKey]);
  useEffect(() => {
    setSnapshot(null);
    if (!active) return;
    let disposed = false,timer:ReturnType<typeof setTimeout>;
    async function poll() {
      try {const state = await api<Snapshot>('/sessions/'+active);if (!disposed) setSnapshot(state);}
      catch(e) {if (!disposed) setError(e instanceof Error ? e.message:'读取会话失败');}
      finally {if (!disposed) timer = setTimeout(poll,900);}
    }
    void poll();
    return () => {disposed = true;clearTimeout(timer);};
  },[active]);
  async function send() {
    if (sending || !draft.trim() || !model) return;
    setSending(true);setError('');
    try {
      let id = active;
      if (!id) {
        const selected = models.find(m => m.id === model)!;
        const result = await api<{session:Session}>('/sessions',{workspace,model:{providerID:selected.providerID,id:selected.id},followCurrent:config.provider === 'ccswitch',modelOverride:config.model || undefined,title:draft.trim().slice(0,30)});
        id = result.session.id;
        setSessions(all => [{id,title:result.session.title},...all]);setActive(id);
      }
      await api('/sessions/'+id+'/prompt',{text:draft,followCurrent:config.provider === 'ccswitch'});setDraft('');
    } catch(e) {setError(e instanceof Error ? e.message:'发送失败');}
    finally {setSending(false);}
  }
  async function decide(id:string,decision:PermissionDecision) {
    if (deciding) return;
    setDeciding(id);setApprovalError('');
    try {await api('/sessions/'+active+'/permissions',{requestID:id,decision});setSnapshot(value => value ? {...value,permissions:decision === 'reject' ? [] : value.permissions.filter(p => p.id !== id)}:value);}
    catch(e) {setApprovalError(e instanceof Error ? e.message:'审批失败');}
    finally {setDeciding('');}
  }
  return <section className="strip-agent">
    <header className="strip-agent-header"><strong>编程 Agent · OpenCode</strong><span>{loading ? '正在启动引擎…':snapshot?.permissions.length ? '等待你的审批':snapshot?.running ? '正在执行':'就绪'}</span></header>
    <div className="strip-agent-config">
      <label>项目目录<input value={snapshot?.workspace || workspace} disabled={Boolean(active)} onChange={e => setWorkspace(e.target.value)} /></label>
      <label>模型<input readOnly value={active ? snapshot?.model?.id || '读取任务模型…' : currentModel || model} /></label>
      <button className="strip-btn strip-btn--secondary" disabled={sending || snapshot?.running} onClick={() => {setActive('');setSnapshot(null);setError('');}}>新任务</button>
      {active && <button className="strip-btn strip-btn--secondary" onClick={() => void api('/sessions/'+active+'/interrupt',{}).catch(e => setError(e.message))}>停止任务</button>}
    </div>
    <p className="strip-muted">工具操作逐次审批。模型需要支持工具调用，才能读取文件、修改代码和执行命令。</p>
    {snapshot?.configurationChanged && <p role="status" className="strip-muted">此任务绑定的模型配置已改变，请新建任务；历史记录仍可查看。</p>}
    <nav className="strip-agent-history" aria-label="Agent 任务历史">{sessions.map(s => <button className={`strip-btn ${active === s.id ? 'strip-btn--primary':'strip-btn--secondary'}`} key={s.id} onClick={() => {setActive(s.id);setError('');}}>{s.title}</button>)}</nav>
    {error && <p role="alert" className="strip-error">{error}</p>}
    <div className="strip-agent-timeline">
      {!active && <p className="strip-muted">选择项目目录，描述需要完成的编程任务。</p>}
      {[...(snapshot?.messages || [])].reverse().map(message => <article className="strip-agent-message" key={message.id}>
        <strong>{message.type === 'user' ? '你':message.type === 'assistant' ? 'Agent':message.type}</strong>
        {message.text && <pre>{message.text}</pre>}
        {!!message.error && <pre className="strip-error">{pretty(message.error)}</pre>}
        {message.command && <pre>{message.command}</pre>}
        {!!message.output && <pre>{pretty(message.output)}</pre>}
        {message.content?.map((content,i) => content.type === 'tool' ? <details key={content.id || i} open={content.state?.status !== 'completed'}>
          <summary>{content.name} · {content.state?.status}</summary><pre>{pretty(content.state?.input)}</pre>
          {!!content.state?.content && <pre>{pretty(content.state.content)}</pre>}
          {!!content.state?.error && <pre className="strip-error">{pretty(content.state.error)}</pre>}
        </details>:<pre key={i} className={content.type === 'reasoning' ? 'strip-muted':''}>{content.text}</pre>)}
      </article>)}
      {!!snapshot?.diff?.length && <details><summary>文件变更（{snapshot.diff.length}）</summary><pre>{pretty(snapshot.diff)}</pre></details>}
    </div>
    {!!snapshot?.permissions.length && <ApprovalPanel key={active} permissions={snapshot.permissions} workspace={snapshot.workspace || workspace} deciding={deciding} error={approvalError} onDecision={decide} />}
    {!!snapshot?.forms?.length && <div className="strip-agent-permissions" aria-label="Agent 问题">{snapshot.forms.map(form => <QuestionForm key={form.id} form={form} onAnswer={async answer => {
      await api('/sessions/'+active+'/forms',{formID:form.id,answer});
      setSnapshot(value => value ? {...value,forms:value.forms.filter(f => f.id !== form.id)}:value);
    }}/>)}</div>}
    <form className="strip-agent-composer" onSubmit={e => {e.preventDefault();void send();}}>
      <textarea aria-label="Agent 任务" placeholder="例如：读取 README，创建一个仅用于验收的文件，然后运行测试。" value={draft} maxLength={60000} onChange={e => setDraft(e.target.value)} />
      <button className="strip-btn strip-btn--primary" disabled={loading || sending || snapshot?.running || snapshot?.configurationChanged || !draft.trim() || (!active && !model)}>{sending ? '提交中…':'发送任务'}</button>
    </form>
  </section>;
}
