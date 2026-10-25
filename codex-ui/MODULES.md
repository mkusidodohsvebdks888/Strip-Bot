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

## 独立主题设置模块

主题管理现集中于 `src/modules/theme/`，包含设置状态、控件、壁纸与 CSS 样式。旧 `state/useAppearance.ts`、`components/ThemePicker.tsx` 和 `styles/theme.css` 等保留兼容导出/样式导入，避免现有功能中断。详见 [主题模块说明](src/modules/theme/README.md)。
