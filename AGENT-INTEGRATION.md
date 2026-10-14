# Strip Bot 独立 Agent 接入

CC Switch 更新：启用侧边栏中的连接开关后，Agent 使用 CC Switch 的原生 Responses 路由，关闭后沿用本地 API 设置。20 项自动化测试通过；真实供应商曾完成 read → write → read，但末尾换行不一致，完整验收未通过。后续官方路由返回 401。使用、证据与回滚见 [CCSWITCH-INTEGRATION.md](CCSWITCH-INTEGRATION.md)。下文 18 项测试与 Page02 结果为接入 CC Switch 之前的记录。

桌面程序的“编程 Agent”入口使用官方 npm 包 `@opencode/cli@2.0.28`，不是模拟的执行动画。普通聊天继续使用原来的接口。

## 使用

1. 打开桌面 Strip Bot，点击“编程 Agent”。
2. 选择 `G:\p` 内的项目目录和模型，输入任务并发送。
3. 检查工具名称、文件路径或命令，在审批面板选择“允许本次”或“拒绝”。
4. 查看实际工具输出、文件差异和回复；运行过程中可停止任务。

Agent 沿用“本地 API 设置”的地址、模型和协议。Page02 的配置通常是 `http://127.0.0.1:3010/v1/chat/completions`、`chatgpt`、OpenAI 兼容接口。Responses 使用 `/v1/responses` 与 Responses 类型；本次真实引擎工具验收测试使用 Chat Completions，尚未验证 Responses 的真实上游工具链路。模型必须能够返回合法工具调用，只有普通文本回复的网页桥接服务无法自动完成编程任务。

## 模块与边界

- `codex-ui/src/components/AgentPanel.tsx`：任务、消息、工具输出、问题表单、审批和文件差异。
- `backend/agent/service.cjs`：仅开放任务相关路由，验证项目目录、会话归属和待审批请求。
- `backend/agent/engine.cjs`：按需启动独立回环端口，随机 Basic 凭证保存在内存，父进程退出时通过 stdio 关闭引擎。
- `agent-runtime`：锁定版本的官方运行时；桌面包自带 `resources/opencode.exe`。
- `.runtime/opencode`：独立配置、数据和缓存，不改写用户其他 OpenCode 配置。
- `.runtime/agent-sessions.json`：本产品拥有的任务索引；原生历史在引擎数据中。

所有工具权限默认为 ask，产品只提供本次批准或拒绝，不提供永久批准。选择项目范围和权限审批不是操作系统沙箱：批准的终端命令仍具有运行用户的文件和网络权限。界面不会直接执行终端命令，网关不开放任意 shell 接口。配置文件只写密钥环境变量占位符，打包不包含密钥、浏览器会话或任务数据。

## 验证结果

`npm.cmd test`：18 项网关、协议、会话与安全测试通过。前端 TypeScript 检查和生产构建通过。

`npm.cmd run test:agent`：确定性本机模拟模型，驱动真实 OpenCode 执行 read → write → edit → read → shell，五次逐次审批与真实文件/终端输出通过。验收文件为 `.runtime/agent-native-acceptance/result.txt`，内容为 `Strip Bot native agent updated this file.`。详细证据在同目录 `verification.json`。

真实 Page02 模型测试：45 秒内没有收到工具调用或文本回复，随后中断。结果在 `.runtime/agent-real-acceptance/verification.json`，`passed` 为 false。该结果不证明模型永远不支持工具，但当前仍未通过真实模型闭环验收。

## 启动、构建和回滚

双击桌面 Strip Bot 即可打开程序并复用或启动本机网关。源码启动：在 `G:\p\Page07` 执行 `npm.cmd start`。网关为 3060，引擎使用动态回环端口。

前端构建使用 `scripts/BuildUI.ps1`；桌面构建使用 `node desktop-app/build.cjs releases/<新目录>`，避免覆盖正在使用的程序。先安装 `agent-runtime` 和 `desktop-app` 的锁定依赖。

Agent 接入前的运行源文件备份在 `.runtime/before-agent-20261014`，旧桌面程序保留在 `desktop-app/releases/architecture-20261014`。关闭 Strip Bot，使用 `launch.ps1 -Mode stop` 停止其管理的网关；恢复备份中的 backend、public 与桌面 main/runtime，再启动网关。桌面快捷方式的备份为 `.runtime/Strip Bot-before-agent.lnk`。恢复旧版本不会删除任务数据或 Page02 登录会话。

OpenCode 的 MIT 许可保存在 `licenses/opencode-MIT.txt`，桌面发布目录也保留该许可。
