# Strip Bot

Windows 本地 AI 聊天与编程桌面程序。React + TypeScript + Node.js + Electron，OpenCode 2.0.28 负责 Agent 执行，通过 CC Switch 的 Codex Responses 路由连接模型。

## 当前版本

- 普通聊天与编程使用统一对话。
- 当前发布入口仅支持 CC Switch；历史 OAuth 代码保留用于兼容和测试。
- CC Switch 默认路由：`http://127.0.0.1:15721/v1/responses`。需要自行配置有效供应商。代理在线并不代表模型认证成功。
- 文件与命令操作需要审批；工作目录范围由后端限制。当前不包含桌面整理能力。
- 本包不包含账号登录、密钥、聊天记录、依赖和已打包的 Electron 程序。

## 隐式本地模型 API（无需云端密钥）

Strip-Bot 内置了一个**默认不可见的本地模型适配层**，自动发现本机已运行的 Ollama 服务：

- 模型发现：`GET /api/local-model/status`
- 本地对话：`POST /api/local-model/chat`，请求格式 `{"messages":[{"role":"user","content":"你好"}]}`
- Ollama 默认连接：`http://127.0.0.1:11434`；不会将聊天转发至云端模型 API。
- 如果 CC Switch 不可用且发现本地模型，**新对话**自动使用本地模型；已建立的 CC Switch 任务不受影响。
- 即使 CC Switch 正常，也可在**新对话输入** `/本地 你好` 显式使用本地模型。
- 本地聊天支持多轮上下文、简单文本附件、会话记录和停止请求。它**不能通过模型自动执行命令或操作文件**，工具执行仍需要受控的 Agent/指令执行器。
- 当前适配层**不附带模型权重，也不自动安装 Ollama**。必须在用户 Windows 电脑中安装并运行 Ollama，下载一个可用模型。例如：`ollama pull qwen3:0.6b`。
- 为避免暴露本地接口，所有新路由继续使用本机地址与同源验证；不要通过公网代理转发此服务。
- 若想优先使用某个已下载模型，可设置环境变量 `STRIPBOT_LOCAL_MODEL` 为模型完整名称（找不到该模型时自动使用本机第一个可用模型）。
- 修改源码后请**重新启动 Strip-Bot**。这部分是源码集成，不代表已在用户电脑上安装和验证 Ollama。

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
