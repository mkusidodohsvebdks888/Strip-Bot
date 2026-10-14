# Strip Bot Codex UI

当前 3060 页面使用 Jouryjc/codex-ui 的 React 18 + TypeScript + Vite 框架和 CSS Modules 布局。
来源：https://github.com/Jouryjc/codex-ui（main 源码，2026-10-13 下载）。

保留 Strip Bot 品牌 Logo、Solar 操作图标、Lobe 模型图标和 Page07 的本机 API 网关。
前端继续读取 lucent_settings_v1、lucent_conversations_v1、lucent_active_chat_v1，原有浏览器配置和记录会沿用。
实现真实聊天流式回复、停止生成、复制、搜索/删除会话、模型配置和连接检测。
移除默认模拟任务、文件变更、终端执行及 PR 操作；当前网页是聊天前端，尚未接入 Codex CLI 执行服务。

## 启动与构建

- 双击 start-windows.bat，地址仍为 http://127.0.0.1:3060/ 。
- 修改 codex-ui/src 后，运行 powershell -File scripts/BuildUI.ps1。
- npm test 验证本地接口与生产资源；codex-ui 中 npm run build 同时执行 TypeScript 检查。

## 回滚

替换前完整备份在 .runtime/before-codex-ui，包括 public、server.js、package.json 和 README.md。
先执行 stop-windows.bat，再将备份 public 的文件复制回 public，并恢复 server.js，最后执行 start-windows.bat。
浏览器存储键未改变。备份不包含 API 密钥或浏览器登录 Cookie。
