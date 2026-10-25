# AstrBot QQ 工具栏插件

## 完成内容

- Strip Bot 左侧工具栏新增 **AstrBot QQ** 入口
- 工具栏面板显示 AstrBot 与 NapCat 在线状态
- 显示 AstrBot 当前供应商、模型和 API Base
- 提供“打开 AstrBot 管理后台”和“打开 NapCat 扫码页”
- 后端新增受本机来源保护的 `GET /api/plugins/astrbot/status`
- 桌面主进程仅允许打开本机 6185/6099 管理页面
- 插件元数据随桌面包发布

## 当前状态

- Strip Bot：1.5.2
- AstrBot：在线
- NapCat：在线
- 模型：qwen3:4b-instruct
- 供应商：Function Local (Ollama)
- 供应商 ID：function-local

## 安装位置

- 源码插件：`G:\p\Page07\plugins\astrbot-desktop`
- 前端：`G:\p\Page07\codex-ui\src\components\Sidebar\AstrBotTool.tsx`
- 后端：`G:\p\Page07\backend\astrbot-plugin.cjs`
- 新桌面包：`G:\p\Page07\desktop-app\releases\astrbot-plugin-20261023\Strip Bot-win32-x64\Strip Bot.exe`
- 桌面快捷方式：`E:\Desktop\Desktop\应用快捷方式\Strip Bot.lnk`

## 验证

- 插件后端与工具栏测试：10 项通过
- TypeScript 类型检查：通过
- Vite 生产构建：通过
- 运行中 `/api/health`：版本 1.5.2
- 运行中 `/api/plugins/astrbot/status`：AstrBot/NapCat 均在线
- 前端静态资源确认包含 AstrBot QQ 与 NapCat 扫码按钮

## 数据边界

插件只读取本机服务状态和部署配置，不读取 QQ 聊天正文、AstrBot 密码或模型密钥，不执行终端命令，不修改 QQ 账号。

## 回滚

源码备份：`G:\p\Page07\.runtime\before-astrbot-plugin-20261023_235319`

恢复旧快捷方式后即可回到原桌面版本，原桌面包仍保留。