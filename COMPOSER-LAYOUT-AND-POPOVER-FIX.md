# Strip Bot · 输入框居中与模型/权限弹窗修复

更新日期：2026-10-18（Asia/Shanghai）。本记录描述 `G:\p\Page07` 当前源码上的实际改动与验证结果。

## 修复内容

- 聊天主区域采用可收缩的 flex 宽度，侧栏展开/收起后输入框都在剩余主区域内重新居中。
- 输入框宽度上限调整为 760px；消息滚动区和输入区都限制在主区域内。
- 模型/推理弹窗与权限弹窗改为基于触发按钮的 fixed 定位，并在侧栏宽度、窗口尺寸、滚动和弹窗内容变化时重新计算。
- 弹窗自动避开窗口边缘，空间不足时向上/向下切换，并限制最大高度。
- 浅色主题下统一模型菜单、推理档位菜单的背景、边框、文字、滑块和滚动条颜色。
- 左侧工具面板里的 docked 模式仍保持原位展开，不改为浮层。

## 涉及文件

- `codex-ui/src/App.tsx`
- `codex-ui/src/styles/composer-layout-fix.css`（新增）
- `codex-ui/src/components/useAnchoredPopup.ts`（新增）
- `codex-ui/src/components/ModelSwitcher/ModelSwitcher.tsx`
- `codex-ui/src/components/Activity/SessionApproval.tsx`
- `test/popup-placement.test.js`（新增）

未修改模型请求、API Key、Agent 后端、权限持久化或聊天历史存储。

## 验证结果

- `npm.cmd run typecheck`：通过。
- `npm.cmd test`：104 项通过，0 失败。
- `scripts/BuildUI.ps1`：Vite 正式构建通过，已发布到 `public`。
- 新构建资源：`index-Byv1IT2W.js`、`index-BQE78BBK.css`（后续构建哈希会变化）。
- 桌面打包：`desktop-app/releases/composer-layout-20261018/Strip Bot-win32-x64`。
- 已核对 asar 内包含本次构建的 JS/CSS。

## 未完成

- 未使用真实桌面窗口做视觉验收，未使用用户真实 API 密钥测试模型。
- 本次修复之前仍有一个 `search-popup-20261018` 桌面实例在运行并占用 3060；需要关闭旧实例后再启动新版本，否则看到的是旧包内嵌的前端。
- 源码备份：`exports/before-composer-layout-20261018-212025`。