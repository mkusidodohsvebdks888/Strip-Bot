# Strip Bot 停止按钮与停止逻辑修复（2026-10-20）

## 合并范围

已把增量包适配到当前真实输入框，而不是仅替换示例组件：

- `codex-ui/src/components/StripCodexComposer.tsx`
- `codex-ui/src/components/ChatInput.tsx`
- `codex-ui/src/components/ChatInput.css`
- `codex-ui/src/styles/stop-button.css`（新增，最后加载）
- `codex-ui/src/styles/aborted-note.css`（新增）
- `codex-ui/src/state/useUnifiedConversation.ts`
- `codex-ui/src/App.tsx`

`PacedMessage.tsx` 已支持 `drain={false}`；本次在 `App.tsx` 中把用户主动停止的助手消息接到该开关，并增加回归测试。

## 实际行为

### 发送/停止按钮

- 发送与停止共用一个固定槽位，不再条件替换导致布局跳动。
- 发送 → 停止 → 停止中三态。
- 停止中按钮禁用；`useRef` 同步锁阻止同一事件循环内重复点击。
- 只有 `onStop()` 返回的 Promise 已经结束，并且父级 `busy` 变为 false 后，按钮才复位。
- 停止中不能再用 Enter 发送。
- 输入框内按 Esc 可停止。
- 触屏命中区 44px；`prefers-reduced-motion` 下关闭旋转、呼吸动画。
- `aria-label`、`aria-busy`、`title`、`aria-live` 随状态更新，完成后焦点回到输入框。

### 首个 token 前停止

`useUnifiedConversation.send()` 现在为一次发送创建 `AbortController`，并将 `signal` 传给：

- `POST /api/agent/sessions`
- `POST /api/agent/sessions/:id/prompt`

`stop()` 会先中止前端请求，再调用后端 `POST /interrupt`。因此不再依赖 `await ask(...)` 或 `/prompt` 返回后才取得停止函数。

用户主动停止会恢复草稿、保留待发送附件，不显示为发送失败。

### 停止后输出

- 用户主动停止的助手消息使用 `drain={false}`，立即显示已收到的全部文本并停止逐字追帧。
- 消息下显示“已停止生成”。
- 若快照尚未收到新用户消息，使用发送前助手消息 ID 集合和用户消息 ID 双重定位，避免误标上一轮回复。

## 验证

- `npm.cmd run typecheck`：通过
- `npm.cmd run lint`：通过
- `npm.cmd test`：216/216 通过
- Vite 正式构建：通过
- Electron 桌面打包：通过

最终资源：

- `public/assets/index-B33PbUM1.css`
- `public/assets/index-BgxYSP3L.js`

最终桌面发布目录：

`G:\p\Page07\desktop-app\releases\stop-button-20261020\Strip Bot-win32-x64`

桌面快捷方式已指向该目录，旧快捷方式备份：

`E:\Desktop\Desktop\Strip Bot.pre-stop-button-20261020.lnk.bak`

源码修改前备份：

`G:\p\Page07\exports\stop-button-premerge-20261020-213320`

应用启动验收截图（独立临时 Profile，仅验证最终包可正常加载）：

`G:\p\Page07\exports\verified-stop-button-final-20261020.png`

说明：独立 Profile 没有已保存的模型连接，因此截图停在连接页；停止按钮的真实请求中断仍以源码检查、类型检查和 216 项自动化测试为准。当前正在运行的旧版窗口不会被强制关闭，需关闭后从桌面快捷方式重新打开才能看到新版。
