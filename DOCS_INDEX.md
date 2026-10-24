# Strip-Bot 项目导航

> 本文件用于导航，不修改软件行为。**运行方式优先查看 [README.md](README.md)**；其余技术文档包含不同时间的实现记录，可能描述已经停用的路由或功能。

## 源码入口

| 目录 | 用途 |
| --- | --- |
| [codex-ui/](codex-ui/) | React / TypeScript 前端与交互界面 |
| [backend/](backend/) | 本地网关、API 与 Agent 接口 |
| [agent-runtime/](agent-runtime/) | Agent 执行运行时与依赖 |
| [desktop-app/](desktop-app/) | Electron 桌面端与打包脚本 |
| [scripts/](scripts/) | 构建、启动辅助脚本 |
| [test/](test/) | 自动化测试 |
| [licenses/](licenses/) | 第三方许可和署名 |

## 建议阅读顺序

1. [README.md](README.md)：以当前仓库说明为准，了解所需依赖、启动、构建与测试。
2. [CCSWITCH-INTEGRATION.md](CCSWITCH-INTEGRATION.md)：CC Switch 接入背景与测试记录；以 README 中实际支持的入口为准。
3. [AGENT-INTEGRATION.md](AGENT-INTEGRATION.md)：Agent 工作流程、权限边界与早期测试记录。
4. [AGENT-MODEL-FIX.md](AGENT-MODEL-FIX.md)：模型调用问题的修复记录。
5. [CODEX-UI-MIGRATION.md](CODEX-UI-MIGRATION.md)：界面迁移说明。

## 历史与演进文档

- [ARCHITECTURE.md](ARCHITECTURE.md)：多个架构阶段的累计记录，文中可能同时出现 OAuth 与 CC Switch 的历史入口。
- [UNIFIED-CONVERSATION.md](UNIFIED-CONVERSATION.md)：统一会话的设计及早期实现。
- [OPENCODE-OAUTH.md](OPENCODE-OAUTH.md)：OpenCode OAuth 阶段的历史方案；当前能否使用应以实际代码与 README 为准。

## 维护约定

- 新功能的启动方法优先更新根目录 README，避免出现多个相互矛盾的“当前方案”。
- 历史设计文档不直接删除；需要过时标记时优先增加日期、版本或迁移说明。
- 不提交 API Key、账号凭据、聊天记录、构建产物和依赖目录。
- 测试通过不等于实际供应商连接成功；发布前分别检查本地测试和真实 API 链路。
