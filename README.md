# Strip Bot

Windows 本地 AI 聊天与编程桌面程序。React + TypeScript + Node.js + Electron，OpenCode 2.0.28 负责 Agent 执行，通过 CC Switch 的 Codex Responses 路由连接模型。

## 当前版本

- 普通聊天与编程使用统一对话。
- 当前发布入口仅支持 CC Switch；历史 OAuth 代码保留用于兼容和测试。
- CC Switch 默认路由：`http://127.0.0.1:15721/v1/responses`。需要自行配置有效供应商。代理在线并不代表模型认证成功。
- 文件与命令操作需要审批；工作目录范围由后端限制。当前不包含桌面整理能力。
- 本包不包含账号登录、密钥、聊天记录、依赖和已打包的 Electron 程序。

## 开发运行（PowerShell）

安装 Node.js 22 或更新的兼容版本，并准备 CC Switch。

```powershell
npm.cmd ci --prefix .\agent-runtime
npm.cmd ci --prefix .\codex-ui
npm.cmd ci --prefix .\desktop-app
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\BuildUI.ps1
npm.cmd start
```

浏览器入口：`http://127.0.0.1:3060`。已有桌面程序占用端口时先关闭。

## 桌面运行与打包

```powershell
npm.cmd start --prefix .\desktop-app
node .\desktop-app\build.cjs
```

打包输出位于 `desktop-app/dist`。首次构建需要联网下载依赖与 Electron。

## 测试

```powershell
npm.cmd test
```

真实上游验收需要有效模型供应商；自动化测试通过不代表真实调用成功。历史架构说明位于 ARCHITECTURE.md、UNIFIED-CONVERSATION.md 和 CCSWITCH-INTEGRATION.md，部分文档记录已停用的旧入口。第三方许可和署名见 licenses/。
