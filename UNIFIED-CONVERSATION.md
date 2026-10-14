# 统一聊天与编程

现在普通提问和编程任务共用一个输入框、会话历史、项目目录和 OpenCode 上下文。文件操作、终端、逐次审批、问题表单及文件变更直接展示在对话中；不再需要切换“编程 Agent”页面。运行期间可以停止任务。

新会话读取 CC Switch 当前模型；已有会话绑定创建时的模型，切换模型后需新建对话。旧普通聊天保留，继续发送时会将旧文本作为背景带入新的 OpenCode 会话。草稿按会话保存。文本和代码附件支持每个 150 KB、消息合计 60000 字符的限制。

## 修改位置

- `codex-ui/src/App.tsx`：统一入口、历史、消息流与输入框。
- `codex-ui/src/state/useUnifiedConversation.ts`：会话、迁移、草稿、发送、停止及审批。
- `codex-ui/src/components/unified-chat.css`：内嵌工具卡与布局。
- `codex-ui/src/components/AgentPanel.tsx`：复用问题表单及消息类型。
- `test/agent-native.e2e.cjs`：增加隔离的 UI 验收服务。

## 验证结果与限制

22 项现有自动测试通过，TypeScript 和生产构建通过。浏览器通过统一输入框驱动真实 OpenCode 2.0.28 引擎，在隔离目录完成读取、写入、修改、再次读取及终端命令，随后在同一会话普通追问；历史和草稿刷新恢复通过。

上述工具验收使用本机确定性 Responses 模拟模型，不代表真实 GPT 调用成功。证据位于 `.runtime/unified-ui-acceptance/verification.json`，截图为 `verified-unified-tools.png`。真实 CC Switch 上游此前返回 401，仍需修复提供商认证。

```powershell
npm.cmd test
powershell -ExecutionPolicy Bypass -File scripts/BuildUI.ps1
node test/agent-native.e2e.cjs --responses --ui
```

最后一个命令启动 3061 端口的隔离验收服务，使用模拟模型，按 Ctrl+C 结束。

## 桌面运行与回滚

新版程序：`desktop-app/releases/unified-chat-20261014/Strip Bot-win32-x64/Strip Bot.exe`。

旧程序：`desktop-app/releases/agent-model-fix-20261014/Strip Bot-win32-x64/Strip Bot.exe`。退出新版后运行旧程序即可回滚桌面 UI；旧存储键保留。修改前源文件备份在 `.runtime/before-unified-chat-20261014`。快捷方式备份在 `.runtime/Strip Bot-before-unified-chat.lnk`。
