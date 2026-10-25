# 输入框与运行项目命令框 Bug 代码摘录

日期：2026-10-20  
说明：以下“输入框”代码来自修复前备份；当前工作区已经是修复版。

## 一、输入框修复前 Bug 代码

### 1. 聚焦 transform 导致 fixed 弹窗定位错乱

文件：`exports/before-input-ui-fixes-20261020-190200/codex-ui/src/styles/home-motion.css:23-40`

```css
.strip-app[data-appearance] .strip-composer-region {
  animation: home-rise var(--home-ease) 340ms backwards;
}

.strip-app[data-appearance] .strip-codex-composer__panel {
  transition: border-color 180ms ease, box-shadow 220ms ease, transform 220ms cubic-bezier(.22,1,.36,1);
}
.strip-app[data-appearance] .strip-codex-composer__panel:focus-within { transform: translateY(-2px); }
```

问题：transform 让面板成为 `position: fixed` 子元素的 containing block，模型/权限弹窗的视口坐标被按面板坐标解释。

### 2. 侧栏切换后高度不再测量

文件：`exports/before-input-ui-fixes-20261020-190200/codex-ui/src/components/StripCodexComposer.tsx:152-160`

```tsx
useEffect(() => {
  const area = areaRef.current;
  if (!area) return;
  area.style.height = 'auto';
  const max=expanded ? Math.min(window.innerHeight*0.58,650) : 220;
  const nextHeight = Math.min(area.scrollHeight, max);
  area.style.height = expanded ? `${Math.max(nextHeight,220)}px` : `${Math.max(nextHeight,28)}px`;
  area.style.overflowY = area.scrollHeight > max ? 'auto' : 'hidden';
}, [text,expanded]);
```

问题：只依赖文本和展开状态，侧栏宽度变化不会重新测量；展开模式下 min=220 也可能大于 max。

### 3. 大段粘贴先 preventDefault 再校验附件

文件：`exports/before-input-ui-fixes-20261020-190200/codex-ui/src/components/StripCodexComposer.tsx:166-189`

```tsx
function addFiles(incoming: FileList | File[] | null) {
  if (!incoming?.length) return;
  const unique = new Map(files.map(file => [`${file.name}:${file.size}:${file.lastModified}`,file]));
  Array.from(incoming).forEach(file=>unique.set(`${file.name}:${file.size}:${file.lastModified}`,file));
  try {validateFiles(Array.from(unique.values()));setFiles(Array.from(unique.values()));setError('');}
  catch(error){setError(error instanceof Error ? error.message:'附件超出限制');}
}

function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
  const pasted=event.clipboardData.getData('text');
  if (!fileActionsDisabled && !event.clipboardData.files.length && pasted.length > 4000 && new Blob([pasted]).size <= MAX_FILE_BYTES) {
    event.preventDefault();
    addFiles([new File([pasted], 'pasted-' + Date.now() + '.txt', {type:'text/plain'})]);
    return;
  }

  if (!fileActionsDisabled && event.clipboardData.files.length) addFiles(event.clipboardData.files);
}
```

问题：`addFiles` 失败时只设置错误，不返回结果；`preventDefault` 已经阻断普通粘贴，文本会丢失。

### 4. 斜杠提示未处理禁用态和键盘

文件：`exports/before-input-ui-fixes-20261020-190200/codex-ui/src/components/StripCodexComposer.tsx:237-239`

```tsx
{slashMatches.length > 0 && <div className="strip-codex-composer__slash-hints" aria-label="斜杠命令">
  {slashMatches.map(command=><button type="button" key={command.cmd} title={command.label} onMouseDown={event=>{event.preventDefault();updateText(command.template);areaRef.current?.focus();}}><strong>{command.cmd}</strong><span>{command.label}</span></button>)}
</div>}
```

问题：没有 `disabled={fileActionsDisabled}`；只有 `onMouseDown`，键盘 Enter/Space 不会套用模板。

### 5. 流式 Markdown 每帧全文扫描

文件：`exports/before-input-ui-fixes-20261020-190200/codex-ui/src/components/PacedMessage.tsx:26`

