# OpenUI 生成式 UI 集成

已将 W&B 的 OpenUI 作为独立本地服务接入 StripBot 设置界面；生成器源代码通过固定提交的 Git 子模块保存，原主题设置保留。

## 目录及功能

- `external/OpenUI/`：W&B OpenUI 上游 Git 子模块，固定提交 `42d7ab4ab6650433486dfb12eb3783c393a3e475`。
- `codex-ui/src/modules/theme/components/OpenUIStudio.tsx`：设置中嵌入的生成式 UI 工作区（独立同源本地服务，不与现有聊天混用）。
- `codex-ui/src/modules/theme/state/generated-theme.ts`：安全导入生成的 CSS 颜色变量，并保存、恢复主题。
- `modules/integrations/openui/index.cjs`：固定地址 127.0.0.1:7878 的服务状态探测。
- `scripts/openui/Start-OpenUI.ps1` 与 `Stop-OpenUI.ps1`：Windows Docker 构建、启动、关闭脚本。

## Windows 启动

需要 Docker Desktop、PowerShell、网络（首次拉取 Docker 基础镜像和构建依赖）。在 StripBot 项目根目录执行：

~~~powershell
powershell -ExecutionPolicy Bypass -File scripts/openui/Start-OpenUI.ps1
~~~

默认首次初始化 pinned OpenUI Git 子模块，编译本地 Docker 镜像，仅监听 `127.0.0.1:7878`。执行完成后打开 StripBot 的 **设置 → AI 生成式 UI**，点击「打开 OpenUI 生成器」。也可以用浏览器访问 `http://127.0.0.1:7878/ai`。

仅构建镜像、不启动：`Start-OpenUI.ps1 -BuildOnly`。结束：`powershell -ExecutionPolicy Bypass -File scripts/openui/Stop-OpenUI.ps1`。

OpenUI 需要独立配置 AI 模型。可以在运行脚本的 PowerShell 环境中手动设置 `OPENAI_API_KEY`、`OPENAI_COMPATIBLE_ENDPOINT` 等变量；容器不会自动读取 StripBot 已保存的密钥。使用 Ollama 时，容器默认访问 `http://host.docker.internal:11434`，需确保模型服务正在运行。

## 从 OpenUI 生成主题并导入 StripBot

1. 在 OpenUI 中描述新界面，例如「极简毛玻璃主题，浅灰蓝、圆角、柔和阴影」。
2. 对生成结果追加要求：输出 `:root` 内的 `--bg`、`--fg`、`--accent`、`--card-bg` 等十六进制颜色变量。
3. 将这些 CSS 颜色变量粘贴到 StripBot 的「主题颜色变量」输入框，点击「确认并应用」。
4. 需要恢复时，点击「恢复原主题」或在折叠的旧主题面板中选择原主题。

**范围限制**：目前 OpenUI 本身负责 HTML/React 等 UI 生成、预览；StripBot 只接收白名单内的主题颜色变量。不会自动把任意生成的 HTML、JS 或完整 CSS 注入到 StripBot。复杂布局仍需人工审查后修改 React 组件并重新构建。

## 安全与版权

本地生成器只从固定端口检查服务状态，不代理 API 密钥。嵌入使用隔离 iframe；外部生成内容不会被执行到 StripBot 本身。
OpenUI 使用 Apache-2.0 许可证，已保留许可证副本，其他许可证遵循上游源代码。Git 子模块**固定版本**，原作者提交新更改不会自动更新；但它不是完整独立备份。如果上游删除仓库，未缓存源码的设备可能无法重新初始化。

## 回归验证

~~~bash
node --test test/openui-integration.test.js
cd codex-ui
npm run build
~~~

已更新 GitHub 源码与静态检查，但还没有在用户 Windows 电脑上实际执行 Docker 构建、连接模型或重新打包 Electron 程序。
