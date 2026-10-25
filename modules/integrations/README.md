# 外部集成

每个子目录独立维护职责和模块入口；旧 backend 导入位置为兼容转发文件。

- **mcp**：MCP 服务端点的配置、启用和持久化（`modules/integrations/mcp/index.cjs`）。
- **backends**：本地后端项目登记和授权（`modules/integrations/backends/index.cjs`）。
- **github**：GitHub 工具仓库导入与审查（`modules/integrations/github/index.cjs`）。
- **skills**：Skills 导入、存储和授权（`modules/integrations/skills/index.cjs`）。
- **bundled-plugins**：内置插件列表、开关和受控调用（`modules/integrations/bundled-plugins/index.cjs`）。

依赖与入口详见各模块 module.json 和 ../catalog.json。
