# Strip Bot 输入页面功能 Bug 报告

日期：2026-10-20  
范围：首页输入框、模型/权限弹窗、斜杠命令、粘贴转附件、指令优化、流式 Markdown。

## P1：输入框聚焦位移会让 fixed 弹窗定位错乱

- 文件：`codex-ui/src/styles/home-motion.css:37-40`
- 相关：`codex-ui/src/components/useAnchoredPopup.ts`、`ModelSwitcher.tsx`、`SessionApproval.tsx`
- 现象：输入框获得焦点后，模型菜单或权限菜单可能偏离触发按钮，严重时贴边或跑到错误位置。
- 原因：`.strip-codex-composer__panel:focus-within { transform: translateY(-2px); }` 给面板创建了新的 containing block。面板内的 `.smp-popup` / `.strip-approval-menu` 使用 `position: fixed`，但 `useAnchoredPopup` 传入的是视口坐标，fixed 坐标会改为相对这个 transformed 面板计算。
- 补充：`.strip-composer-region` 的 `home-rise` 入场动画也使用了 transform，在动画期间会触发同类问题。
- 建议：不要对包含 fixed 弹窗的面板使用 transform；改用 `box-shadow`、边框或 `translate` 内部装饰层，或把弹窗 portal 到 `.strip-app` 外层。

## P1：输入框高度不会随侧栏宽度变化重新测量

- 文件：`codex-ui/src/components/StripCodexComposer.tsx:152-160`
- 现象：侧栏展开/收起后，textarea 宽度变化，但像素高度仍是旧宽度下的测量值；可能出现多行文字被裁切或底部留白。
- 原因：高度 effect 只依赖 `[text, expanded]`，没有 `ResizeObserver` 或窗口 resize 监听。
- 建议：监听 textarea/editor 的尺寸变化，或恢复基于 `ResizeObserver` 的 `fitEditorHeight()`。

## P2：斜杠命令提示在禁用/生成中仍可修改草稿

- 文件：`codex-ui/src/components/StripCodexComposer.tsx:237-238`
- 现象：输入框已禁用或正在生成时，斜杠提示按钮仍显示且可点击，能直接改写草稿。
- 原因：提示列表只判断 `slashMatches.length`，按钮没有 `disabled={disabled || streaming}`。
- 建议：提示列表和按钮绑定 `fileActionsDisabled`，并在禁用时隐藏或禁用。

## P2：斜杠命令提示按钮无法用键盘激活

- 文件：`codex-ui/src/components/StripCodexComposer.tsx:238`
- 现象：键盘用户 Tab 到命令提示后，按 Enter/Space 不会套用模板。
- 原因：按钮只有 `onMouseDown`，没有 `onClick` 或键盘处理。
- 建议：同时使用 `onClick` 和 `onMouseDown`（mousedown 仅用于阻止 textarea 失焦），或改用 `onMouseDown` + `onKeyDown`。

## P2：大段粘贴转附件失败时会丢内容

- 文件：`codex-ui/src/components/StripCodexComposer.tsx:180-189`
- 现象：已有 12 个附件或附件超限时，粘贴超过 4000 字符会先被 `preventDefault()` 阻止，再因 `addFiles()` 校验失败而不插入文本，用户粘贴内容丢失。
- 原因：`handlePaste` 在 `addFiles` 成功前就阻止了默认行为；`addFiles` 只设置错误，不返回成功状态。
- 建议：让 `addFiles` 返回 boolean；只有成功转成附件后才 `preventDefault()`，失败时保留普通粘贴。

## P2：展开模式在极短窗口下高度可能超过可用空间

- 文件：`codex-ui/src/components/StripCodexComposer.tsx:156-158`
- 现象：窗口高度很低时，`Math.min(window.innerHeight * 0.58, 650)` 可能小于 220，但展开分支强制 `Math.max(nextHeight, 220)`，导致 textarea 高度大于计算出的 max。
- 建议：展开分支的最小高度也不要超过 `max`，例如 `Math.min(max, Math.max(nextHeight, 220))`。

## P3：流式 Markdown 稳定化每帧扫描全文

- 文件：`codex-ui/src/components/PacedMessage.tsx:26`、`codex-ui/src/lib/markdown-stream.mjs:4`
- 现象：长回复流式输出时，每个显示帧都会对完整可见文本执行正则统计，可能带来不必要的 CPU 开销。
- 建议：在 pacer 中增量维护代码围栏状态，或按块缓存稳定化结果。

## P3：模型改写接口默认地址在当前后端不存在

- 文件：`codex-ui/src/lib/prompt-enhancer.mjs:52`
- 现象：`enhanceWithModel()` 默认请求 `/api/connection/complete`，但当前 gateway 没有该路由；一旦接入模型改写按钮会直接失败。
- 当前状态：UI 只使用本地 `buildInstruction()`，所以未触发。
- 建议：改为现有可用接口，或删除/明确标注该函数为未接入。

## P3：重复点击“优化指令”会嵌套模板

- 文件：`codex-ui/src/lib/prompt-enhancer.mjs:6-19`、`StripCodexComposer.tsx:258`
- 现象：已经结构化的文本再次点击优化，会再套一层“## 任务 / ## 要求”，形成重复结构。
- 建议：检测已有标题结构并跳过，或只在纯文本上启用按钮。

## 验证状态

- 当前 `typecheck`、`lint`、`build` 通过。
- 当前测试 181 项通过，0 失败；以上为代码审查发现的边界和交互问题，不属于已有自动化覆盖全部的场景。