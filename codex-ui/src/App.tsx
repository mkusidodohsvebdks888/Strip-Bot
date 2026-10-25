import {IntegrationsTool} from './components/Sidebar/IntegrationsTool';
import {BackendProjectsTool} from './components/Sidebar/BackendProjectsTool';
import {SkillsTool} from './components/Sidebar/SkillsTool';
import {GithubToolsTool} from './components/Sidebar/GithubToolsTool';
import {AstrBotTool} from './components/Sidebar/AstrBotTool';
import {WorkspaceActions,CommandPalette} from './components/Workspace/WorkspaceActions';
import {useManualCommands} from './state/useManualCommands';
import {ApiAccountMenu} from './components/Sidebar/ApiAccountMenu';
import {useEffect,useRef,useState} from 'react';
import shell from './App.module.css';
import {HomeWelcome} from './components/EmptyState/HomeWelcome';
import box from './components/Composer/Composer.module.css';
import {StripCodexComposer} from './components/StripCodexComposer';
import type {StripCodexComposerHandle} from './components/StripCodexComposer';
import {SessionApproval} from './components/Activity/SessionApproval';
import {UnifiedConversationStream} from './components/Activity/UnifiedConversationStream';
import {activityEvents} from './components/Activity/activity-events';
import type {ResponseOption} from './components/ModelSwitcher/response-mode.mjs';
import {ModelSwitcher} from './components/ModelSwitcher/ModelSwitcher';
import {SearchPopup} from './components/Sidebar/SearchPopup';
import {ChatHistory} from './components/Sidebar/ChatHistory';
import {ToolRail,ToolPanel} from './components/Sidebar/ToolWorkspace';
import type {ToolView} from './components/Sidebar/ToolWorkspace';
import {MarkdownReply} from './components/MessageThread/MarkdownReply';
import type {Snapshot} from './components/AgentPanel';
import {WallpaperSettings} from './components/WallpaperSettings';
import {useWallpaper} from './state/useWallpaper';
import type {CSSProperties} from 'react';
import type {AppTheme} from './state/useAppTheme';
import {useAppearance,baseAppearance,type StripAppearance} from './state/useAppearance';
import {useSidebar} from './state/useSidebar';
import {PacedMessage} from './components/PacedMessage';
import {useDisplayRate} from './state/useDisplayRate';
import {ConnectionSettings} from './components/ConnectionSettings';
import {useConnection} from './state/useConnection';
import {selectTurnIssue} from './components/issue-presentation.mjs';
import {NotificationHost,errorNotification} from './components/NotificationHost';
import type {Notification} from './components/NotificationHost';
import {ApiEntry} from './components/ApiEntry';
import {useUnifiedConversation} from './state/useUnifiedConversation';
import './styles/strip.css';
import './components/Activity/vendor/strip-chat-codex.css';
import './components/unified-chat.css';
import './styles/control-polish.css';
import './styles/codex-controls.css';
import './styles/theme.css';
import './styles/left-tool-workspace.css';
import './styles/claude-theme.css';
import './styles/readability.css';
import './styles/model-picker-compact.css';
import './styles/account-popover.css';
import './styles/api-entry-minimal.css';
import './styles/api-entry-motion.css';
import './styles/theme-palettes.css';
import './styles/codex-composer-refresh.css';
import './styles/composer-layout-fix.css';
import './styles/agent-buttons.css';
import './styles/claude-codex-composer.css';
import './styles/wallpaper.css';
import './styles/api-entry-merged.css';
import './styles/home-motion.css';

import './styles/border-refinement.css';
import './styles/codex-borders.css';
import './components/MessageThread/markdown-theme-bridge.css';
import './components/MessageThread/claude-output.css';
import './styles/theme-options.css';
import './components/OptionBox/option-box.css';
import './styles/stop-button.css';
import './styles/aborted-note.css';
import './styles/task-flow.css';
import './styles/activity-stream.css';
import './styles/question-card.css';

