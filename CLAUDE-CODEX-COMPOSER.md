# Strip Bot · Claude × Codex 输入框

更新日期：2026-10-18。此版在 `G:\p\Page07` 当前源码上合并输入框视觉，不覆盖旧版整包。

## 视觉调整

- 输入框改为单一圆角卡片，编辑区与底部工具栏不再用横向分割线。
- 编辑区增加内边距，默认可容纳数行文字；文本增加时自动扩展，上限 240px（窄屏 220px）。
- 左侧附件按钮为轻描边方形按钮，权限保留为状态胶囊。
- 当前模型与推理档位合并为一个低调胶囊，点击仍打开原有模型/推理弹窗。
- 发送按钮改为 38px 圆形按钮；停止生成状态保留。
- 底部重复的常驻权限提示已移除；阻止发送的原因仍由输入框内部提示显示。
- 暖米白、纯净白、雾蓝灰、经典深色、石墨灰五套主题分别配置输入框配色。

## 文件

- `codex-ui/src/styles/claude-codex-composer.css`（新增）
- `codex-ui/src/App.tsx`
  - 最后导入新样式。
  - 移除输入框下方重复的权限提醒。
- `codex-ui/src/components/StripCodexComposer.tsx`：保留当前版本的高度测量、中文输入法、附件、拖放、停止和发送逻辑，未用旧包降级覆盖。

当前 App 使用输入框内的 `ModelSwitcher`，没有恢复已删除的左侧独立“模型与速度”页面；新 CSS 对模型与推理两个触发按钮做了统一的胶囊外观适配。

## 验证

- `npm.cmd run typecheck`：通过。
- `npm.cmd test`：104 项通过，0 失败。
- Vite 正式构建通过。
- 当前构建资源：`index-CFotNP3S.js`、`index-DqU2dEiV.css`。
- 桌面包：`desktop-app/releases/claude-codex-composer-20261018/Strip Bot-win32-x64`。
- 运行中的新版已确认 `http://127.0.0.1:3060/` 返回 200 并加载本次资源。
- 源码备份：`exports/before-claude-codex-composer-20261018-215540`。

## 未完成

- 未用真实桌面截图做最终视觉验收；宽度与按钮边界依据 CSS 规则和构建结果检查。
- 未使用用户真实 API 密钥发起模型请求。