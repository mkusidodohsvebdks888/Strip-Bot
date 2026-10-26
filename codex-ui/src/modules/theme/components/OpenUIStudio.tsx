import {useEffect,useState} from 'react';
import {applyImportedTheme,clearImportedTheme,hasImportedTheme,parseOpenUITheme} from '../state/generated-theme';
import '../styles/openui-studio.css';
import {generateUI,type GeneratedUI} from '../state/ui-code-generator';

type OpenUIStatus={online:boolean;url:string;source:string};
type Layout='codex'|'compact'|'focus';
const layoutOptions=[
 {id:'codex',label:'Codex 标准',detail:'侧栏 · 对话 · 底部输入框'},
 {id:'compact',label:'紧凑工作台',detail:'窄侧栏 · 双栏工作区'},
 {id:'focus',label:'专注模式',detail:'隐藏侧栏 · 宽对话区'}
] as const;
const TARGETS=['聊天工作区','设置页面','插件页面','项目列表'] as const;
function buildImplementationPrompt(instruction:string,layout:Layout,target:string,code:string){
 const palette=parseOpenUITheme(code);
 return ['请在 StripBot 项目中提出并实现以下 UI 改造（仅在用户明确批准后修改文件）：',
 '目标模块：'+target,'布局：'+layoutOptions.find(x=>x.id===layout)?.label,
 '设计需求：'+instruction,'主题变量：',...Object.entries(palette).map(([k,v])=>k+': '+v+';'),
 '执行要求：请先阅读项目真实源码，使用当前会话模型生成具体 React/TSX/CSS 修改。先输出修改计划和文件列表，不要立刻写入文件；等待我在会话中明确回复「批准应用」后才修改。不得绕过逐次审批，不得改动无关模块。',
 '用户批准后：修改真实业务页面，保留原有功能、审批流程、模型速率拉杆和桌宠逻辑。完成后列出文件变更，并提示使用当前任务的差异与快照恢复功能审核或撤销。',
 '若项目无法读取、任务快照不可用或没有审批能力，请停止并说明原因。'].join('\n');
}
const example=`:root {
  --bg: #f7f9fc;
  --fg: #263044;
  --accent: #819fc4;
  --card-bg: #ffffff;
  --sidebar-bg: #edf1f8;
}`;

const presets=[
 {id:'codex-light',label:'Codex · 明亮',description:'柔和白色、灰色侧栏、低饱和蓝色',palette:{'--bg':'#f8f9fb','--fg':'#222831','--accent':'#718cad','--card-bg':'#ffffff','--sidebar-bg':'#f0f2f5','--muted':'#737b86','--surface-2':'#eef1f5'}},
 {id:'codex-dark',label:'Codex · 深色',description:'深灰工作区、克制的对比度',palette:{'--bg':'#181a1d','--fg':'#e8e9eb','--accent':'#9db2ce','--card-bg':'#212429','--sidebar-bg':'#15171a','--muted':'#a1a7b0','--surface-2':'#282b30'}},
 {id:'glass',label:'柔和毛玻璃',description:'浅色背景、柔和卡片和边框',palette:{'--bg':'#edf2f7','--fg':'#2b3544','--accent':'#829cb8','--card-bg':'#f9fbfe','--sidebar-bg':'#e4ebf3','--muted':'#778596','--surface-2':'#f1f5fa'}}
] as const;
function paletteCss(palette:Record<string,string>){return ':root {\n'+Object.entries(palette).map(([key,value])=>'  '+key+': '+value+';').join('\n')+'\n}';}

