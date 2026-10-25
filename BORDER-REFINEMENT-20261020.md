# Strip Bot 边框细化与诊断

日期：2026-10-20

## 实际页面诊断

实际应用入口为：

`http://127.0.0.1:3060/`

登录页 DOM 计数：

- `.strip-api-entry[data-appearance]`：1
- `.strip-app[data-appearance]`：0（尚未进入工作区）
- `.strip-codex-composer__panel`：0
- 独立预览页 `.shell .composer`：0

因此当前可见页面是实际应用登录页，不是 `preview/index.html`。`border-refinement.css` 已加载并命中 `.strip-api-entry`：

- `--strip-line`：`color-mix(in srgb, #292722 17%, transparent)`
- API 输入框计算边框：`color(srgb 0.160784 0.152941 0.133333 / 0.17)`
- API 输入框计算圆角：`9px`
- 最终样式表：`assets/index-DUnwRr3t.css`

## 打包顺序

在最终 CSS 中：

- `.strip-ext-banner`：约索引 7938
- `.strip-codex-composer__panel`：约索引 37488
- `border-refinement` 的 `--strip-line-soft`：约索引 354502

说明覆盖层确实位于现有组件样式之后。

## 修改内容

- 新增最后加载的 `border-refinement.css` 覆盖层。
- 直接修改 `extension-workspace.css`，使其横幅、卡片、路径框、按钮和表单使用 `--strip-line`、`--strip-line-soft`、`--strip-radius-*`。
- 直接修改 `skills-dnd.css`，使技能栏框、卡片、按钮和移出区使用同一套边框变量。
- 保留审批、错误、无效输入和选中状态的语义颜色。
- 移动端输入框圆角为 17px，并支持 `prefers-reduced-motion`。

## 文件

- `codex-ui/src/styles/border-refinement.css`
- `codex-ui/src/components/Sidebar/extension-workspace.css`
- `codex-ui/src/components/Sidebar/skills-dnd.css`
- `codex-ui/src/App.tsx`
- `test/border-refinement.test.js`

## 验证

- 边框接入测试：3/3 通过
- 全量测试：207/207 通过
- TypeScript：通过
- ESLint：通过
- CSS 解析：通过
- Vite 生产构建：通过
- 登录页实机截图检查：卡片、输入框、按钮边框正常
- 最终资源：`index-BEwkvzAv.js`、`index-DUnwRr3t.css`
- 本地服务：HTTP 200

## 最终应用

`G:\p\Page07\desktop-app\releases\border-refinement-20261020-r2\Strip Bot-win32-x64\Strip Bot.exe`

桌面快捷方式已更新。

## 回滚

- `G:\p\Page07\desktop-app\releases\border-refinement-20261020\Strip Bot-win32-x64`
- `G:\p\Page07\desktop-app\releases\skills-drag-drop-20261020\Strip Bot-win32-x64`