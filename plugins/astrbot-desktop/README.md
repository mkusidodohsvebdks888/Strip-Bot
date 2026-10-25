# AstrBot QQ 工具栏插件

该插件在 Strip Bot 左侧工具栏增加 **AstrBot QQ** 入口。

## 功能

- 检查 AstrBot `127.0.0.1:6185` 状态
- 检查 NapCat `127.0.0.1:6099/webui/` 状态
- 显示 AstrBot 当前供应商、模型和 API Base
- 打开 AstrBot 管理后台
- 打开 NapCat 扫码页

## 数据边界

插件仅通过 Strip Bot 本机后端访问回环地址，并读取以下本地部署配置：

- `E:\AstrBot\qq-ai-bot-deploy\data\cmd_config.json`
- `E:\AstrBot\qq-ai-bot-deploy\napcat\config\webui.json`

不读取 QQ 聊天正文、AstrBot 登录密码或模型 API Key，不执行终端命令，不修改 QQ 账号。

部署根目录可通过环境变量 `ASTRBOT_DEPLOY_ROOT` 覆盖。

## 入口

- Strip Bot 工具栏 → **AstrBot QQ**
- 后端：`GET /api/plugins/astrbot/status`
- 前端：`codex-ui/src/components/Sidebar/AstrBotTool.tsx`