// OpenCode may return the same reply both on the message and in text parts.
// Prefer parts when available to avoid displaying an entire reply twice.
function messageOutput(message: Snapshot['messages'][number]): string {
  const parts = message.content?.filter(part => part.type === 'text').map(part => part.text || '').join('') || '';
  return parts || message.text || '';
}
type StopTarget = {
  userId: string | null;
  assistantIdsBefore: Set<string>;
  assistantId: string | null;
};
export default function App(){
  const [entered,setEntered]=useState<{settings:boolean}|null>(null);
  const {appearance,setAppearance}=useAppearance();
  const theme:AppTheme=baseAppearance(appearance)==='dark'?'dark':'light';
  const setTheme=(value:StripAppearance)=>setAppearance(value);
  return entered
    ? <WorkspaceApp onDisconnected={()=>setEntered(null)} appearance={appearance} initialSettings={entered.settings} theme={theme} onThemeChange={setTheme}/>
    : <ApiEntry appearance={appearance} onThemeChange={setTheme} onEntered={(settings=false)=>setEntered({settings})}/>;
}
function WorkspaceApp({onDisconnected,theme,onThemeChange,initialSettings,appearance}:{onDisconnected:()=>void;appearance:StripAppearance;initialSettings:boolean;theme:AppTheme;onThemeChange:(theme:StripAppearance)=>void}) {
  const wallpaper=useWallpaper();
  const showWallpaper=wallpaper.wallpaperEnabled && Boolean(wallpaper.wallpaper);
  const wallpaperStyle={'--wallpaper-opacity':String(wallpaper.opacity/100),'--wallpaper-fade':`${wallpaper.softness*.45}%`} as CSSProperties;
  const [settingsView,setSettingsView] = useState(initialSettings);
  const [settingsPageRequest,setSettingsPageRequest]=useState<{page:'project'}>();
  const connection=useConnection();
  const routeModel=connection.model,modelError=connection.error,modelsLoading=connection.loading;
  const displayRate=useDisplayRate(routeModel);
  const displayRun=useRef<Set<string>|null>(null);
  const stopTarget=useRef<StopTarget|null>(null);
  const [abortedMessages,setAbortedMessages]=useState<Set<string>>(()=>new Set());
  const refreshModels=connection.refresh;
  const [notice,setNotice] = useState('');
  const [activeTool,setActiveTool] = useState<ToolView>('history');
  const {panelOpen,setPanelOpen}=useSidebar();
  const toolsVisible=panelOpen && !settingsView;
  const composerRef = useRef<StripCodexComposerHandle>(null);
  const [homeInputActivity,setHomeInputActivity]=useState({serial:0,active:false});
  const [noticeRevision,setNoticeRevision] = useState(0);
  function showNotice(message:string){setNotice(message);setNoticeRevision(value=>value+1);}
  const effortKey='strip_reasoning_v1:'+connection.mode+':'+routeModel;
  const [nativeEffort,setNativeEffort]=useState(()=>localStorage.getItem(effortKey) || '');
  useEffect(()=>setNativeEffort(localStorage.getItem(effortKey) || ''),[effortKey]);
  const effort=connection.mode==='direct'?connection.reasoningEffort:nativeEffort;
  const presetKey='strip_response_preset_v1:'+connection.mode+':'+routeModel;
  const [responsePreset,setResponsePreset]=useState(()=>localStorage.getItem(presetKey) || '');
  useEffect(()=>setResponsePreset(localStorage.getItem(presetKey) || ''),[presetKey]);
  const conversation = useUnifiedConversation(connection.mode,connection.model,effort,true);
  const {active,snapshot,legacyContext,workspace,draft,busy} = conversation;
  const [parallelOpen,setParallelOpen]=useState(false),[parallelPath,setParallelPath]=useState(''),[parallelPrompt,setParallelPrompt]=useState(''),[parallelSending,setParallelSending]=useState(false);
  async function openParallel(){setParallelPath('');setParallelPrompt(draft);setParallelOpen(true);}
  async function launchParallel(){if(!parallelPath.trim()||!parallelPrompt.trim()||parallelSending)return;setParallelSending(true);try{await conversation.sendParallel(parallelPrompt,[],parallelPath);setParallelOpen(false);}catch(error){showNotice(error instanceof Error?error.message:'并行任务创建失败');}finally{setParallelSending(false);}}

  const commands=useManualCommands({session:active,snapshot,blocked:busy || conversation.loading || conversation.sending,onError:showNotice});
  const scroll = useRef<HTMLDivElement>(null);
  const followReply = useRef(true);
  // Follow growing Markdown while generating, unless the user scrolled upward.
  useEffect(() => {
    const panel = scroll.current;
    const output = panel?.querySelector('.strip-messages');
    if (!panel || !output) return;
    followReply.current = true;
    const handleScroll = () => {
      followReply.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 140;
    };
    const observer = new ResizeObserver(() => {
      if (followReply.current) panel.scrollTo({top: panel.scrollHeight});
    });
    observer.observe(output);
    panel.addEventListener('scroll', handleScroll, {passive: true});
    return () => {
      observer.disconnect();
      panel.removeEventListener('scroll', handleScroll);
    };
  }, [active, settingsView]);
  useEffect(() => {
    const panel = scroll.current;
    if (panel && followReply.current) panel.scrollTo({top: panel.scrollHeight});
  }, [snapshot, active]);
  const selectedModel=routeModel;
  const model = active.startsWith('ses_') ? snapshot?.model?.id || '读取会话模型…' : selectedModel;
  const models=active.startsWith('ses_') ? [{value:model,label:model,description:'会话已绑定模型'}]: [{value:routeModel,label:routeModel || '等待模型',description:connection.mode==='opencode'?'Codex CLI · OpenAI':connection.mode==='direct'?'当前 API 连接':'自动跟随 CC Switch · Codex 路由'}];
  const entries=[...conversation.sessions.map(s=>({id:s.id,title:s.title,description:conversation.overview.runningSessions.includes(s.id)?'执行中':conversation.overview.pausedSessions.includes(s.id)?'队列已暂停':'对话 · 编程',updatedAt:s.updatedAt || 0,workspace:s.workspace || ''})),...conversation.legacyChats.filter(c=>!conversation.sessions.some(s=>s.legacyId===c.id)).map(c=>({id:'legacy:'+c.id,title:c.title,description:'历史对话',updatedAt:c.updatedAt,workspace:''}))].sort((a,b)=>b.updatedAt-a.updatedAt);
  const messages=[...(snapshot?.messages || [])].reverse().filter(m=>m.type==='user' || m.type==='assistant' || m.error);
  const lastTurnUserIndex=messages.map(message=>message.type).lastIndexOf('user');
  const lastTurnAssistantIndex=messages.map(message=>message.type).lastIndexOf('assistant');
  const lastAssistantId=[...messages].reverse().find(message=>message.type==='assistant')?.id;
  function markMessageStopped(id:string) {
    if(!id)return;
    setAbortedMessages(current=>current.has(id)?current:new Set(current).add(id));
  }
  function stopResponse(){
    const baseline=displayRun.current;
    const candidate=lastTurnAssistantIndex>lastTurnUserIndex?messages[lastTurnAssistantIndex]:undefined;
    const assistantId=candidate && !baseline?.has(candidate.id)?candidate.id:null;
    // If the snapshot has not received the new user message yet, the last user is
    // from the previous turn. Anchor by message IDs instead of reusing that user.
    const awaitingNewUser=Boolean(candidate && baseline?.has(candidate.id));
    stopTarget.current={
      userId:awaitingNewUser?null:lastTurnUserIndex>=0?messages[lastTurnUserIndex].id:null,
      assistantIdsBefore:new Set(messages.filter(message=>message.type==='assistant').map(message=>message.id)),
      assistantId,
    };
    if(assistantId)markMessageStopped(assistantId);
    displayRun.current=null;
    return conversation.stop();
  }
  useEffect(()=>{
    const target=stopTarget.current;
    if(!target || target.assistantId)return;
    let candidate:Snapshot['messages'][number]|undefined;
    if(target.userId){
      const userIndex=messages.findIndex(message=>message.id===target.userId);
      if(userIndex>=0)candidate=messages.slice(userIndex+1).find(message=>message.type==='assistant');
    }
    candidate ||= messages.find(message=>message.type==='assistant' && !target.assistantIdsBefore.has(message.id));
    if(candidate){markMessageStopped(candidate.id);target.assistantId=candidate.id;}
  },[snapshot]);
  const modelChanged = Boolean(snapshot?.configurationChanged || (snapshot?.model && snapshot.model.providerID!==(connection.mode==='opencode'?'openai':'strip-local')) || (snapshot?.model && (snapshot.connection || 'ccswitch')!==connection.mode) || (connection.mode==='direct' && snapshot?.connectionRevision && snapshot.connectionRevision!==connection.revision) || (routeModel && snapshot?.model && snapshot.model.id !== routeModel));
  const waiting = Boolean(snapshot?.permissions.length || snapshot?.forms.length);
  const blockedReason = (commands.running || snapshot?.manualRunning) ? '手动命令正在运行，请结束后再发送。':modelChanged ? '连接或模型已变化，请保留输入并新建对话。':conversation.loading ? '正在读取会话，请稍候。':waiting ? '请先处理对话中的审批或问题。':!workspace ? '请填写有效的项目目录。':modelsLoading ? '正在加载模型，请稍候。':modelError ? modelError:!active.startsWith('ses_') && !selectedModel ? '未读取到模型，请先配置模型连接。':'';
  const blocked = Boolean(blockedReason);
  function newChat(){commands.close();displayRun.current=null;stopTarget.current=null;setAbortedMessages(new Set());conversation.newConversation();setSettingsView(false);setActiveTool('history');if(window.innerWidth<=900)setPanelOpen(false);requestAnimationFrame(()=>composerRef.current?.focus());}
  function openTool(view:ToolView){commands.close();
    setSettingsView(false);
    setActiveTool(view);
    setPanelOpen(current=>settingsView || view!==activeTool || !current);
  }
  function selectConversation(id:string){commands.close();displayRun.current=null;stopTarget.current=null;setAbortedMessages(new Set());conversation.select(id);setSettingsView(false);if(window.innerWidth<=900)setPanelOpen(false);requestAnimationFrame(()=>composerRef.current?.focus());}
  function openProject(path:string){if(conversation.sending || conversation.removing || conversation.loading)return;conversation.setWorkspace(path);newChat();}
  function openProjectSettings(){commands.close();setSettingsPageRequest({page:'project'});setSettingsView(true);if(window.innerWidth<=900)setPanelOpen(false);}
  function openSettings(){commands.close();setSettingsPageRequest(undefined);setSettingsView(true);if(window.innerWidth<=900)setPanelOpen(false);}
  function showExecution(){
    setSettingsView(false);if(window.innerWidth<=900)setPanelOpen(false);
    requestAnimationFrame(()=>scroll.current?.querySelector('.strip-stream-toolbar')?.scrollIntoView({block:'start',behavior:'smooth'}));
  }
  function addAttachment(){if(settingsView){setSettingsView(false);showNotice('已返回对话，点击左侧添加附件按钮选择文件。');return;}composerRef.current?.openFilePicker();}
  function applyModel(mode:typeof connection.mode,nextModel:string){
    if(busy)return;
    displayRun.current=null;stopTarget.current=null;setAbortedMessages(new Set());
    if(mode==='opencode')connection.selectNativeModel(nextModel);
    if(mode!==connection.mode)connection.select(mode);
    else void connection.refresh();
    conversation.newConversation(draft);
  }
  async function applyResponseMode(selection:ResponseOption){
    if(busy)throw new Error('请等待当前任务结束。');
    const targetModel=selection.model;
    const changed=targetModel!==routeModel || selection.variant!==effort;
    // Save actual API reasoning before updating the local preset indicator.
    if(connection.mode==='direct' && selection.variant!==effort){
      const response=await fetch('/api/connection/effort',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:routeModel,effort:selection.variant})});
      const result=await response.json();if(!response.ok)throw new Error(result.error || '保存推理参数失败');
      await connection.refresh();
    }
    if(connection.mode==='opencode'){
      localStorage.setItem('strip_reasoning_v1:opencode:'+targetModel,selection.variant);
      if(targetModel!==routeModel)connection.selectNativeModel(targetModel);
      setNativeEffort(selection.variant);
    }
    displayRate.commitForModel(targetModel,selection.displayRate);
    try{localStorage.setItem('strip_response_preset_v1:'+connection.mode+':'+targetModel,selection.id);}catch{showNotice('响应模式已应用，但本地偏好保存失败。');}
    setResponsePreset(selection.id);
    if(changed && connection.mode!=='ccswitch'){
      displayRun.current=null;conversation.newConversation(draft);
    }
  }
  const activityCount=activityEvents(snapshot).length;
  const sourceLabel=connection.mode==='opencode'?'Codex CLI · ChatGPT':connection.mode==='direct'?'直接 API':'CC Switch';
  const notifications:Notification[]=[];
  const primaryIssue=selectTurnIssue(messages,conversation.error);
  if(primaryIssue)notifications.push(errorNotification(primaryIssue.id,primaryIssue.raw));
  if(modelError) notifications.push({id:'model',title:'连接提示',message:modelError,action:<button className="strip-btn strip-btn--secondary strip-btn--sm" disabled={modelsLoading || busy} onClick={()=>void refreshModels()}>重新加载模型</button>});
  if(modelChanged) notifications.push({id:'model-changed',title:'模型已变化',message:'此会话保留原模型，请新建对话继续。',action:<button className="strip-btn strip-btn--secondary strip-btn--sm" disabled={busy} onClick={()=>conversation.newConversation(draft)}>保留输入并新建对话</button>});
  if(blockedReason && !modelError && !modelChanged && !modelsLoading && !conversation.loading && !waiting) notifications.push({id:'blocked',title:'消息提示',message:blockedReason,action:!selectedModel?<button className="strip-btn strip-btn--secondary strip-btn--sm" disabled={busy} onClick={()=>void refreshModels()}>重新加载模型</button>:<button className="strip-btn strip-btn--secondary strip-btn--sm" onClick={openSettings}>打开设置</button>});
  if(notice) notifications.push({id:'composer-'+noticeRevision,title:'消息提示',message:notice});
  return <div className={shell.app+' strip-app strip-ui'} data-theme={theme} data-appearance={baseAppearance(appearance)} data-wallpaper={showWallpaper} style={wallpaperStyle}>
    {showWallpaper && <div className="strip-wallpaper-layer" data-fit={wallpaper.fit} aria-hidden="true"><img src={wallpaper.wallpaper!.url} alt="" draggable={false}/></div>}
    {toolsVisible && <button type="button" className="strip-overlay" aria-label="关闭工具面板" onClick={()=>setPanelOpen(false)}/>}
    <ToolRail active={activeTool} opened={toolsVisible} settings={settingsView} busy={conversation.sending}
      onTool={openTool} onNew={newChat} searchControl={<SearchPopup entries={entries} active={active} busy={conversation.sending || !!conversation.removing} onSelect={selectConversation}/>} onAttach={addAttachment} onToggle={()=>{if(settingsView){setSettingsView(false);setPanelOpen(true);}else setPanelOpen(value=>!value);}} onSettings={openSettings} accountControl={<ApiAccountMenu mode={connection.mode} model={routeModel} busy={busy || waiting || conversation.loading} appearance={appearance} onWorkspace={openProjectSettings} onSettings={openSettings} onToggleTheme={openSettings} onDisconnected={onDisconnected}/>}/>
    <ToolPanel active={activeTool} opened={toolsVisible} onClose={()=>setPanelOpen(false)}>
      {activeTool==='integrations' && <IntegrationsTool/>}
      {activeTool==='backend' && <BackendProjectsTool modelName={model} disabled={busy || !!snapshot?.manualRunning || conversation.loading || conversation.sending} onSelect={folder=>{
        if(busy || snapshot?.manualRunning || conversation.loading || conversation.sending){showNotice('请完成当前任务后再切换本地后端。');return;}
        conversation.setWorkspace(folder);newChat();showNotice('已切换到授权后端；新对话将使用该项目源码。');
      }}/>}
      {activeTool==='astrbot' && <AstrBotTool/>}
      {activeTool==='skills' && <SkillsTool/>}
      {activeTool==='github-tools' && <GithubToolsTool onOpenSkills={()=>setActiveTool('skills')}/>}
      {activeTool==='history' && <>
        <ChatHistory entries={entries} search="" active={active} busy={conversation.sending || !!conversation.removing || conversation.loading} workspace={workspace} onOpenProject={openProject} onProjectSettings={openProjectSettings} onSelect={selectConversation} onRemove={id=>{if(window.confirm('确定永久删除这条会话及其后端记录？此操作无法撤销。'))void conversation.remove(id);}}/>
        <p className="strip-attribution">Strip Bot · <a href="https://lucide.dev" target="_blank" rel="noreferrer">Lucide Icons</a></p>
      </>}
      {activeTool==='activity' && <div className="strip-tool-content">
        <div className="strip-tool-meta"><span>任务来源</span><strong>{sourceLabel} · {model || '尚未连接'}</strong></div>
        <h3 className="strip-tool-section-heading">执行与输出记录 <span>{activityCount}</span></h3>
        <p className="strip-tool-description">执行步骤、命令输出和文件差异已与聊天合并，共享同一个滚动区域。</p>
        <button type="button" className="strip-tool-action" onClick={showExecution}>查看会话执行记录</button>
      </div>}
    </ToolPanel>
    {parallelOpen && <dialog open aria-label="并行新任务" className="strip-task-dialog"><form onSubmit={event=>{event.preventDefault();void launchParallel();}}><h2>并行新任务</h2><p>在独立会话中执行，最多同时运行 3 个任务。相同或嵌套目录会自动排队。</p><label>项目目录<input autoFocus required value={parallelPath} onChange={event=>setParallelPath(event.target.value)} placeholder="填写已授权的项目目录"/></label><label>任务指令<textarea required rows={4} value={parallelPrompt} onChange={event=>setParallelPrompt(event.target.value)}/></label><div><button type="button" disabled={parallelSending} onClick={()=>setParallelOpen(false)}>取消</button><button type="submit" disabled={parallelSending||!parallelPath.trim()||!parallelPrompt.trim()}>{parallelSending?'提交中…':'创建任务'}</button></div></form></dialog>}
    <main className={shell.main+' strip-wallpaper-main'}>{settingsView ? <ConnectionSettings pageRequest={settingsPageRequest} appearanceSettings={<WallpaperSettings theme={appearance} onThemeChange={onThemeChange} wallpaper={wallpaper}/>} displayRate={displayRate} metrics={snapshot?.metrics} workspace={snapshot?.workspace || workspace} workspaceLocked={active.startsWith('ses_') || busy} onWorkspace={conversation.setWorkspace} mode={connection.mode} account={connection.account} nativeModel={connection.model} onNativeModel={connection.selectNativeModel} busy={busy} onMode={value=>{if(value!==connection.mode){connection.select(value);conversation.newConversation(draft);}}} onBack={()=>setSettingsView(false)} onSaved={()=>void refreshModels()}/> : <>
      <div className="strip-thread strip-unified-thread" ref={scroll}>
        {!messages.length && !legacyContext?.messages.length && !conversation.loading && <HomeWelcome inputActivity={homeInputActivity}/>}
        <div className="strip-messages strip-chat--codex strip-stream">
          {legacyContext?.messages.map(m=><article className={'strip-message strip-chat__message strip-chat__message--'+m.role+' '+m.role} data-message-role={m.role} aria-label={m.role==='user'?'用户消息':'助手回复'} key={'legacy-'+m.id}><div className="strip-message-content strip-chat__body">{m.role==='assistant' ? <MarkdownReply text={m.content} onError={showNotice}/> : <span>{m.content}</span>}</div></article>)}
          {legacyContext && !active.startsWith('ses_') && <p className="strip-muted">继续发送会将以上文本上下文带入统一会话。</p>}
          <UnifiedConversationStream key={active} snapshot={snapshot} busy={busy} loading={conversation.loading}
            deciding={conversation.deciding || (conversation.modeUpdating?'mode':'')}
            onDecide={conversation.decide} onApproveAll={conversation.approveAllPending}
            onAnswer={conversation.answer} onError={showNotice} onPause={conversation.pause} onResume={conversation.resume} onCancelTask={conversation.cancelTask} onParallel={openParallel}
            renderMessage={message=>{
              const aborted=message.type==='assistant' && abortedMessages.has(message.id);
              if(!['user','assistant'].includes(message.type) || (!messageOutput(message) && !message.error && !aborted))return null;
              return <article className={'strip-message strip-chat__message strip-chat__message--'+(message.type==='user' ? 'user':'assistant')+' '+(message.type==='user' ? 'user':'assistant')} data-message-role={message.type==='user'?'user':'assistant'} aria-label={message.type==='user'?'用户消息':'助手回复'} key={message.id}>
            <div className="strip-message-content strip-chat__body">{message.type==='user' ? <span>{messageOutput(message)}</span> : <PacedMessage text={messageOutput(message)} rate={displayRate.rate} animate={!!displayRun.current && !displayRun.current.has(message.id)} drain={!aborted}>{visible=><MarkdownReply text={visible} copySource={messageOutput(message)} streaming={Boolean(snapshot?.running && message.id===lastAssistantId && !aborted)} onError={showNotice}/>}</PacedMessage>}
            </div>
            {aborted && <p className="strip-aborted-note" role="status">已停止生成</p>}
          </article>;
            }}/><WorkspaceActions snapshot={snapshot} session={active} onError={showNotice}/>

        </div>
      </div>
      <div className={box.wrapper+' strip-claude-composer-wrap strip-composer-region'}><CommandPalette open={commands.open} session={active} workspace={snapshot?.workspace || workspace || ''} executing={commands.running} agentRunning={busy || commands.anyRunning || !!snapshot?.manualRunning || conversation.loading || waiting} disabledReason={commands.disabledReason || undefined} results={commands.results} onClose={commands.close} onRun={commands.run} onError={showNotice}/><StripCodexComposer ref={composerRef} key={active} toolsInSidebar value={draft} onValueChange={conversation.setDraft} onInputActivity={active=>{if(!messages.length && !legacyContext?.messages.length && !conversation.loading)setHomeInputActivity(previous=>({serial:previous.serial+1,active}));}} busy={busy} queueWhileBusy onStop={stopResponse} sendDisabled={blocked} sendDisabledReason={blockedReason} models={models} selectedModel={model} modelReadOnly permissionControl={<SessionApproval mode={conversation.approvalMode} updating={conversation.modeUpdating} disabled={conversation.approvalMode==='ask' && (modelChanged || conversation.loading || conversation.sending)} workspace={snapshot?.workspace || workspace} onChange={conversation.setApprovalMode}/>} modelControl={<ModelSwitcher effort={effort} presetId={responsePreset} onResponseMode={applyResponseMode} mode={connection.mode} model={routeModel} busy={busy || conversation.loading} onApply={applyModel}/>} environments={[{value:'local',label:'项目'}]} placeholder="提问、阅读代码、修改文件，或描述要完成的任务…" onError={e=>showNotice(e instanceof Error ? e.message:'发送失败')} onSend={async ({text,files})=>{displayRun.current=new Set(messages.map(message=>message.id));stopTarget.current=null;await conversation.send(text,files);if(window.innerWidth<=900)setPanelOpen(false);}}/>
      </div>
    </>}</main>
    <NotificationHost items={notifications} scope={active}/>
  </div>;
}







