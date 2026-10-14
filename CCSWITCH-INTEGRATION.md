# Strip Bot：CC Switch 连接

最终桌面包：`desktop-app/releases/cc-only-20261014-final/Strip Bot-win32-x64/Strip Bot.exe`。

更新：本地 API 产品模块已整体移除。当前版本仅使用 CC Switch；关闭连接将暂停模型请求。旧配置保留用于回滚，不再读取。`/api/config`、`/api/models`、`/api/check` 已返回 410，旧供应商聊天及 Agent 配置被拒绝。桌面当前版本为 `desktop-app/releases/cc-only-20261014`。源文件备份在 `.runtime/before-local-api-removal-20261014`，快捷方式备份为 `.runtime/Strip Bot-before-local-api-removal.lnk`。以下关于关闭开关恢复本地 API 的说明仅适用于旧版本。

在侧边栏打开“CC Switch 连接”，启用后，普通聊天和编程 Agent 都通过 CC Switch 的 Codex Responses 路由请求模型。关闭开关可回到原来的本地 API 配置。模型覆盖留空时，每次请求读取 Codex 公开配置中的当前模型；填写后使用指定模型。

链路：Strip Bot（3060）→ `http://127.0.0.1:15721/v1/responses` → CC Switch 当前供应商。无需额外的 18721 服务。端口可通过网关启动环境变量 `CC_SWITCH_PROXY_PORT` 配置。

## 接口与边界

- `GET /api/cc-switch/status`：代理健康与公开模型配置。代理在线不代表供应商认证或工具调用成功。
- `POST /api/cc-switch/responses`：转发 Responses JSON 或原始 SSE，保留工具事件与上游错误状态。
- `/api/chat` 使用既有聊天流适配；`/api/agent/*` 使用独立 OpenCode 引擎及原生 Responses provider。

仅从 Codex config.toml 提取 model、model_provider 和当前供应商 base_url，不读取 auth.json 或 CC Switch 数据库，不修改它们。供应商密钥由 CC Switch 管理。原本的本地 API 配置保留，CC Switch 和本地 API 的 Agent 会话分别记录。运行任务期间禁用连接配置修改。

工具由 OpenCode 执行，并由 Strip Bot 展示逐次审批；网关不提供任意 shell 执行接口。项目选择和审批不是操作系统沙箱。

## 验收记录（2026-10-14）

20 项自动化测试通过，包含 Responses/SSE、模型变更跟随、认证隔离、上游 401 保留、Agent 配置以及来源验证。TypeScript 和生产构建已通过。

真实 API 供应商 deepseek-v4-flash 曾返回 HTTP 200，并驱动真实引擎完成 read → write → read，最终回复 STRIP_CC_AGENT_OK。验收文件输入 29 字节，输出 28 字节，缺少结尾 LF；因此完整内容验收没有通过。精简证据在 `.runtime/ccswitch-real-acceptance/tool-evidence.json`，不包含模型推理内容。

之后一次请求返回 OpenAI Official 的 401（模型 gpt-6.1-sol），提示官方登录配置不可用。应在 CC Switch 中检查当前 Codex 供应商及其认证，然后重新执行真实验收。不要把代理健康检查当作上游成功。最新运行结果在同目录 `verification.json`，可能还包含服务不可达等后续失败。

```powershell
cd G:\p\Page07
npm.cmd test
node test/ccswitch-real.e2e.cjs
```

真实验收会请求当前供应商，并仅在 `.runtime/ccswitch-real-acceptance` 内读写测试文件、逐次批准限定文件工具；不会自动切换供应商。

## 启动与回滚

桌面快捷方式指向 `desktop-app/releases/ccswitch-20261014/Strip Bot-win32-x64/Strip Bot.exe`。源码服务可以使用 `powershell -NoProfile -ExecutionPolicy Bypass -File .\launch.ps1 start -NoBrowser` 启动。

仅需恢复原来的 API 时，关闭“CC Switch 连接”开关。回滚程序时先关闭 Strip Bot，再执行 `launch.ps1 -Mode stop` 停止脚本拥有的网关，打开保留的 `desktop-app/releases/agent-20261014/Strip Bot-win32-x64/Strip Bot.exe`。快捷方式备份为 `.runtime/Strip Bot-before-ccswitch.lnk`。源码备份在 `.runtime/before-ccswitch-20261014`；恢复源码后须重新构建 UI 和桌面包。回滚不需要删除会话或登录数据。
