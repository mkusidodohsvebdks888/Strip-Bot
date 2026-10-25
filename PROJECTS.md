# StripBot 项目与模块导航

采用单仓库、多项目、独立模块结构；每个项目按职责维护，主程序通过兼容入口组合。

## 应用与业务类别

| 类别 | 独立目录 | 说明 |
|---|---|---|
| 核心网关 | `backend/gateway.cjs` | HTTP、本地服务和生命周期（组合根） |
| 执行器 | `modules/agent/` | 会话、引擎、调度、桥接、工作区、指标 |
| 模型与账号 | `modules/connectors/` | API、CC Switch、Codex/OpenCode、隐式模型 |
| 外部集成 | `modules/integrations/` | MCP、GitHub、Skills、后端项目、插件管理 |
| 桌宠及机器人 | `modules/companions/` | 糯糯、AstrBot 后端 |
| 通用协议 | `modules/core/` | 模型协议、校验和共享依赖 |
| 网页界面 | `codex-ui/` | React/Vite、聊天框、主题及侧栏 |
| 主题设置模块 | `codex-ui/src/modules/theme/` | 主题配色、外观设置、背景图片及 CSS；原路径保持兼容 |
| OpenUI 生成式 UI | `external/OpenUI/`、`scripts/openui/` | 本地 AI 生成界面并安全导入配色，原主题设置保留 |
| 背景素材 | `背景素材/` | 独立保存的毛玻璃、液态玻璃、纹理与背景 CSS/SVG 素材，不自动覆盖 UI |
| 桌面程序 | `desktop-app/` | Electron、预加载及打包 |
| 独立插件 | `plugins/` | 糯糯桌宠、DeepSeek Q版桌宠、7-Zip、Office→PDF、AstrBot |
| 7-Zip 源码 | `解压缩/7-Zip/` | 独立源码备份，非已安装程序 |
| LibreOffice 源码 | `PDF转换/LibreOffice/` | Git 子模块，体积较大 |
| 桌宠源码 | `桌宠/DeepSeek-Q版-dsh-pet/` | Q版桌宠固定版本子模块；原 `DeepSeek-Harness-Pet/` 备份保留 |
| 回归测试 | `test/` | API、执行、UI、插件及模块兼容 |
| 构建脚本 | `scripts/` | UI 编译与发布工具 |

## 开发建议

1. 改任务、执行流程：`modules/agent/`。
2. 改 API/模型/登录：`modules/connectors/`。
3. 改 Skills/MCP/GitHub 接入：`modules/integrations/`。
4. 改桌宠、QQ：`modules/companions/`、`plugins/`。
5. 改 UI：`codex-ui/`；改桌面打包：`desktop-app/`。

精确模块入口、依赖和旧路径映射见 [`modules/catalog.json`](modules/catalog.json)。这是**单仓库中的代码分离**，没有创建多个新 GitHub 仓库。原接口和导入入口保留兼容。
