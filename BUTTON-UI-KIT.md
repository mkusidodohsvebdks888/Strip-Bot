# Strip Bot · Codex × Claude 按钮素材包集成

更新日期：2026-10-18。素材包已合并到 `G:\p\Page07`，作为可复用组件库保留；没有替换现有侧栏、审批、模型菜单或输入框控件。

## 已安装内容

- `codex-ui/src/components/AgentButtons.tsx`
- `codex-ui/src/components/AgentButtonShowcase.tsx`
- `codex-ui/src/styles/agent-buttons.css`
- `codex-ui/public/strip-buttons/icons/`：36 枚 SVG 图标
- `codex-ui/src/App.tsx`：已导入 `agent-buttons.css`

## 使用方式

```tsx
import {AgentTheme, AgentButton, AgentIconButton} from './components/AgentButtons';

<AgentTheme ui="fusion" mode="light">
  <AgentButton variant="primary" icon="plus">新建任务</AgentButton>
  <AgentIconButton variant="ghost" icon="search" aria-label="搜索" />
</AgentTheme>
```

可选风格：`ui="codex" | "claude" | "fusion"`；深色：`mode="dark"`。

## 静态资源

图标路径为 `/strip-buttons/icons/<name>.svg`。`backend/gateway.cjs` 已增加受限路由，只允许小写字母、数字和连字符组成的 SVG 文件名；`scripts/BuildUI.ps1` 会把图标复制到 `public/strip-buttons`，`desktop-app/build.cjs` 会把它们打进桌面 `app.asar`。

## 验证

- TypeScript 类型检查通过。
- `npm.cmd test`：104 项通过，0 失败；包含图标静态路由测试。
- Vite 正式构建通过。
- 桌面包：`desktop-app/releases/button-ui-kit-20261018/Strip Bot-win32-x64`。
- 运行中的新版已确认：
  - `http://127.0.0.1:3060/` 返回 200。
  - `/strip-buttons/icons/search.svg` 返回 200，`Content-Type: image/svg+xml`。

## 说明

- 素材包是独立编写的 Codex/Claude 风格参考，不是官方 UI 源码。
- 当前主界面仍使用 Strip Bot 原有控件；如需把 `fusion` 或 `claude` 风格应用到侧栏、审批按钮或输入框，需要逐处替换并重新做视觉验收。
- 离线预览仍可使用原始素材包中的 `index.html` 或 `OPEN-PREVIEW.bat`。