```tsx
return <>{children(stabilizeMarkdown(visible))}</>;
```

配合旧 `markdown-stream.mjs`：

```js
export function stabilizeMarkdown(text) {
  const value = String(text ?? '');
  const fences = (value.match(/```/g) || []).length;
  return fences % 2 ? `${value}\n\`\`\`` : value;
}
```

问题：长回复流式输出时每帧扫描完整可见文本。

## 二、被删除的旧“运行项目命令框”代码

文件：`exports/before-inline-20261020/codex-ui/src/components/Workspace/WorkspaceActions.tsx:68-80`

```tsx
{(terminalOpen||items.length>0) && <section className="strip-workflow-command-panel" aria-label="项目终端">
  <header className="strip-workflow-heading"><span>▣</span><strong>项目终端</strong><span className="strip-workflow-muted" title={snapshot?.workspace || ''}>{snapshot?.workspace || '工作区尚未确认'}</span></header>
  {terminalOpen && <form className="strip-workflow-command-form" onSubmit={event=>void run(event)}>
    <label htmlFor="strip-command-input">手动执行 · 每条命令都需要单独确认</label>
    <div className="strip-workflow-command-row"><span>$</span><input id="strip-command-input" spellCheck={false} autoComplete="off" placeholder="例如 npm test、git status、python --version" value={command} maxLength={4096} onChange={event=>setCommand(event.target.value)} disabled={executing}/><button type="submit" disabled={!validSession||!command.trim()||executing||snapshot?.running}>{executing?'执行中…':'运行'}</button></div>
    {!validSession?<p>请先发送一条消息建立 Agent 会话，然后可在该会话的项目目录运行命令。</p>:<p>当前命令在本机直接运行，非沙箱隔离；最长 30 秒，最多展示 128 KB 输出。与 AI 工具审批相互独立。</p>}
  </form>}
  {items.map((item,index)=><article className="strip-workflow-command-result" key={session+index}>
    <div className="strip-workflow-command-meta"><code>$ {item.command}</code><span data-success={item.exitCode===0&&!item.timedOut}>{item.timedOut?'超时':item.exitCode===0?'完成':item.error?'启动失败':`退出码 ${item.exitCode ?? '?'}`} · {(item.durationMs/1000).toFixed(1)}s</span><button type="button" title="复制输出" onClick={()=>void copy([item.stdout,item.stderr].filter(Boolean).join('\n')).catch(()=>onError('复制失败'))}>复制</button><button type="button" onClick={()=>saveText(`terminal-${index+1}.txt`,`$ ${item.command}\n${item.stdout}\n${item.stderr}`)}>导出 .txt</button></div>
    {(item.stdout||item.stderr||item.error)&&<pre><code>{[item.stdout,item.stderr,item.error].filter(Boolean).join('\n')}</code></pre>}
    {item.truncated && <p className="strip-workflow-warning">输出达到 128 KB 上限，命令已停止以保护应用。</p>}
  </article>)}
</section>}
```

### 旧命令框的 Bug

1. `executing` 是组件级单一状态，不区分会话。一个会话执行命令时，切换会话后新会话的输入也会被禁用。
2. 执行中的命令没有 pending 记录，只有请求完成后才 `setResults` 追加；运行期间看不到“运行中”条目。
3. 旧面板常驻在聊天输出区（`terminalOpen||items.length>0`），会占用聊天空间，后来被替换为浮动命令框。
4. 结果列表用 `session+index` 作为 key，没有稳定命令 id；结果追加后可能出现不必要的节点复用。
5. 旧代码只检查 `snapshot?.running`，没有检查 `manualRunning` 或集中式 in-flight 锁，跨会话并发边界较弱。

## 当前状态

- 输入框 8 项问题已修复；`npm test` 当前 189 项通过。
- 旧命令框已替换为 `CommandPalette` + `useManualCommands`，命令结果按会话隔离，并有 pending / running 记录。
- 当前新命令框仍建议做一次短窗口视觉检查，确认浮层不会被主区域裁切。