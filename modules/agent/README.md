# 任务与执行系统

每个子目录独立维护职责和模块入口；旧 backend 导入位置为兼容转发文件。

- **engine**：Codex/OpenCode 引擎、进程与事件流管理（`modules/agent/engine/codex-engine.cjs`, `modules/agent/engine/legacy-engine.cjs`, `modules/agent/engine/event-stream.cjs`, `modules/agent/engine/proxy.cjs`）。
- **bridge**：DeepSeek 等 Chat Completions 到 Responses API 的转换桥（`modules/agent/bridge/index.cjs`）。
- **scheduler**：任务队列、并发与持久化调度（`modules/agent/scheduler/index.cjs`）。
- **session**：Agent 会话生命周期、权限审批与业务服务（`modules/agent/session/index.cjs`）。
- **workspace**：工作区文件和命令执行边界（`modules/agent/workspace/index.cjs`）。
- **metrics**：模型使用与运行指标（`modules/agent/metrics/index.cjs`）。

依赖与入口详见各模块 module.json 和 ../catalog.json。
