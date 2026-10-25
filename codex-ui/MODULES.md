# StripBot 前端项目模块导航

前端是单独的 React/Vite 工程；已有文件不再复制，以免破坏导入和 UI 样式。

| 功能 | 目录或入口 |
|---|---|
| 应用组合 | `src/App.tsx`、`src/main.tsx` |
| 聊天输入框 | `src/components/Composer/`、`src/components/StripCodexComposer.tsx` |
| 执行和消息展示 | `src/components/Activity/`、`src/components/MessageThread/` |
| 侧边栏/插件面板 | `src/components/Sidebar/` |
| 会话与模型状态 | `src/state/`、`src/store/` |
| 路由页面 | `src/routes/` |
| 模型切换 | `src/components/ModelSwitcher/` |
| 主题样式 | `src/styles/`、`src/components/ThemePicker.tsx` |
| API 请求 | `src/api/` |

修改后运行 `npm run build`，并用根目录 `scripts/BuildUI.ps1` 发布构建资源。
