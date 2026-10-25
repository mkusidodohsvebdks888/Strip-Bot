# Strip Bot Codex 边框语言

日期：2026-10-20

## 目标

把 `codex-controls.css` 中原本只用于暗色主题的 Codex 边框 token 提升为全主题通用，并覆盖后面的 Claude 暖色边框、较大圆角和卡片阴影。

## 实现

- 新增最后加载的 `codex-borders.css`。
- 中性主题使用 `rgba(0,0,0,.09)` 边框、`rgba(0,0,0,.06)` 分割线。
- 深色主题使用 `rgba(255,255,255,.11)` 边框、`rgba(255,255,255,.055)` 分割线。
- 控件圆角 8px，小按钮 7px，卡片和弹层 12px，Composer 16px。
- 卡片与环境面板取消常驻阴影。
- 弹层保留单一柔和阴影。
- 聚焦改为 `outline: 2px solid var(--cx-focus)`，输入控件取消额外阴影。
- `border-refinement` 使用的 `--strip-line*`、`--strip-radius-*` 同步映射到 Codex token，确保 extension workspace 和 Skills 拖放区也不再保留暖色边框。

## 文件

- `codex-ui/src/styles/codex-borders.css`
- `codex-ui/src/styles/border-refinement.css`
- `codex-ui/src/components/Sidebar/extension-workspace.css`
- `codex-ui/src/components/Sidebar/skills-dnd.css`
- `codex-ui/src/App.tsx`
- `test/border-refinement.test.js`

## 实际页面计算结果

在实际应用登录页验证：

- `--cx-border`：`rgba(0, 0, 0, .09)`
- `--cx-r`：`8px`
- API 输入框边框：`1px solid rgba(0, 0, 0, 0.09)`
- API 输入框圆角：`8px`
- API 输入框阴影：`none`
- 最终样式表：`assets/index-CEPXKmJ3.css`

## 验证

- Codex 边框接入测试：4/4 通过
- 全量测试：208/208 通过
- TypeScript：通过
- ESLint：通过
- CSS 解析：通过
- Vite 生产构建：通过
- 登录页实机截图检查：除主体仍保留主题强调色外，边框和圆角已切换为 Codex 的紧凑中性风格
- 本地服务：HTTP 200

## 最终应用

`G:\p\Page07\desktop-app\releases\codex-borders-20261020-r3\Strip Bot-win32-x64\Strip Bot.exe`

桌面快捷方式已更新。

## 回滚

上一版仍保留：

`G:\p\Page07\desktop-app\releases\border-refinement-20261020-r2\Strip Bot-win32-x64`