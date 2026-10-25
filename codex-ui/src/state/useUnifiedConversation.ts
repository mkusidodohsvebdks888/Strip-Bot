import {mergePrompt} from '../lib/workflow-input.mjs';
import {useEffect,useRef,useState} from 'react';
import type {Snapshot,ApprovalDecision,ApprovalConfirmation,ApprovalMode} from '../components/AgentPanel';
import type {Chat} from '../domain/chat';
import {readStored,restoreChats} from './chat-storage.mjs';
import {readApprovalPreference,writeApprovalPreference} from './approval-preference.mjs';

type Session = {id:string;title:string;updatedAt?:number;legacyId?:string;workspace?:string};
type SendOptions={parallel?:boolean;workspace?:string};
type TaskOverview={maxParallel:number;activeCount:number;queued:number;pausedSessions:string[];runningSessions:string[]};
const SESSION_KEY = 'strip_cc_agent_sessions_v1', ACTIVE_KEY = 'strip_unified_active_v1';
function abortedRequest(): Error {
  const error = new Error('请求已停止');
  error.name = 'AbortError';
  return error;
}
function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && (error as {name?: unknown}).name === 'AbortError');
}
async function api<T>(route:string,body?:unknown,signal?:AbortSignal):Promise<T> {
  const response = await fetch('/api/agent'+route,{method:body === undefined ? 'GET':'POST',headers:{'Content-Type':'application/json'},body:body === undefined ? undefined:JSON.stringify(body),signal});
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
  return value;
}
export function useUnifiedConversation(connection:'ccswitch'|'direct'|'codex'|'opencode'='ccswitch',nativeModel='',reasoningVariant='',startFresh=false) {
  const [sessions,setSessions] = useState<Session[]>(() => {
    const cc = readStored<Session[]>(localStorage,SESSION_KEY,[]);
    const local = localStorage.getItem('strip_unified_migrated_v1') === '1' ? []:readStored<Session[]>(localStorage,'strip_agent_sessions_v1',[]);
    return Array.from(new Map([...Array.isArray(cc) ? cc:[],...Array.isArray(local) ? local:[]].filter(s=>s && /^ses_[a-zA-Z0-9]+$/.test(s.id) && typeof s.title === 'string').map(s=>[s.id,s])).values());
  });
  const [legacyChats,setLegacyChats] = useState<Chat[]>(() => restoreChats(localStorage));
  const [active,setActive] = useState(() => {if(startFresh)return '';const value = readStored<unknown>(localStorage,ACTIVE_KEY,'');return typeof value === 'string' ? value:'';});
  const [snapshot,setSnapshot] = useState<Snapshot|null>(null);
  const [overview,setOverview]=useState<TaskOverview>({maxParallel:3,activeCount:0,queued:0,pausedSessions:[],runningSessions:[]});
  const [workspace,setWorkspace] = useState('');
  const [drafts,setDrafts] = useState<Record<string,string>>(() => {
    const value=readStored<unknown>(localStorage,'strip_unified_drafts_v1',{});
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([,v])=>typeof v === 'string')):{};
  });
  const [error,setError] = useState(''),[sending,setSending] = useState(false),[loading,setLoading] = useState(false),[deciding,setDeciding] = useState(''),[removing,setRemoving] = useState('');
  const sendingRef = useRef(false),activeRef = useRef(active),runningRef = useRef<string|null>(null);
  const cancelRequested = useRef(false);
  const requestController = useRef<AbortController|null>(null);
  const decidingRef=useRef(false);
  const [newApprovalMode,setNewApprovalMode]=useState<ApprovalMode>('ask');
  const [modeUpdating,setModeUpdating]=useState(false);
  const modeLock=useRef(false),modeRevision=useRef(0);
  const approvalMode:ApprovalMode=snapshot?.approvalMode || (!/^ses_/.test(active)?newApprovalMode:'ask');
  useEffect(()=>{setNewApprovalMode(readApprovalPreference(localStorage,workspace,connection));},[workspace,connection]);
  activeRef.current = active;
  const legacy = active.startsWith('legacy:') ? legacyChats.find(c=>c.id === active.slice(7)) : undefined;
  const selected = sessions.find(s=>s.id === active);
  const legacyContext = legacy || (selected?.legacyId ? legacyChats.find(c=>c.id === selected.legacyId):undefined);
  const draft = drafts[active] || '';
  const setDraft = (value:string) => setDrafts(all=>({...all,[active]:value}));
  const busy = sending || Boolean(snapshot?.running);
  const busySession = sending ? active : snapshot?.running ? active : runningRef.current;
  useEffect(()=>{let dead=false,timer:ReturnType<typeof setTimeout>;const tick=async()=>{
    try{const next=await api<TaskOverview>('/tasks');if(!dead)setOverview(next);}catch{/* The selected-session poll provides the actual error UI. */}
    finally{if(!dead)timer=setTimeout(tick,1500);}
  };void tick();return()=>{dead=true;clearTimeout(timer);};},[]);
  useEffect(() => {api<{workspace:string}>('/status').then(s=>setWorkspace(s.workspace)).catch(e=>setError(e.message));},[]);
  useEffect(() => {
    try {localStorage.setItem(SESSION_KEY,JSON.stringify(sessions));localStorage.setItem(ACTIVE_KEY,JSON.stringify(active));localStorage.setItem('strip_unified_migrated_v1','1');}
    catch {setError('无法保存会话索引，请检查存储空间。');}
  },[sessions,active]);
  useEffect(()=>{try {localStorage.setItem('strip_unified_drafts_v1',JSON.stringify(drafts));} catch {setError('无法保存草稿，请检查存储空间。');}},[drafts]);
  useEffect(() => {
    setSnapshot(null);setError('');
    if (!/^ses_/.test(active)) {setLoading(false);return;}
    let disposed = false,timer:ReturnType<typeof setTimeout>;
    setLoading(true);
    const poll = async () => {
      let nextPollMs=1200;
      try {
        const revision=modeRevision.current;
        let result = await api<Snapshot>('/sessions/'+active);
        if(!disposed && activeRef.current===active && !modeLock.current && !decidingRef.current && result.approvalMode==='allow-all' && result.permissions.length){
          const batch=await api<{approved:string[];failures:{message:string}[];approvalMode:ApprovalMode}>('/sessions/'+active+'/approve-all',{automatic:true,requestIDs:result.permissions.map(p=>p.id)});
          const approved=new Set(batch.approved);result={...result,approvalMode:batch.approvalMode,permissions:result.permissions.filter(p=>!approved.has(p.id))};
          if(batch.failures.length && !disposed)setError('自动批准已停止：'+batch.failures[0].message);
        }
        nextPollMs=result.running || result.permissions?.length || result.forms?.length ? 350 : 1200;
        if (!disposed) {setSnapshot(current=>revision===modeRevision.current?result:{...result,approvalMode:current?.approvalMode || 'ask'});if(result.workspace)setSessions(items=>items.some(item=>item.id===active && item.workspace!==result.workspace)?items.map(item=>item.id===active?{...item,workspace:result.workspace}:item):items);if (result.running) runningRef.current = active;else if (runningRef.current === active) runningRef.current = null;}
      } catch(e) {if (!disposed) setError(e instanceof Error ? e.message:'读取对话失败');}
      finally {if (!disposed) {setLoading(false);timer = setTimeout(poll,nextPollMs);}}
    };
    void poll();return () => {disposed = true;clearTimeout(timer);};
  },[active]);
  function select(id:string) {if (sendingRef.current) return;setActive(id);}
  function newConversation(preservedDraft?:string) {if (sendingRef.current) return;setNewApprovalMode(readApprovalPreference(localStorage,workspace,connection));if(preservedDraft !== undefined)setDrafts(all=>({...all,'':preservedDraft}));setActive('');setSnapshot(null);setError('');}
  async function send(text:string,files:File[] = [],options:SendOptions={}) {
    const targetWorkspace=options.workspace?.trim() || workspace;
    if (sendingRef.current || (!text.trim() && !files.length) || !targetWorkspace) return;
    const controller = new AbortController();
    requestController.current = controller;
    sendingRef.current = true;cancelRequested.current=false;setSending(true);setError('');
    const originalActive = active;
    let id = options.parallel ? '' : active;
    try {
      let prompt = await mergePrompt(text,files);
      if (controller.signal.aborted || cancelRequested.current) throw abortedRequest();
      if (!id || id.startsWith('legacy:')) {
        if (legacy && !options.parallel) {
          const history = legacy.messages.filter(m=>!['error','stopped','streaming'].includes(m.status || '')).map(m=>`${m.role === 'user' ? '用户':'助手'}：${m.content}`).join('\n\n');
          if (history.length > 40000) throw new Error('旧对话上下文过长，请新建对话或精简内容后继续。');
          prompt = await mergePrompt(text,files,history);
        }
        if (controller.signal.aborted || cancelRequested.current) throw abortedRequest();
        const result = await api<{session:Session}>('/sessions',{workspace:targetWorkspace,provider:connection,...['codex','opencode'].includes(connection)?{modelOverride:nativeModel,...reasoningVariant?{reasoningVariant}:{}}:{},approvalMode:newApprovalMode,confirmApprovalMode:newApprovalMode==='allow-all',title:(!options.parallel && legacy?.title) || text.trim().slice(0,30) || '附件分析'},controller.signal);
        id = result.session.id;
        setSessions(all=>[{id,title:result.session.title || text.slice(0,30),updatedAt:Date.now(),workspace:targetWorkspace,legacyId:!options.parallel?legacy?.id:undefined},...all]);
        activeRef.current = id;setActive(id);
      }
      if (controller.signal.aborted || cancelRequested.current) throw abortedRequest();
      await api('/sessions/'+id+'/prompt',{text:prompt,provider:connection},controller.signal);
      if (controller.signal.aborted || cancelRequested.current) throw abortedRequest();
      // The scheduler may queue this request; only polling sets runningRef.
      setDrafts(all=>({...all,[originalActive]:'',[id]:''}));
      setSessions(all=>all.map(s=>s.id === id ? {...s,updatedAt:Date.now()}:s));
    } catch(e) {
      setDrafts(all=>({...all,[originalActive]:originalActive===id?text:'',[id]:text}));
      if (controller.signal.aborted || cancelRequested.current || isAbortError(e)) throw isAbortError(e) ? e : abortedRequest();
      setError(e instanceof Error ? e.message:'发送失败');
      throw e;
    } finally {
      if (requestController.current === controller) requestController.current = null;
      sendingRef.current = false;setSending(false);
    }
  }
  async function sendParallel(text:string,files:File[]=[],targetWorkspace?:string){
    return send(text,files,{parallel:true,workspace:targetWorkspace});
  }
  async function queueAction(action:'pause'|'resume'|'interrupt') {
    const id=activeRef.current;if(!/^ses_/.test(id))return;
    setError('');
    try{const response=await api<{paused:boolean;tasks:Snapshot['tasks']}>('/sessions/'+id+'/'+action,{});
      if(activeRef.current===id)setSnapshot(current=>current?{...current,queuePaused:response.paused,tasks:response.tasks||current.tasks}:current);
    }catch(error){setError(error instanceof Error?error.message:'无法更改任务状态');throw error;}
  }
  async function pause(){return queueAction('pause');}
  async function resume(){return queueAction('resume');}
  async function cancelTask(taskID:string){
    const id=activeRef.current;if(!/^ses_/.test(id))return;setError('');
    try{const response=await api<{tasks:Snapshot['tasks']}>('/sessions/'+id+'/tasks/'+taskID+'/cancel',{});
      if(activeRef.current===id)setSnapshot(current=>current?{...current,tasks:response.tasks||current.tasks}:current);
    }catch(error){setError(error instanceof Error?error.message:'取消任务失败');throw error;}
  }
  async function stop() {
    setNewApprovalMode('ask');setSnapshot(s=>s?{...s,approvalMode:'ask'}:s);modeRevision.current++;
    cancelRequested.current=true;
    const controller = requestController.current;
    if (controller && !controller.signal.aborted) controller.abort();
    const id = activeRef.current;
    if (!/^ses_/.test(id)) return;
    try {
      await api('/sessions/'+id+'/interrupt',{});
      runningRef.current = null;
      setSnapshot(current=>current && current.running ? {...current,running:false} : current);
    }
    catch(e) {
      setError(e instanceof Error ? e.message:'停止失败');
      throw e instanceof Error ? e : new Error('停止失败');
    }
  }
  async function setApprovalMode(mode:ApprovalMode){
    if(modeLock.current)throw new Error('权限模式正在更新。');
    const session=activeRef.current;modeLock.current=true;setModeUpdating(true);modeRevision.current++;
    const preferenceWorkspace=/^ses_/.test(session)?snapshot?.workspace || workspace:workspace;
    const previous=readApprovalPreference(localStorage,preferenceWorkspace,connection);
    let saved=false;
    try{
      writeApprovalPreference(localStorage,preferenceWorkspace,connection,mode);saved=true;
      if(/^ses_/.test(session)){
        await api('/sessions/'+session+'/approval-mode',{mode,confirmed:mode==='allow-all'});
        if(activeRef.current===session)setSnapshot(s=>s?{...s,approvalMode:mode}:s);
      }
      setNewApprovalMode(readApprovalPreference(localStorage,workspace,connection));
    }catch(error){if(saved){try{writeApprovalPreference(localStorage,preferenceWorkspace,connection,previous);}catch{/* Keep the original request failure visible. */}}throw error;}
    finally{modeRevision.current++;modeLock.current=false;setModeUpdating(false);}
  }
  async function approveAllPending(requestIDs?:string[]){
    if(decidingRef.current)throw new Error('另一项审批正在提交。');
    const session=activeRef.current,ids=requestIDs || snapshot?.permissions.map(p=>p.id) || [];
    if(!/^ses_/.test(session) || !ids.length)throw new Error('当前没有待审批请求。');
    decidingRef.current=true;setDeciding('all');
    try{
      const result=await api<{approved:string[];failures:{message:string}[];approvalMode:ApprovalMode}>('/sessions/'+session+'/approve-all',{requestIDs:ids,confirmed:true});
      if(activeRef.current===session){const approved=new Set(result.approved);setSnapshot(s=>s?{...s,approvalMode:result.approvalMode,permissions:s.permissions.filter(p=>!approved.has(p.id))}:s);}
      if(result.failures.length)throw new Error('部分操作未批准：'+result.failures[0].message);
    }finally{decidingRef.current=false;setDeciding('');}
  }
  async function decide(id:string,decision:ApprovalDecision,confirmation?:ApprovalConfirmation) {
    if(decidingRef.current)throw new Error('另一项审批正在提交，请稍后重试。');
    decidingRef.current=true;
    const session=active;
    setDeciding(id);
    try {await api('/sessions/'+session+'/permissions',{requestID:id,decision,...confirmation});if(activeRef.current===session)setSnapshot(s=>s ? {...s,permissions:s.permissions.filter(p=>p.id !== id)}:s);}
    catch(e) {throw e instanceof Error?e:new Error('审批失败');}finally {decidingRef.current=false;setDeciding('');}
  }
  async function answer(formID:string,value:Record<string,unknown>) {
    await api('/sessions/'+active+'/forms',{formID,answer:value});
    setSnapshot(s=>s ? {...s,forms:s.forms.filter(f=>f.id !== formID)}:s);
  }
  async function remove(id:string) {
    if (id===busySession || sendingRef.current || removing)return;
    setRemoving(id);setError('');
    try{
      if(id.startsWith('legacy:')){
        const next=legacyChats.filter(chat=>chat.id!==id.slice(7));
        localStorage.setItem('lucent_conversations_v1',JSON.stringify(next));setLegacyChats(next);
      }else{
        const response=await fetch('/api/agent/sessions/'+encodeURIComponent(id),{method:'DELETE'});
        const value=await response.json();
        if(!response.ok)throw new Error(value.error || '删除会话失败。');
        setSessions(all=>all.filter(session=>session.id!==id));
      }
      setDrafts(all=>{const next={...all};delete next[id];return next;});
      if(activeRef.current===id)newConversation();
    }catch(e){setError(e instanceof Error?e.message:'删除失败，请重试。');}
    finally{setRemoving('');}
  }
  return {sessions,legacyChats,active,selected,legacyContext,snapshot,overview,workspace,setWorkspace,draft,setDraft,error,loading,sending,busy,busySession,deciding,removing,select,newConversation,send,sendParallel,pause,resume,cancelTask,stop,decide,answer,remove,approvalMode,modeUpdating,setApprovalMode,approveAllPending};
}

