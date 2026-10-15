import {useEffect,useRef,useState} from 'react';
import shell from './App.module.css';
import side from './components/Sidebar/Sidebar.module.css';
import empty from './components/EmptyState/EmptyState.module.css';
import box from './components/Composer/Composer.module.css';
import {StripCodexComposer} from './components/StripCodexComposer';
import {QuestionForm} from './components/AgentPanel';
import {ChatHistoryList} from './components/Sidebar/ChatHistoryList';
import {BrandIcon,Icon} from './Icons';
import {useUnifiedConversation} from './state/useUnifiedConversation';
import './styles/strip.css';
import './components/unified-chat.css';

function pretty(value:unknown) {return typeof value === 'string' ? value : JSON.stringify(value,null,2);}
function MessageText({text}:{text:string}) {
  return <>{text.split(/(```[\s\S]*?```)/g).map((part,i)=>part.startsWith('```') ? <pre key={i}><code>{part.replace(/^```[^\n]*\n?/,'').replace(/```$/,'')}</code></pre>:<span key={i}>{part}</span>)}</>;
}
export default function App() {
  const [ccView,setCcView] = useState(false);
  const [routeModel,setRouteModel] = useState('');
  const [modelError,setModelError] = useState(''),[modelsLoading,setModelsLoading] = useState(true);
  const [search,setSearch] = useState(''),[mobile,setMobile] = useState(false),[notice,setNotice] = useState('');
  const conversation = useUnifiedConversation();
  const {active,snapshot,legacyContext,workspace,draft,busy} = conversation;
  const scroll = useRef<HTMLDivElement>(null);
  async function refreshModels() {
    setModelsLoading(true);setModelError('');
    try {

        const response=await fetch('/api/cc-switch/status',{signal:AbortSignal.timeout(10000)}),value=await response.json();
        if(!response.ok)throw new Error(value.error || 'CC Switch 检测失败');
        setRouteModel(value.codex?.model || '');
        if(!value.healthy)throw new Error('CC Switch 代理未启动，请开启 Codex 本地路由。');
        if(!value.codex?.model)throw new Error('未读取到 CC Switch 的 Codex 模型，请先配置模型。');
    } catch(error){setModelError(error instanceof Error && error.name==='TimeoutError' ? '模型加载超时，请重试。':error instanceof Error ? error.message:'读取模型失败');}
    finally{setModelsLoading(false);}
  }
  useEffect(()=>{void refreshModels();},[]);
  useEffect(()=>{

    let disposed=false;
    const sync=async()=>{try{const response=await fetch('/api/cc-switch/status',{signal:AbortSignal.timeout(5000)});const value=await response.json();if(!disposed && response.ok){setRouteModel(value.codex?.model || '');setModelError(!value.healthy ? 'CC Switch 代理未启动，请开启 Codex 本地路由。':!value.codex?.model ? '未读取到 CC Switch 的 Codex 模型。':'');}}catch{if(!disposed)setModelError('CC Switch 状态读取失败，请检查本地代理。');}};
    const timer=setInterval(()=>void sync(),5000);window.addEventListener('focus',sync);
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',sync);};
  },[]);
  useEffect(()=>{const el=scroll.current;if(el && el.scrollHeight-el.scrollTop-el.clientHeight<180)el.scrollTo({top:el.scrollHeight});},[snapshot,active]);
  const selectedModel=routeModel;
  const model = active.startsWith('ses_') ? snapshot?.model?.id || '读取会话模型…' : selectedModel;
  const models=active.startsWith('ses_') ? [{value:model,label:model,description:'会话已绑定模型'}]: [{value:routeModel,label:routeModel || '等待 CC Switch 模型',description:'自动跟随 CC Switch · Codex 路由'}];
  const entries=[...conversation.sessions.map(s=>({id:s.id,title:s.title,description:'对话 · 编程',updatedAt:s.updatedAt || 0})),...conversation.legacyChats.filter(c=>!conversation.sessions.some(s=>s.legacyId===c.id)).map(c=>({id:'legacy:'+c.id,title:c.title,description:'历史对话',updatedAt:c.updatedAt}))].sort((a,b)=>b.updatedAt-a.updatedAt);
  const title=conversation.selected?.title || legacyContext?.title || '新对话';
  const messages=[...(snapshot?.messages || [])].reverse().filter(m=>m.type==='user' || m.type==='assistant' || m.error);
  const modelChanged = Boolean(snapshot?.configurationChanged || (snapshot?.model && snapshot.model.providerID!=='strip-local') || (routeModel && snapshot?.model && snapshot.model.id !== routeModel));
  const waiting = Boolean(snapshot?.permissions.length || snapshot?.forms.length);
  const blockedReason = modelChanged ? '连接或模型已变化，请保留输入并新建对话。':conversation.loading ? '正在读取会话，请稍候。':waiting ? '请先处理上方的工具审批或问题。':!workspace ? '请填写有效的项目目录。':modelsLoading ? '正在加载模型，请稍候。':modelError ? modelError:!active.startsWith('ses_') && !selectedModel ? '未读取到模型，请先在 CC Switch 中配置 Codex 模型。':'';
  const blocked = Boolean(blockedReason);
  function newChat(){conversation.newConversation();setCcView(false);setMobile(false);}
  return <div className={shell.app+' strip-app strip-ui'} data-theme="dark">
    {mobile && <button className="strip-overlay" aria-label="关闭导航" onClick={()=>setMobile(false)}/>}
    <aside className={side.sidebar+(mobile ? ' strip-sidebar-open':'')}>
      <div className={'strip-drag '+side.brand}><img className="strip-logo" src="/brand-logo.png" alt="Strip Bot"/><span className={side.wordmark}>Strip Bot</span><button className="strip-mobile strip-btn strip-btn--ghost strip-btn--icon" aria-label="关闭导航" onClick={()=>setMobile(false)}><Icon name="x"/></button></div>
      <div className={side.newTaskWrap}><button className={'strip-btn strip-btn--secondary strip-btn--wide '+side.newTask} disabled={busy} onClick={newChat}><Icon name="chat-round-add"/>新建对话</button></div>
      <div className={side.searchWrap}><label className="strip-search-wrap"><Icon name="search"/><input className="strip-search" aria-label="搜索会话" placeholder="搜索会话" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
      <nav className={side.list} aria-label="历史会话">
        <ChatHistoryList entries={entries} activeId={active} query={search} busy={busy}
          onSelect={id=>{conversation.select(id);setCcView(false);setMobile(false);}}
          onRemove={conversation.remove} />
      </nav>
      <div className={side.footer}><button className="strip-btn strip-btn--ghost" disabled={busy} onClick={()=>setCcView(true)}>CC Switch 连接</button></div>
      <p className="strip-attribution">Strip UI Kit · MIT · <a href="https://lucide.dev" target="_blank" rel="noreferrer">Lucide Icons · ISC</a></p>
    </aside>
    <main className={shell.main}>{ccView ? <div className="strip-messages"><button className="strip-btn strip-btn--secondary" onClick={()=>setCcView(false)}>返回对话</button><h2>CC Switch 连接</h2><p>聊天与编程统一通过 CC Switch 的 Codex 路由连接模型。</p><p>接口：http://127.0.0.1:15721/v1/responses</p><p>当前模型：{routeModel || '未识别'}</p><p>请在 CC Switch 的 Codex 页面配置 API 供应商并切换模型。新对话自动跟随最新配置，旧对话保留原模型。</p><button className="strip-btn strip-btn--secondary" disabled={modelsLoading} onClick={()=>void refreshModels()}>{modelsLoading ? '正在检测…':'重新检测'}</button>{modelError && <p role="alert">{modelError}</p>}<p className="strip-muted">代理在线不代表上游认证或额度可用，需以真实请求结果为准。</p></div> : <>
      <header className="strip-header"><div><button className="strip-mobile strip-btn strip-btn--ghost strip-btn--icon" aria-label="打开导航" onClick={()=>setMobile(true)}><Icon name="hamburger-menu"/></button>Strip Bot <span className="strip-muted"> / {title}</span></div><span className="strip-muted">CC Switch</span><span className="strip-muted">{waiting ? '等待审批':busy ? '正在处理':'对话与编程'}</span></header>
      <div className="strip-unified-project"><Icon name="code"/><label>项目目录<input aria-label="项目目录" value={snapshot?.workspace || workspace} disabled={Boolean(active.startsWith('ses_')) || busy} onChange={e=>conversation.setWorkspace(e.target.value)} placeholder="选择 G:\p 内的项目目录"/></label><span className="strip-muted">文件与命令逐次审批</span></div>
      <div className="strip-thread strip-unified-thread" ref={scroll}>
        {!messages.length && !legacyContext?.messages.length && !conversation.loading && <div className={empty.root}>
          <img className="strip-welcome-logo" src="/brand-logo.png" alt="Strip Bot"/><h1 className={empty.heading}>从对话到构建，都在这里。</h1><p className={empty.subtext}>直接提问，或描述编程任务。需要操作文件时，由你确认。</p>
          <div className={empty.chips}>{[['规划任务','帮我梳理这个项目的工作计划。'],['理解代码','请先读取项目 README，解释它的结构。'],['修改代码','帮我检查并修复项目中的问题，每次操作前让我确认。']].map(([label,prompt])=><button className={'strip-btn strip-btn--secondary strip-btn--sm '+empty.chip} key={label} onClick={()=>conversation.setDraft(prompt)}>{label}</button>)}</div>
        </div>}
        <div className="strip-messages">
          {legacyContext?.messages.map(m=><article className={'strip-message '+m.role} key={'legacy-'+m.id}><div className="strip-author"><strong>{m.role==='user' ? '你':'Strip Bot'}</strong><span className="strip-muted">历史对话</span></div><div className="strip-message-content"><MessageText text={m.content}/></div></article>)}
          {legacyContext && !active.startsWith('ses_') && <p className="strip-muted">继续发送会将以上文本上下文带入统一会话。</p>}
          {conversation.loading && <p className="strip-muted" role="status">正在读取会话…</p>}
          {messages.map(message=><article className={'strip-message '+(message.type==='user' ? 'user':'assistant')} key={message.id}>
            <div className="strip-author">{message.type==='assistant' && <BrandIcon model={snapshot?.model?.id || model}/>}<strong>{message.type==='user' ? '你':'Strip Bot'}</strong>{message.type==='assistant' && <span className="strip-muted">{snapshot?.model?.id || model}</span>}</div>
            <div className="strip-message-content">{message.text && <MessageText text={message.text}/>}{!!message.error && <pre className="strip-error">{pretty(message.error)}</pre>}
              {message.content?.filter(c=>c.type!=='reasoning').map((content,i)=>content.type==='tool' ? <details className="strip-unified-tool" key={content.id || i} open={content.state?.status!=='completed'}><summary><Icon name="code"/>{content.name} <span className="strip-muted">{content.state?.status==='completed' ? '已完成':content.state?.status==='error' ? '失败':content.state?.status || '处理中'}</span></summary><pre>{pretty(content.state?.input)}</pre>{!!content.state?.content && <pre>{pretty(content.state.content)}</pre>}{!!content.state?.error && <pre className="strip-error">{pretty(content.state.error)}</pre>}</details>:content.text ? <MessageText key={i} text={content.text}/>:null)}
            </div>
          </article>)}
          {!!snapshot?.diff.length && <details className="strip-unified-tool"><summary>文件变更 · {snapshot.diff.length}</summary><pre>{pretty(snapshot.diff)}</pre></details>}
          {!!snapshot?.permissions.length && <section className="strip-unified-approval" aria-label="待审批工具操作"><strong>需要你确认</strong>{snapshot.permissions.map(p=><article key={p.id}><p>{p.action}</p><pre>{p.resources.join('\n')}</pre>{!!p.metadata && <details><summary>操作详情</summary><pre>{pretty(p.metadata)}</pre></details>}<button className="strip-btn strip-btn--primary strip-btn--sm" disabled={Boolean(conversation.deciding)} onClick={()=>void conversation.decide(p.id,'once')}>允许本次</button><button className="strip-btn strip-btn--secondary strip-btn--sm" disabled={Boolean(conversation.deciding)} onClick={()=>void conversation.decide(p.id,'reject')}>拒绝</button></article>)}</section>}
          {snapshot?.forms.map(form=><div className="strip-unified-approval" key={form.id}><QuestionForm form={form} onAnswer={answer=>conversation.answer(form.id,answer)}/></div>)}
          {modelChanged && <div className="strip-unified-alert" role="status">当前连接模型已变化。此会话保留原模型，请新建对话继续。<button className="strip-btn strip-btn--secondary strip-btn--sm" disabled={busy} onClick={newChat}>新建对话</button></div>}
          {modelError && <div role="alert" className="strip-unified-alert strip-error">{modelError}</div>}{conversation.error && <div role="alert" className="strip-unified-alert strip-error">{conversation.error}</div>}
        </div>
      </div>
      <div className={box.wrapper}><StripCodexComposer key={active} value={draft} onValueChange={conversation.setDraft} busy={busy} onStop={()=>void conversation.stop()} sendDisabled={blocked} sendDisabledReason={blockedReason} models={models} selectedModel={model}  modelType="CC Switch · Responses" efforts={[{value:'default',label:'自动'}]} environments={[{value:'local',label:'项目'}]} permissions={[{value:'ask',label:'逐次批准'}]} placeholder="提问、阅读代码、修改文件，或描述要完成的任务…" onError={e=>setNotice(e instanceof Error ? e.message:'发送失败')} onSend={async ({text,files})=>{await conversation.send(text,files);setMobile(false);}}/>
        {blockedReason && <div className="strip-unified-alert" role="status">{blockedReason}{modelChanged && <button className="strip-btn strip-btn--secondary strip-btn--sm" disabled={busy} onClick={()=>conversation.newConversation(draft)}>保留输入并新建对话</button>}{!modelsLoading && (modelError || !selectedModel) && <button className="strip-btn strip-btn--secondary strip-btn--sm" disabled={busy} onClick={()=>void refreshModels()}>重新加载模型</button>}</div>}
        {!busy && !blocked && !draft.trim() && <p className="strip-unified-caption">输入消息或添加文本附件后即可发送</p>}
        <p className="strip-unified-caption">同一段对话中提问与编程 · OpenCode 执行工具 · 操作前由你批准</p>
      </div>
    </>}</main>
    {notice && <div className="strip-toast" role="status">{notice}<button className="strip-btn strip-btn--ghost" aria-label="关闭提示" onClick={()=>setNotice('')}>×</button></div>}
  </div>;
}


