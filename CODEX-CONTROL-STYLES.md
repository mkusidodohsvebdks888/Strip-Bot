# Strip Bot · Codex 风格按钮与图标优化

日期：2026-10-17

本地合并说明（2026-10-18）：仅合并源码中的按钮和图标修改，未覆盖包内旧版 App、主题、Markdown 或 public 资源。暗色配色限制在暗色主题内，共用控件尺寸适用于深浅两种主题。public 资源从当前源码重新构建；下文关于压缩包手工修改运行版的说明属于原包历史记录。

本轮仅优化**交互控件的视觉样式与局部图标**，不替换 Strip Bot 的品牌标志，不修改 API、模型切换、工具审批、聊天数据或后端逻辑。这里的“Codex 风格”指借鉴其克制的暗色界面、细线图标、轻量按钮及清晰的交互状态，并非宣称采用 Codex 官方原版设计资源。

## 一、已经修改的模块

| 模块 | 文件 | 修改内容 |
| --- | --- | --- |
| 全局交互控件 | `codex-ui/src/styles/codex-controls.css` | 新增独立样式层；统一按钮大小/圆角、悬停、按下、禁用、焦点、颜色、阴影；适配窄屏与减少动画设置 |
| 页面入口与侧栏 | `codex-ui/src/App.tsx` | 引入新样式；新建对话改为扁平按钮和方框铅笔图标；为侧栏、搜索框、设置入口增加专用样式类 |
| 图标系统 | `codex-ui/src/components/ControlIcon.tsx` | 统一 SVG viewBox、描边宽度和端点，增加 plus、eye、eye-off、stop、shield 等基础线性图标 |
| 消息输入框 | `codex-ui/src/components/StripCodexComposer.tsx` | 将输入框内部部分图标切换到统一 `ControlIcon`，保留附件、发送、停止与模型控件功能 |
| 会话列表 | `codex-ui/src/components/Sidebar/ChatHistory.tsx` | 为活动会话增加状态类；统一侧栏记录行及删除按钮的视觉反馈 |
| API Key 输入 | `codex-ui/src/components/ApiEntry.tsx` | “显示/隐藏”文字改为眼睛/划线眼睛图标，保留无障碍标签和原有显隐逻辑 |
| 连接提示 | `codex-ui/src/components/ConnectionSettings.tsx` | 提示关闭按钮使用统一 X 图标 |

## 二、如何继续修改

1. **改按钮颜色和交互**：打开 `codex-ui/src/styles/codex-controls.css`，修改顶部的 `--cx-hover`、`--cx-pressed`、`--cx-selected`、`--cx-border`、`--cx-focus`。全局尺寸位于 `.strip-btn`、`.strip-btn--icon` 等规则。
2. **改侧栏按钮**：在同一 CSS 中搜索 `.strip-new-chat`、`.strip-sidebar-settings`、`.strip-history-heading`、`.strip-task`。如需变更按钮结构/点击动作，打开 `codex-ui/src/App.tsx`。
3. **改发送按钮/模型菜单**：搜索 `.strip-codex-composer__send`、`.strip-codex-composer__tool`、`.smp-popup`、`.smp-speed-slider`。图标轮廓统一修改 `ControlIcon.tsx`，请保留 `aria-label`、按钮禁用状态和事件回调。
4. **新增基础图标**：在 `ControlIcon.tsx` 的 `ControlIconName` 添加名字，并在 `shapes` 注册 SVG `path`/`rect`/`circle`。SVG 使用 24×24 viewBox 与 `currentColor`，避免引入多余图片资源。

## 三、运行方法

压缩包中的 `public/` 已包含与本轮调整同步的**预编译运行时页面**。已安装好依赖的本地项目可在根目录执行 `npm start`，按原本方式打开 `http://127.0.0.1:3060/` 查看界面。无需为查看这一份运行版单独执行前端构建。

在 Windows 上从 React 源码重新构建，可按 `START-HERE.md` 安装依赖，然后运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\BuildUI.ps1
npm.cmd start
```

`BuildUI.ps1` 会用源码重新生成并覆盖 `public/index.html` / `public/assets`。由于 `App.tsx` 已导入 `codex-controls.css`，样式调整会继续随构建产物发布。**不要只修改 `public/assets/*.css` 后执行构建**，否则运行版的手工样式调整可能被新构建覆盖。

## 四、运行版文件（已同步）

- `public/assets/codex-controls-20261017.css`：编译版追加样式层，与源码 CSS 保持同步。
- `public/assets/index-codex-controls-20261017.js`：由原发布 JS 保守替换少量展示组件/图标得到的运行版本；原始构建 JS 也保留以便回退。
- `public/index.html` 与 `public/build-manifest.json`：已更新资源链接。

如果需要回退，本轮新增的 CSS 和 JS 可移除，然后在 `public/index.html` 中把脚本地址恢复为 `/assets/index-CbnsQnN4.js`，并删除新的 `codex-controls-20261017.css` 引用。重新执行原项目的前端构建同样可以恢复自选版本。

## 五、检查情况与边界

- TypeScript/TSX 文件做过语法解析检查，运行版 JS 通过 Node `--check`，新增 CSS 完成语法解析。
- 使用浏览器加载运行版做了**模拟连接数据**的界面点击检查：API Key 显隐、进入主界面、新建对话、设置与返回、模型弹层和窄屏侧栏展开/关闭均通过，未发现浏览器运行时 JS 报错。
- 当前执行环境无法联网下载安装 Vite/TypeScript 项目依赖，因此**本轮没有重新执行完整的 `npm run build`**。为保证安装后即能看到调整，已直接更新 `public/` 中的原有构建资源。
- 未进行真实模型 API、工具执行、审批行为的端到端验收；视觉检查也不等于每项后台功能回归通过。
