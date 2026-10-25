# Strip Bot 手动命令状态机修复

日期：2026-10-20

## 结论

旧“运行项目命令框”的 5 个缺陷已合并到当前项目：

1. `executing` 不再全局共享，in-flight 锁按会话保存。
2. `run()` 会立即插入 `status: 'running'` 记录，完成后原地更新。
3. 命令 ID 使用每会话单调递增序号 `${session}:${seq}`，裁剪历史后也不会复用。
4. 命令记录只显示在浮动 `CommandPalette` 内，聊天主区域不再渲染命令历史。
5. `canRun()` 集中检查会话内锁、`manualRunning`、`agentRunning` 和全局并发上限；执行异常也会释放锁。

输入框、模型/速率弹窗等既有修复保持不变，未重新设计界面。

## 主要文件

- `codex-ui/src/lib/manual-commands-store.mjs`
- `codex-ui/src/lib/manual-commands-store.d.mts`
- `codex-ui/src/state/useManualCommands.ts`
- `codex-ui/src/components/Workspace/WorkspaceActions.tsx`
- `codex-ui/src/components/Workspace/inline-command.css`
- `codex-ui/src/App.tsx`
- `test/manual-commands-store.test.mjs`
- `test/manual-command-state.test.js`
- `test/inline-command-ui.test.js`

## 验证结果

- 定向测试：12/12 通过。
- 全量测试：196/196 通过。
- `codex-ui` TypeScript 类型检查：通过。
- `codex-ui` ESLint：通过。
- Vite 生产构建：通过。
- 最终资源：
  - `index-BtL-1Ute.js`
  - `index-BWhEO-Ci.css`
- 本地服务 `http://127.0.0.1:3060/`：HTTP 200。
- 桌面快捷方式已指向最终构建。

## 最终 Windows 包

`G:\p\Page07\desktop-app\releases\manual-commands-store-20261020-r2\Strip Bot-win32-x64\Strip Bot.exe`

最终快捷方式：

`E:\Desktop\Desktop\Strip Bot.lnk`

## 回滚

上一版仍保留：

- `G:\p\Page07\desktop-app\releases\manual-commands-store-20261020\Strip Bot-win32-x64`
- `G:\p\Page07\desktop-app\releases\popup-sizing-20261020\Strip Bot-win32-x64`

## 说明

命令执行接口使用项目现有路由：

`POST /api/agent/sessions/:session/command`

实际手动命令仍需逐次确认，并且仍会在本机项目目录中运行，不是沙箱。
## 增量修复包

`G:\p\Page07\exports\Strip-Bot-Manual-Command-Fix-20261020.zip`