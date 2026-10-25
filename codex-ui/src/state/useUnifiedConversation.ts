import {useEffect,useRef,useState} from 'react';
import type {Snapshot} from '../components/AgentPanel';
import type {Chat} from '../domain/chat';
import {readStored,restoreChats} from './chat-storage.mjs';

type Session = {id:string;title:string;updatedAt?:number;legacyId?:string};
type LocalTurn = {id:string;type:'user'|'assistant';text:string};
type LocalChat = {model:string;messages:LocalTurn[]};
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
    return Array.from(new Map([...Array.isArray(cc) ? cc:[],...Array.isArray(local) ? local:[]].filter(s=>s && /^(?:ses|loc)_[a-zA-Z0-9]+$/.test(s.id) && typeof s.title === 'string').map(s=>[s.id,s])).values());
  });
  const [legacyChats,setLegacyChats] = useState<Chat[]>(() => restoreChats(localStorage));
  const [active,setActive] = useState(() => {const value = readStored<unknown>(localStorage,ACTIVE_KEY,'');return typeof value === 'string' ? value:'';});
  const [agentSnapshot,setAgentSnapshot] = useState<Snapshot|null>(null);
  const [localChats,setLocalChats] = useState<Record<string,LocalChat>>(() => {
    const value = readStored<unknown>(localStorage,'strip_implicit_local_chats_v1',{});
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id,chat]) =>
      /^loc_[a-zA-Z0-9]+$/.test(id) && chat && typeof chat === 'object' && typeof (chat as LocalChat).model === 'string' && Array.isArray((chat as LocalChat).messages)
    )) as Record<string,LocalChat>;
  });
  const [workspace,setWorkspace] = useState('');
  const [drafts,setDrafts] = useState<Record<string,string>>(() => {
    const value=readStored<unknown>(localStorage,'strip_unified_drafts_v1',{});
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([,v])=>typeof v === 'string')):{};
  });
  const [error,setError] = useState(''),[sending,setSending] = useState(false),[loading,setLoading] = useState(false),[deciding,setDeciding] = useState('');
  const sendingRef = useRef(false),activeRef = useRef(active),runningRef = useRef<string|null>(null);
  const cancelRequested = useRef(false);
  const localAbort = useRef<AbortController|null>(null);
  activeRef.current = active;
  const legacy = active.startsWith('legacy:') ? legacyChats.find(c=>c.id === active.slice(7)) : undefined;
  const selected = sessions.find(s=>s.id === active);
  const legacyContext = legacy || (selected?.legacyId ? legacyChats.find(c=>c.id === selected.legacyId):undefined);
  const draft = drafts[active] || '';
  const localSnapshot:Snapshot|null = active.startsWith('loc_') ? {
    running: sending,
    messages:[...(localChats[active]?.messages || [])].reverse(),
    permissions:[],diff:[],forms:[],workspace,
    model:{providerID:'implicit-local',id:localChats[active]?.model || '本地模型',name:localChats[active]?.model || '本地模型'},
  }:null;
  const snapshot = localSnapshot || agentSnapshot;
  const setDraft = (value:string) => setDrafts(all=>({...all,[active]:value}));
  const busy = sending || Boolean(snapshot?.running);
  const busySession = sending ? active : snapshot?.running ? active : runningRef.current;
  useEffect(() => {try {localStorage.setItem('strip_implicit_local_chats_v1',JSON.stringify(localChats));}catch {setError('无法保存本地会话记录。');}},[localChats]);
  useEffect(() => {api<{workspace:string}>('/status').then(s=>setWorkspace(s.workspace)).catch(e=>setError(e.message));},[]);
  useEffect(() => {
    try {localStorage.setItem(SESSION_KEY,JSON.stringify(sessions));localStorage.setItem(ACTIVE_KEY,JSON.stringify(active));localStorage.setItem('strip_unified_migrated_v1','1');}
    catch {setError('无法保存会话索引，请检查存储空间。');}
  },[sessions,active]);
  useEffect(()=>{try {localStorage.setItem('strip_unified_drafts_v1',JSON.stringify(drafts));} catch {setError('无法保存草稿，请检查存储空间。');}},[drafts]);
  useEffect(() => {
    setAgentSnapshot(null);setError('');
    if (!/^ses_/.test(active)) {setLoading(false);return;}
    let disposed = false,timer:ReturnType<typeof setTimeout>;
    setLoading(true);
    const poll = async () => {
      try {
        const result = await api<Snapshot>('/sessions/'+active);
        if (!disposed) {setAgentSnapshot(result);if (result.running) runningRef.current = active;else if (runningRef.current === active) runningRef.current = null;}
      } catch(e) {if (!disposed) setError(e instanceof Error ? e.message:'读取对话失败');}
      finally {if (!disposed) {setLoading(false);timer = setTimeout(poll,800);}}
    };
    void poll();return () => {disposed = true;clearTimeout(timer);};
  },[active]);
  function select(id:string) {if (sendingRef.current) return;setActive(id);}
  function newConversation(preservedDraft?:string) {if (sendingRef.current) return;if(preservedDraft !== undefined)setDrafts(all=>({...all,'':preservedDraft}));setActive('');setAgentSnapshot(null);setError('');}
  async function send(text:string,files:File[] = [],options:{forceLocal?:boolean} = {}) {
    const localRequested = options.forceLocal === true || active.startsWith('loc_');
    if (sendingRef.current || snapshot?.running || (!text.trim() && !files.length) || (!localRequested && !workspace)) return;
    sendingRef.current = true;cancelRequested.current=false;setSending(true);setError('');
    const originalActive = active;
    let id = active;
    try {
      if (localRequested) {
        const cleaned = options.forceLocal ? text.trim().replace(/^\/本地(?:\s+|$)/,'') : text.trim();
        if (!cleaned && !files.length) throw new Error('请输入本地模型需要回答的内容。');
        let prompt = cleaned;
        for (const file of files) {
          if (file.size > 150000 || (file.type && !file.type.startsWith('text/') && !/json|javascript|xml/.test(file.type))) throw new Error('请添加小于 150 KB 的文本或代码文件。');
          const content = await file.text();
          if (content.includes('\0')) throw new Error('暂不支持二进制附件，请添加文本或代码文件。');
          prompt += '\n\n附件 '+file.name+'：\n'+content;
        }
        if (prompt.length > 60000) throw new Error('消息与附件合计超过 60000 字符。');
        const localId = active.startsWith('loc_') ? active : 'loc_'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
        const prior = localChats[localId]?.messages || [];
        const userTurn:LocalTurn = {id:'local-user-'+Date.now(),type:'user',text:cleaned || '请阅读附件'};
        if (!active.startsWith('loc_')) {
          setSessions(all=>[{id:localId,title:cleaned.slice(0,30) || '本地对话',updatedAt:Date.now()},...all]);
          activeRef.current = localId;setActive(localId);
        }
        setLocalChats(all=>({...all,[localId]:{model:all[localId]?.model || '本地模型',messages:[...prior,userTurn].slice(-48)}}));
        const controller = new AbortController();
        localAbort.current = controller;
        const response = await fetch('/api/local-model/chat',{
          method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
          body:JSON.stringify({messages:[...prior.slice(-23).map(m=>({role:m.type,content:m.text})),{role:'user',content:prompt}]}),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '本地模型请求失败。');
        if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('本地模型未返回有效回复。');
        setLocalChats(all=>({...all,[localId]:{
          model:typeof result.model === 'string' ? result.model:'本地模型',
          messages:[...(all[localId]?.messages || []),{id:'local-assistant-'+Date.now(),type:'assistant',text:result.reply}].slice(-48),
        }}));
        setSessions(all=>all.map(item=>item.id===localId ? {...item,updatedAt:Date.now()}:item));
        setDrafts(all=>({...all,[originalActive]:'',[localId]:''}));
        return;
      }
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
      if (!(localRequested && cancelRequested.current && e instanceof Error && e.name === 'AbortError')) {setError(e instanceof Error ? e.message:'发送失败');throw e;}
    } finally {localAbort.current = null;sendingRef.current = false;setSending(false);}
  }
  async function stop() {
    cancelRequested.current=true;
    if (activeRef.current.startsWith('loc_')) {localAbort.current?.abort();return;}
    const id = runningRef.current || activeRef.current;
    if (!/^ses_/.test(id)) return;
    try {await api('/sessions/'+id+'/interrupt',{});runningRef.current = null;}
    catch(e) {setError(e instanceof Error ? e.message:'停止失败');}
  }
  async function decide(id:string,decision:'once'|'reject') {
    setDeciding(id);
    try {await api('/sessions/'+active+'/permissions',{requestID:id,decision});setAgentSnapshot(s=>s ? {...s,permissions:s.permissions.filter(p=>p.id !== id)}:s);}
    catch(e) {setError(e instanceof Error ? e.message:'审批失败');}finally {setDeciding('');}
  }
  async function answer(formID:string,value:Record<string,unknown>) {
    await api('/sessions/'+active+'/forms',{formID,answer:value});
    setAgentSnapshot(s=>s ? {...s,forms:s.forms.filter(f=>f.id !== formID)}:s);
  }
  function remove(id:string) {
    if (id === busySession) return;
    if (id.startsWith('legacy:')) {const next = legacyChats.filter(c=>c.id !== id.slice(7));localStorage.setItem('lucent_conversations_v1',JSON.stringify(next));setLegacyChats(next);}
    else {setSessions(all=>all.filter(s=>s.id !== id));if (id.startsWith('loc_')) setLocalChats(all=>{const next={...all};delete next[id];return next;});}
    if (active === id) newConversation();
  }
  return {sessions,legacyChats,active,selected,legacyContext,snapshot,workspace,setWorkspace,draft,setDraft,error,loading,sending,busy,busySession,deciding,select,newConversation,send,stop,decide,answer,remove};
}

