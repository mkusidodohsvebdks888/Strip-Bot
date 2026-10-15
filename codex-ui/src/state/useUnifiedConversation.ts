import {useEffect,useRef,useState} from 'react';
import type {Snapshot} from '../components/AgentPanel';
import type {PermissionDecision} from '../components/Approval/ApprovalPanel';
import type {Chat} from '../domain/chat';
import {readStored,restoreChats} from './chat-storage.mjs';

type Session = {id:string;title:string;updatedAt?:number;legacyId?:string};
const SESSION_KEY = 'strip_cc_agent_sessions_v1', ACTIVE_KEY = 'strip_unified_active_v1';
async function api<T>(route:string,body?:unknown):Promise<T> {
  const response = await fetch('/api/agent'+route,{method:body === undefined ? 'GET':'POST',headers:{'Content-Type':'application/json'},body:body === undefined ? undefined:JSON.stringify(body)});
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
  return value;
}
export function useUnifiedConversation() {
  const [sessions,setSessions] = useState<Session[]>(() => {
    const cc = readStored<Session[]>(localStorage,SESSION_KEY,[]);
    const local = localStorage.getItem('strip_unified_migrated_v1') === '1' ? []:readStored<Session[]>(localStorage,'strip_agent_sessions_v1',[]);
    return Array.from(new Map([...Array.isArray(cc) ? cc:[],...Array.isArray(local) ? local:[]].filter(s=>s && /^ses_[a-zA-Z0-9]+$/.test(s.id) && typeof s.title === 'string').map(s=>[s.id,s])).values());
  });
  const [legacyChats,setLegacyChats] = useState<Chat[]>(() => restoreChats(localStorage));
  const [active,setActive] = useState(() => {const value = readStored<unknown>(localStorage,ACTIVE_KEY,'');return typeof value === 'string' ? value:'';});
  const [snapshot,setSnapshot] = useState<Snapshot|null>(null);
  const [workspace,setWorkspace] = useState('');
  const [drafts,setDrafts] = useState<Record<string,string>>(() => {
    const value=readStored<unknown>(localStorage,'strip_unified_drafts_v1',{});
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([,v])=>typeof v === 'string')):{};
  });
  const [error,setError] = useState(''),[approvalError,setApprovalError] = useState(''),[sending,setSending] = useState(false),[loading,setLoading] = useState(false),[deciding,setDeciding] = useState('');
  const sendingRef = useRef(false),activeRef = useRef(active),runningRef = useRef<string|null>(null);
  const cancelRequested = useRef(false);
  activeRef.current = active;
  const legacy = active.startsWith('legacy:') ? legacyChats.find(c=>c.id === active.slice(7)) : undefined;
  const selected = sessions.find(s=>s.id === active);
  const legacyContext = legacy || (selected?.legacyId ? legacyChats.find(c=>c.id === selected.legacyId):undefined);
  const draft = drafts[active] || '';
  const setDraft = (value:string) => setDrafts(all=>({...all,[active]:value}));
  const busy = sending || Boolean(snapshot?.running);
  const busySession = sending ? active : snapshot?.running ? active : runningRef.current;
  useEffect(() => {api<{workspace:string}>('/status').then(s=>setWorkspace(s.workspace)).catch(e=>setError(e.message));},[]);
  useEffect(() => {
    try {localStorage.setItem(SESSION_KEY,JSON.stringify(sessions));localStorage.setItem(ACTIVE_KEY,JSON.stringify(active));localStorage.setItem('strip_unified_migrated_v1','1');}
    catch {setError('无法保存会话索引，请检查存储空间。');}
  },[sessions,active]);
  useEffect(()=>{try {localStorage.setItem('strip_unified_drafts_v1',JSON.stringify(drafts));} catch {setError('无法保存草稿，请检查存储空间。');}},[drafts]);
  useEffect(() => {
    setSnapshot(null);setError('');setApprovalError('');
    if (!/^ses_/.test(active)) {setLoading(false);return;}
    let disposed = false,timer:ReturnType<typeof setTimeout>;
    setLoading(true);
    const poll = async () => {
      try {
        const result = await api<Snapshot>('/sessions/'+active);
        if (!disposed) {setSnapshot(result);if (result.running) runningRef.current = active;else if (runningRef.current === active) runningRef.current = null;}
      } catch(e) {if (!disposed) setError(e instanceof Error ? e.message:'读取对话失败');}
      finally {if (!disposed) {setLoading(false);timer = setTimeout(poll,800);}}
    };
    void poll();return () => {disposed = true;clearTimeout(timer);};
  },[active]);
  function select(id:string) {if (sendingRef.current) return;setActive(id);}
  function newConversation(preservedDraft?:string) {if (sendingRef.current) return;if(preservedDraft !== undefined)setDrafts(all=>({...all,'':preservedDraft}));setActive('');setSnapshot(null);setError('');}
  async function send(text:string,files:File[] = []) {
    if (sendingRef.current || snapshot?.running || (!text.trim() && !files.length) || !workspace) return;
    sendingRef.current = true;cancelRequested.current=false;setSending(true);setError('');
    const originalActive = active;
    let id = active;
    try {
      let prompt = text.trim() ? text : '请阅读并分析以下附件。';
      for (const file of files) {
        if (file.size > 150000 || (file.type && !file.type.startsWith('text/') && !/json|javascript|xml/.test(file.type))) throw new Error('请添加小于 150 KB 的文本或代码文件。');
        const content = await file.text();
        if (content.includes('\0')) throw new Error('暂不支持二进制附件，请添加文本或代码文件。');
        prompt += `\n\n附件 ${file.name}：\n${content}`;
      }
      if (!id || id.startsWith('legacy:')) {
        if (legacy) {
          const history = legacy.messages.filter(m=>!['error','stopped','streaming'].includes(m.status || '')).map(m=>`${m.role === 'user' ? '用户':'助手'}：${m.content}`).join('\n\n');
          if (history.length > 40000) throw new Error('旧对话上下文过长，请新建对话或精简内容后继续。');
          prompt = `以下是此前对话的文本记录，作为背景信息：\n<previous_conversation>\n${history}\n</previous_conversation>\n\n现在用户的请求：\n${prompt}`;
        }
        if (prompt.length > 60000) throw new Error('消息与附件合计超过 60000 字符，请减少内容。');
        const result = await api<{session:Session}>('/sessions',{workspace,provider:'ccswitch',title:legacy?.title || text.trim().slice(0,30) || '附件分析'});
        id = result.session.id;
        setSessions(all=>[{id,title:result.session.title || text.slice(0,30),updatedAt:Date.now(),legacyId:legacy?.id},...all]);
        activeRef.current = id;setActive(id);
      }
      if (prompt.length > 60000) throw new Error('消息与附件合计超过 60000 字符，请减少内容。');
      if (cancelRequested.current) {setDrafts(all=>({...all,[id]:text}));return;}
      await api('/sessions/'+id+'/prompt',{text:prompt,provider:'ccswitch'});
      if (cancelRequested.current) {await api('/sessions/'+id+'/interrupt',{});setDrafts(all=>({...all,[id]:text}));return;}
      runningRef.current = id;
      setDrafts(all=>({...all,[originalActive]:'',[id]:''}));
      setSessions(all=>all.map(s=>s.id === id ? {...s,updatedAt:Date.now()}:s));
    } catch(e) {
      setDrafts(all=>({...all,[id]:text}));
      setError(e instanceof Error ? e.message:'发送失败');throw e;
    } finally {sendingRef.current = false;setSending(false);}
  }
  async function stop() {
    cancelRequested.current=true;
    const id = runningRef.current || activeRef.current;
    if (!/^ses_/.test(id)) return;
    try {await api('/sessions/'+id+'/interrupt',{});runningRef.current = null;}
    catch(e) {setError(e instanceof Error ? e.message:'停止失败');}
  }
  async function decide(id:string,decision:PermissionDecision) {
    const sessionID = activeRef.current;
    if (!/^ses_/.test(sessionID) || deciding) return;
    setDeciding(id);setApprovalError('');
    try {
      await api('/sessions/'+sessionID+'/permissions',{requestID:id,decision});
      if (activeRef.current === sessionID) setSnapshot(s=>s ? {...s,permissions:decision === 'reject' ? [] : s.permissions.filter(p=>p.id !== id)}:s);
    } catch(e) {setApprovalError(e instanceof Error ? e.message:'审批失败');}
    finally {setDeciding('');}
  }
  async function answer(formID:string,value:Record<string,unknown>) {
    await api('/sessions/'+active+'/forms',{formID,answer:value});
    setSnapshot(s=>s ? {...s,forms:s.forms.filter(f=>f.id !== formID)}:s);
  }
  function remove(id:string) {
    if (id === busySession) return;
    if (id.startsWith('legacy:')) {const next = legacyChats.filter(c=>c.id !== id.slice(7));localStorage.setItem('lucent_conversations_v1',JSON.stringify(next));setLegacyChats(next);}
    else setSessions(all=>all.filter(s=>s.id !== id));
    if (active === id) newConversation();
  }
  return {sessions,legacyChats,active,selected,legacyContext,snapshot,workspace,setWorkspace,draft,setDraft,error,approvalError,loading,sending,busy,busySession,deciding,select,newConversation,send,stop,decide,answer,remove};
}

