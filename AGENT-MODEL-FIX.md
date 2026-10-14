# Agent 模型接入修复（2026-10-14）

已保留 React / Electron / OpenCode / CC Switch 架构，未接入 Claude Code。

- engine.cjs：使用官方 V2 包路径 `@opencode/ai/providers/openai-compatible/responses` 和 `@opencode/ai/providers/openai-compatible`。参考 https://opencode.ai/v2/docs/providers 。已用本机锁定的 2.0.28 运行时验证两种协议。
- App.tsx / AgentPanel.tsx：显示当前 CC Switch 模型；新任务在后端重新解析当前模型。查看已有任务时不自动改引擎配置，展示该任务保存的模型。
- gateway.cjs / service.cjs：配置和创建任务串行执行；任务保存模型、协议、地址及连接类型，运行时拒绝改配置和重复提交，旧任务不得静默换模型。模型改变后须新建任务；没有绑定元数据的历史任务在 CC Switch 模式下只供查看。
- ccswitch.cjs / CCSwitch.tsx：健康检测明确标记模型未经验证。手动测试返回文本才显示最近一次真实调用成功，错误保留原始认证信息。该显示不证明连续工具调用成功，也不保证后续请求成功。

## 验证

22 项自动化测试通过；TypeScript 及 UI 构建通过。

`npm.cmd run test:agent` 和 `npm.cmd run test:agent:responses`：确定性本机模拟模型驱动真实 OpenCode 2.0.28 完成 read → write → edit → read → shell，逐次批准限定的验收工具，文件内容包括末尾 LF 均匹配。Responses 证据在 `.runtime/agent-responses-acceptance/verification.json`。模拟上游不等于真实 GPT。

`npm.cmd run test:ccswitch:real`：最新真实文本请求仍为 HTTP 401，供应商 OpenAI Official，模型 gpt-6.1-sol。尚未通过真实 GPT 端到端验收，需要在 CC Switch 的 Codex 页配置有效供应商认证。本次没有读取、改写密钥或 Codex 认证配置。

## 使用与回滚

最终桌面包位于 `desktop-app/releases/agent-model-fix-20261014/Strip Bot-win32-x64/Strip Bot.exe`，更新后桌面快捷方式指向该版本。源码启动仍为 `launch.ps1 start -NoBrowser`。

改动前源文件备份在 `.runtime/before-agent-model-fix-20261014`。要回滚，关闭当前桌面程序、使用 `launch.ps1 stop` 停止脚本拥有的网关，然后打开保留的 `desktop-app/releases/send-fix-20261014` 程序。恢复源码备份后需要重新构建。不要删除 `.runtime` 的任务数据。
