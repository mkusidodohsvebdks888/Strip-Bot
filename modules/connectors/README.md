# AI 模型及账号

每个子目录独立维护职责和模块入口；旧 backend 导入位置为兼容转发文件。

- **api**：直连 AI 模型 API 与账号连接（`modules/connectors/api/index.cjs`）。
- **cc-switch**：CC Switch 端点与模型选择（`modules/connectors/cc-switch/index.cjs`）。
- **codex-account**：Codex 账号管理（`modules/connectors/codex-account/index.cjs`）。
- **opencode-account**：OpenCode 账号管理（`modules/connectors/opencode-account/index.cjs`）。
- **local-model**：隐式本地模型设置与探测（`modules/connectors/local-model/index.cjs`）。

依赖与入口详见各模块 module.json 和 ../catalog.json。
