import { useState } from 'react';
import {
  AgentTheme, AgentButton, AgentIconButton, AgentSegmented, AgentDropdown,
  AgentApprovalActions, AgentComposer, type AgentUIStyle, type AgentMode,
} from './AgentButtons';
// In your Strip Bot app, import this CSS once from wherever you copied it:
// import '../assets/buttons.css';

/** Drop-in example panel with working state; no external APIs. */
export default function AgentButtonShowcase() {
  const [ui, setUI] = useState<AgentUIStyle>('codex');
  const [mode, setMode] = useState<AgentMode>('light');
  const [view, setView] = useState('chat');
  const [model, setModel] = useState('GPT-6');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('等待操作');
  const [approval, setApproval] = useState(true);

  return <div style={{padding: 20, maxWidth: 840, margin: 'auto'}}>
    <div style={{display: 'flex',gap: 8, marginBottom: 15}}>
      <button onClick={() => setUI(ui === 'codex' ? 'claude' : ui === 'claude' ? 'fusion' : 'codex')}>
        当前风格：{ui}（点击切换）
      </button>
      <button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>切换 {mode} 主题</button>
    </div>
    <AgentTheme ui={ui} mode={mode} style={{padding: 25, borderRadius: 18, background: 'var(--scb-bg)'}}>
      <h2 style={{margin: '0 0 15px'}}>Strip Bot / Button demo</h2>
      <div className="scb-btn-row">
        <AgentButton variant="primary" icon="plus" onClick={() => setStatus('新建任务')}>新建任务</AgentButton>
        <AgentButton variant="secondary" icon="folder" onClick={() => setStatus('打开文件')}>打开文件</AgentButton>
        <AgentButton variant="outline" onClick={() => setStatus('查看变更')}>查看变更</AgentButton>
        <AgentButton variant="danger" icon="trash-2" onClick={() => setStatus('点击删除')}>删除</AgentButton>
        <AgentIconButton variant="ghost" icon="search" aria-label="搜索" onClick={() => setStatus('打开搜索')} />
        <AgentDropdown label="更多操作" value={view} onChange={value => {setView(value);setStatus(value);}}
          items={[{value:'chat',label:'聊天',icon:'message-circle'}, {value:'code',label:'代码',icon:'terminal'}, {value:'files',label:'文件',icon:'folder'}]} />
      </div>
      <div style={{marginTop: 18}}>
        <AgentSegmented label="模式切换" value={view} onChange={setView}
          options={[{value:'chat',label:'聊天'},{value:'code',label:'代码'},{value:'files',label:'文件'}]} />
      </div>
      <p style={{fontSize: 12, color: 'var(--scb-muted)'}}>当前：{status}</p>
      {approval && <div style={{margin: '18px 0'}}>
        <AgentApprovalActions description="npm run build · 工作区写入"
          onReject={() => {setStatus('已拒绝');setApproval(false);}}
          onAllowOnce={() => {setStatus('允许一次');setApproval(false);}}
          onAllowAll={() => {setStatus('允许全部');setApproval(false);}} />
      </div>}
      {!approval && <AgentButton variant="ghost" icon="refresh-cw" onClick={() => setApproval(true)}>恢复审批演示</AgentButton>}
      <div style={{marginTop: 22}}>
        <AgentComposer value={draft} onChange={setDraft}
          model={model} models={['GPT-6','Claude Sonnet','DeepSeek V4']}
          onModelChange={setModel} onSend={text => {setDraft('');setStatus('发送：' + text);}}
          onAttach={() => setStatus('打开系统文件选择器：请在业务项目中实现')} />
      </div>
    </AgentTheme>
  </div>;
}
