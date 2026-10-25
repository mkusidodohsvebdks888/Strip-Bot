import {useCallback,useEffect,useRef,useState} from 'react';
export type ConnectionMode='ccswitch'|'direct'|'opencode';
export function useConnection(){
  const [mode,setMode]=useState<ConnectionMode>(()=>{try{const saved=localStorage.getItem('strip_connection_mode_v1');return saved==='ccswitch'||saved==='opencode'?saved:'direct';}catch{return 'direct';}});
  const [model,setModel]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(''),[protocol,setProtocol]=useState('responses'),[reasoningEffort,setReasoningEffort]=useState('');
  const [account,setAccount]=useState<{connected:boolean;models:{id:string;name:string}[];attempt?:{status:string}}>({connected:false,models:[]});
  const current=useRef(mode);current.current=mode;
  const refresh=useCallback(async()=>{
    const requested=mode;
    try{
      const response=await fetch(requested==='opencode'?'/api/connection/account/status':requested==='direct'?'/api/connection/status':'/api/cc-switch/status',{signal:AbortSignal.timeout(45000)}),value=await response.json();
      if(current.current!==requested)return;
      if(!response.ok)throw new Error(value.error || '读取连接失败');
      if(requested==='opencode'){
        setAccount(value);const saved=localStorage.getItem('strip_native_model_v1');
        const selected=value.models?.find((item:{id:string})=>item.id===saved)?.id || value.models?.find((item:{id:string})=>item.id==='gpt-6-luna')?.id || value.models?.[0]?.id || '';
        setModel(selected);setProtocol('responses');setRevision('');
        setError(!value.connected?'请在模型连接中登录 ChatGPT 账号。':!selected?'未读取到可用的 OpenAI 模型。':'');return;
      }
      setModel(requested==='direct'?value.model || '':value.codex?.model || '');setRevision(value.revision || '');setProtocol(requested==='direct'?value.protocol:'responses');setReasoningEffort(requested==='direct'?value.reasoningEffort || '':'');
      setError(requested==='direct' ? !value.configured?'请先保存 API 地址、密钥与模型。':'':!value.healthy?'CC Switch 代理未启动，请开启 Codex 本地路由。':!value.codex?.model?'未读取到 CC Switch 的 Codex 模型。':'');
    }catch(e){if(current.current===requested)setError(e instanceof Error && e.name==='TimeoutError'?'读取连接超时，请重试。':e instanceof Error?e.message:'连接状态读取失败。');}
    finally{if(current.current===requested)setLoading(false);}
  },[mode]);
  useEffect(()=>{setLoading(true);setModel('');setError('');void refresh();const timer=setInterval(()=>void refresh(),5000);const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{clearInterval(timer);window.removeEventListener('focus',focus);};},[refresh]);
  function select(value:ConnectionMode){if(!['direct','ccswitch','opencode'].includes(value))return;try{localStorage.setItem('strip_connection_mode_v1',value);}catch{/* Connection remains usable without storage. */}setLoading(true);setModel('');setError('');setMode(value);}
  return {mode,select,model,error,loading,revision,protocol,reasoningEffort,refresh,account,selectNativeModel:(value:string)=>{localStorage.setItem('strip_native_model_v1',value);setModel(value);}};
}
