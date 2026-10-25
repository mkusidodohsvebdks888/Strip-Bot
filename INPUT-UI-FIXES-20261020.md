# 输入页面 8 项 Bug 修复记录

日期：2026-10-20  
修复版：`desktop-app/releases/input-ui-fixes-20261020/Strip Bot-win32-x64`

## 已修复

1. **弹窗定位错乱**
   - `home-motion.css` 的输入区入场改为纯 opacity。
   - 输入框面板强制 `transform: none !important`。
   - 聚焦效果改用三层 box-shadow，不再创建 fixed 子元素的 containing block。

2. **侧栏切换后高度不重测**
   - `StripCodexComposer` 抽出 `measure()`。
   - `useLayoutEffect` 响应文本/展开状态。
   - `ResizeObserver` 监听宽度，`window.resize` 兜底；只在宽度变化时重测，避免循环。

3. **大段粘贴失败丢内容**
   - `addFiles()` 返回 boolean。
   - 仅在附件成功加入后才 `preventDefault()`。
   - 附件数量已满时保留普通文本粘贴并提示。

4. **斜杠提示禁用态**
   - 提示按钮绑定 `disabled={fileActionsDisabled}`，生成中/禁用时不可改写草稿。

5. **斜杠提示键盘激活**
   - `onMouseDown` 只负责防止 textarea 失焦。
   - 实际套用模板移到 `onClick`，Enter/Space 与鼠标同一路径。
   - Tab 展开增加 `!fileActionsDisabled` 守卫。

6. **展开模式高度超过 max**
   - `min = expanded ? Math.min(220, max) : 28`。
   - 最终高度为 `Math.min(Math.max(scrollHeight, min), max)`。

7. **流式 Markdown 每帧全文扫描**
   - `markdown-stream.mjs` 新增 `createFenceTracker()`，只扫描新增区间。
   - `PacedMessage` 使用 tracker，旧 `stabilizeMarkdown()` API 保留。
   - 新增逐字符、步长 7、文本重置等增量一致性测试。

8. **指令模板重复嵌套 / 模型改写端点**
   - `buildInstruction()` 识别已有结构并还原任务正文，重复点击保持幂等。
   - `enhanceWithModel()` 默认 endpoint 改为 `/api/chat`，支持 `mapRequest` / `mapResponse`，空结果会抛错以便降级。

## 验证

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `npm test`：**189 项通过，0 失败**，其中新增 8 项输入修复测试。
- 新构建资源：`index-CSiq_CI9.js`、`index-C7psBO03.css`。
- 桌面版已启动，`http://127.0.0.1:3060/` 返回 200。

## 仍需确认

- `enhanceWithModel()` 目前没有接到 UI；当前“优化指令”只使用本地模板。`/api/chat` 是流式接口，真正接入模型改写前仍需按 gateway 的 SSE 字段做适配。
- 未做真实桌面截图视觉验收。
- 备份：`exports/before-input-ui-fixes-20261020-190200`。
## 补充：速率弹窗稳定与模型弹窗尺寸

- `useAnchoredPopup` 改用 `offsetWidth` 计算弹窗宽度，避免入场缩放动画期间 `getBoundingClientRect()` 变小导致定位偏移。
- `home-motion.css` 中模型/速率弹窗从缩放动画改为纯 opacity 淡入，点击后不再出现缩放位移。
- 模型弹窗新增 `smp-model-menu`，宽度适配到 `min(380px, 100vw - 24px)`。
- 模型列表最大高度改为 `min(48vh, 360px)`，长模型名和更多模型有更合适的空间。
- 窄屏 420px 以下模型弹窗宽度改为 `calc(100vw - 20px)`。

验证：`typecheck`、`lint`、`build` 通过；189 项测试通过；新版桌面目录 `desktop-app/releases/popup-sizing-20261020`。