export function OpenUIStudio({onSendToAgent,onGenerateWithAgent,sessionID}:{onSendToAgent?:(prompt:string)=>void;onGenerateWithAgent?:(prompt:string)=>Promise<void>;sessionID?:string}={}){
 const [service,setService]=useState<OpenUIStatus|null>(null);
 const [loading,setLoading]=useState(true);
 const [showFrame,setShowFrame]=useState(false);
 const [code,setCode]=useState(example);
 const [instruction,setInstruction]=useState('设计一个 Codex 风格的简洁 AI Agent 工作台，圆角矩形、清晰的信息层级、柔和对比度，保持输入框和工具栏易用。');
 const [preview,setPreview]=useState<Record<string,string>|null>(null);
 const [layout,setLayout]=useState<Layout>('codex');
 const [target,setTarget]=useState<string>(TARGETS[0]);
 const [implementation,setImplementation]=useState('');
 const [generated,setGenerated]=useState<GeneratedUI|null>(null);
 const [sourceDraft,setSourceDraft]=useState('');
 const [workflowStep,setWorkflowStep]=useState<'design'|'review'|'applied'>('design');
 const [undo,setUndo]=useState<string|null>(null);
 const [proposal,setProposal]=useState<{id:string;hash:string;filename:string;diff:string;validation?:{ok:boolean;engine:string;note:string}}|null>(null);
 const [applying,setApplying]=useState(false);
 const [message,setMessage]=useState('');
 const [hasCustom,setHasCustom]=useState(hasImportedTheme);
 async function refresh(){
   setLoading(true);
   try{
     const response=await fetch('/api/openui/status',{cache:'no-store'});
     const result=await response.json() as OpenUIStatus&{error?:string};
     if(!response.ok)throw new Error(result.error||'OpenUI 连接失败');
     setService(result);
   }catch{setService({online:false,url:'http://127.0.0.1:7878/',source:''});}
   finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{
   const sync=()=>setHasCustom(hasImportedTheme());
   window.addEventListener('strip:openui-theme-changed',sync);
   return ()=>window.removeEventListener('strip:openui-theme-changed',sync);
 },[]);
 function generateCode(){try{setProposal(null);setUndo(null);const next=generateUI({instruction,layout,target,css:code});setGenerated(next);setSourceDraft(next.source);setWorkflowStep('review');setMessage('已生成 React 组件草稿；提交审核后可查看服务器计算的文件差异。');}catch(error){setMessage(error instanceof Error?error.message:'生成失败');}}
 async function startAgentGeneration(){if(!onGenerateWithAgent){setMessage('当前没有可用的 Agent 执行入口。');return;}if(!window.confirm('将使用当前模型启动真实页面 UI 改造任务。模型会先读取源码并输出计划，后续修改需在聊天中批准。继续？'))return;setApplying(true);try{const prompt=buildImplementationPrompt(instruction,layout,target,code);await onGenerateWithAgent(prompt);setMessage('已向当前 Agent 会话提交生成任务，请在聊天页审核计划。');}catch(error){setMessage(error instanceof Error?error.message:'AI 生成任务提交失败');}finally{setApplying(false);}}
 async function proposeFile(){if(!generated||!sessionID?.startsWith('ses_')){setMessage('请先创建或打开 StripBot Agent 会话并选择项目目录。');return;}setApplying(true);try{const response=await fetch('/api/agent/sessions/'+encodeURIComponent(sessionID)+'/ui-generation/propose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:generated.filename,source:sourceDraft})});const data=await response.json();if(!response.ok)throw new Error(data.error||data.message||'无法创建草案');setProposal(data);setWorkflowStep('review');setMessage('服务端已检查待新增文件，请核对差异后批准。');}catch(error){setMessage(error instanceof Error?error.message:'请求失败');}finally{setApplying(false);}}
 async function applyFile(){if(!proposal||!sessionID)return;if(!window.confirm('确认在当前项目应用 '+proposal.filename+' 吗？此操作会写入本地磁盘。'))return;setApplying(true);try{const response=await fetch('/api/agent/sessions/'+encodeURIComponent(sessionID)+'/ui-generation/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:proposal.id,hash:proposal.hash,confirmed:true})});const data=await response.json();if(!response.ok)throw new Error(data.error||data.message||'应用失败');setMessage('已应用 '+data.filename+'，可在当前会话中撤销。');setUndo(data.undo||null);setProposal(null);setWorkflowStep('applied');}catch(error){setMessage(error instanceof Error?error.message:'应用失败');}finally{setApplying(false);}}
 async function rollbackFile(){if(!undo||!sessionID)return;if(!window.confirm('恢复上次生成式 UI 修改？如果文件已被其他操作修改，将拒绝恢复。'))return;setApplying(true);try{const response=await fetch('/api/agent/sessions/'+encodeURIComponent(sessionID)+'/ui-generation/rollback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({undo,confirmed:true})});const data=await response.json();if(!response.ok)throw new Error(data.error||data.message||'恢复失败');setUndo(null);setWorkflowStep('review');setMessage('已恢复 '+data.filename);}catch(error){setMessage(error instanceof Error?error.message:'恢复失败');}finally{setApplying(false);}}
 function prepareImplementation(){try{const prompt=buildImplementationPrompt(instruction,layout,target,code);setImplementation(prompt);setMessage('已生成代码改造任务草案；尚未修改任何项目文件。');}catch(error){setMessage(error instanceof Error?error.message:'无法生成任务草案');}}
 function previewColors(){try{setPreview(parseOpenUITheme(code));setMessage('已生成本地颜色预览；未修改当前主题。');}catch(error){setMessage(error instanceof Error?error.message:'预览失败');}}
 function apply(){
   try{
     const palette=parseOpenUITheme(code);
     if(!window.confirm('将生成的颜色应用到 StripBot 各模块？原来的主题可以恢复。'))return;
     applyImportedTheme(palette);
     setMessage('已经导入 '+Object.keys(palette).length+' 项主题颜色，可以随时恢复。');
   }catch(error){setMessage(error instanceof Error?error.message:'颜色导入失败');}
 }
 return <section className="strip-connection-card strip-openui-studio" aria-label="OpenUI 生成式界面">
   <div className="strip-openui-studio__header"><div><h2>生成式 UI · OpenUI</h2><p>使用自然语言描述界面，实时预览，反复调整，再把颜色导入 StripBot。</p></div>
     <span className={'strip-openui-status'+(service?.online?' is-ready':'')}>{loading?'检测中…':service?.online?'已连接 OpenUI':'OpenUI 未启动'}</span>
   </div>
   <div className="strip-openui-workflow" aria-label="UI 开发工作流"><strong>页面开发流程</strong><div><span data-active={workflowStep==='design'}>① 设计与生成</span><span data-active={workflowStep==='review'}>② 差异审核与批准</span><span data-active={workflowStep==='applied'}>③ 已应用 · 可撤销</span></div><p className="strip-muted">模板组件可在此完成服务端审核与写入；真实业务页面通过 Agent 任务执行，使用任务差异、审批与快照恢复。两种流程不会绕过原有权限。</p></div>
   <div className="strip-openui-presets"><h3>Codex 风格预设</h3><p className="strip-muted">选择预设后可预览、编辑并确认应用，不会直接覆盖当前主题。</p><div className="strip-openui-preset-grid">{presets.map(item=><button key={item.id} type="button" onClick={()=>{setCode(paletteCss(item.palette));setPreview({...item.palette});setMessage('已选择 '+item.label+'，确认应用前不会修改主题。');}}><span className="strip-openui-preset-swatch" style={{background:item.palette['--bg'],color:item.palette['--fg'],borderColor:item.palette['--accent']}}>Aa <span style={{background:item.palette['--accent']}}/></span><strong>{item.label}</strong><small>{item.description}</small></button>)}</div></div>
   <div className="strip-openui-instructions"><label htmlFor="strip-openui-prompt">界面设计需求</label><textarea id="strip-openui-prompt" rows={3} value={instruction} onChange={event=>setInstruction(event.target.value.slice(0,2000))}/><button type="button" className="strip-btn strip-btn--secondary" onClick={()=>{const prompt=instruction+'\\n请输出 :root CSS 颜色变量，至少包含 --bg、--fg、--accent；仅使用十六进制颜色。';void navigator.clipboard.writeText(prompt).then(()=>setMessage('设计需求已复制，可粘贴到 OpenUI 生成器。')).catch(()=>setMessage('无法复制，请手动复制设计需求。'));}}>复制生成指令</button><p className="strip-muted">生成需要本地 OpenUI 服务及其单独配置的 AI 模型；预设和颜色预览可离线使用。</p></div>
   <div className="strip-openui-layouts"><h3>工作区布局</h3><div className="strip-openui-layout-grid">{layoutOptions.map(item=><button type="button" key={item.id} aria-pressed={layout===item.id} onClick={()=>setLayout(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div><label>改造目标<select value={target} onChange={event=>setTarget(event.target.value)}>{TARGETS.map(item=><option key={item}>{item}</option>)}</select></label><button className="strip-btn strip-btn--secondary" type="button" onClick={prepareImplementation}>生成 Codex 改造任务</button>{onGenerateWithAgent&&<button className="strip-btn strip-btn--primary" type="button" disabled={applying} onClick={()=>void startAgentGeneration()}>{applying?'提交中…':'使用当前 AI 模型生成真实页面'}</button>}<button className="strip-btn strip-btn--primary" type="button" onClick={generateCode}>生成 React 页面代码与差异</button>{undo&&<button type="button" className="strip-btn strip-btn--secondary" disabled={applying} onClick={()=>void rollbackFile()}>撤销上次生成式 UI 修改</button>}{generated&&<div className="strip-openui-generated"><strong>目标文件：{generated.filename}</strong><p className="strip-muted">{generated.summary}</p><label htmlFor="strip-openui-source">React 组件源码（可粘贴 AI 生成结果并修改）</label><textarea id="strip-openui-source" rows={14} spellCheck={false} value={sourceDraft} onChange={event=>{setSourceDraft(event.target.value.slice(0,100000));setProposal(null);}}/><p className="strip-muted">修改源码后必须重新提交草案。服务器将根据实际文件内容重新计算差异和校验。</p><button type="button" className="strip-btn strip-btn--secondary" disabled={applying} onClick={()=>void proposeFile()}>提交文件草案审核</button>{proposal&&<div className="strip-openui-proposal"><strong>服务端待批准差异：{proposal.filename}</strong>{proposal.validation&&<p className="strip-openui-validation" role="status">✓ {proposal.validation.engine} 语法检查通过。{proposal.validation.note}</p>}<pre>{proposal.diff}</pre><button type="button" className="strip-btn strip-btn--primary" disabled={applying} onClick={()=>void applyFile()}>{applying?'处理中…':'批准并写入本地文件'}</button></div>}<button type="button" className="strip-btn strip-btn--secondary" onClick={()=>{void navigator.clipboard.writeText(sourceDraft).then(()=>setMessage('组件源码已复制。')).catch(()=>setMessage('复制失败。'));}}>复制 React 源码</button><p className="strip-muted">支持粘贴 Agent 生成的 TSX 代码并进行服务端差异审核。自动调用 AI 生成代码仍需在 Agent 会话中执行；不会直接覆盖现有业务页面。</p></div>}{implementation&&<div className="strip-openui-implementation"><label htmlFor="strip-openui-task">待审核的代码修改任务</label><textarea id="strip-openui-task" readOnly rows={9} value={implementation}/><button type="button" className="strip-btn strip-btn--secondary" onClick={()=>{void navigator.clipboard.writeText(implementation).then(()=>setMessage('已复制任务，请在 Codex 会话中审核并执行。')).catch(()=>setMessage('复制失败，请手动复制。'));}}>复制到 Codex 使用</button>{onSendToAgent&&<button type="button" className="strip-btn strip-btn--primary" onClick={()=>{if(!window.confirm('将改造任务放入 StripBot 聊天输入框？不会自动发送或修改文件。'))return;onSendToAgent(implementation);}}>送入 StripBot Agent 输入框</button>}<p className="strip-muted">不会自动修改源代码。请在 Codex 中先审查变更范围，再明确批准执行。</p></div>}</div>
   <div className="strip-openui-actions">
     <button className="strip-btn strip-btn--secondary" type="button" disabled={!service?.online} onClick={()=>setShowFrame(v=>!v)}>{showFrame?'收起生成器':'打开 OpenUI 生成器'}</button>
     <a className="strip-btn strip-btn--secondary" href="http://127.0.0.1:7878/ai" target="_blank" rel="noopener noreferrer">浏览器打开</a>
     <button className="strip-btn strip-btn--secondary" type="button" disabled={loading} onClick={()=>void refresh()}>刷新状态</button>
   </div>
   {!service?.online&&<div className="strip-openui-help" role="status">
      <strong>先运行 OpenUI（本地独立服务）</strong>
      <p>在项目根目录执行 <code>powershell -ExecutionPolicy Bypass -File scripts/openui/Start-OpenUI.ps1</code>。需要 Docker Desktop，首次运行会下载构建依赖。</p>
      <p>AI 模型在 OpenUI 内独立配置；不会读取或转发 StripBot 已保存的 API 密钥。</p>
   </div>}
   {showFrame&&service?.online&&<div className="strip-openui-frame"><iframe title="OpenUI 本地界面设计器" src="http://127.0.0.1:7878/ai" loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin allow-downloads allow-popups"/></div>}
   <div className="strip-openui-import">
      <h3>将生成的主题应用到 StripBot</h3>
      <p>在 OpenUI 中要求模型输出 <code>:root</code> 格式 CSS 变量，把颜色粘贴到这里。只接受安全的十六进制颜色，不执行生成的 HTML、脚本或任意 CSS。</p>
      <label htmlFor="strip-openui-css">主题颜色变量</label>
      <textarea id="strip-openui-css" rows={7} spellCheck={false} value={code} onChange={event=>setCode(event.target.value)}/>
      <div className="strip-openui-actions">
        <button className="strip-btn strip-btn--secondary" type="button" onClick={previewColors}>预览颜色</button>
        <button className="strip-btn strip-btn--primary" type="button" onClick={apply}>确认并应用</button>
        <button className="strip-btn strip-btn--secondary" type="button" disabled={!hasCustom} onClick={()=>{clearImportedTheme();setMessage('已恢复 StripBot 原有主题颜色。');}}>恢复原主题</button>
      </div>
      {preview&&<div className="strip-openui-live-preview" style={{background:preview['--bg'],color:preview['--fg']}}><aside style={{background:preview['--sidebar-bg']||preview['--bg']}}>对话<br/>项目<br/>设置</aside><div><strong>StripBot · 主题预览</strong><p>这是独立预览，不影响当前界面。</p><div style={{background:preview['--card-bg']||preview['--bg']}}>Agent 已准备就绪 <span style={{color:preview['--accent']}}>●</span></div></div></div>}
      {message&&<p className="strip-openui-feedback" role="status">{message}</p>}
   </div>
 </section>;
}
