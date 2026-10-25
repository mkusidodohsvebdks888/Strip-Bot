# Strip Bot UI 优化包兼容合并

日期：2026-10-20

## 合并结果

### 已加入

- `codex-ui/src/components/ChatInput.tsx`
- `codex-ui/src/components/ChatInput.css`
- `test/chat-input.test.js`

`ChatInput` 已适配当前 Codex 边框：

- 16px Composer 圆角
- `--cx-border` 中性边框
- 2px 低光晕聚焦
- Enter 发送、Shift+Enter 换行
- 中文输入法组合阶段不发送
- 生成中显示停止按钮

### 已合并到现有登录页

- 增加提交/连接出错时的卡片抖动动画。
- 保留当前已有的 3D 倾斜、光斑跟随、打字机、步骤进场、按钮箭头、连接流光和旋转图标。
- `prefers-reduced-motion` 下关闭动画。

## 未直接覆盖的模块

以下模块没有用附件中的简化版覆盖，因为当前项目版本更完整：

- `display-pacer.mjs`：当前版有 4x 追赶上限，避免后台标签恢复时一次吐出大量文字。
- `PacedMessage.tsx`：当前版接入 Markdown 围栏稳定器并限制约 30fps 的渲染频率。
- `MarkdownReply.tsx`：当前版保持完整文档 Markdown 解析，跨段引用链接和 loose list 测试通过；附件按块拆分会改变这些语义。
- `ApiEntry.tsx`：当前版包含真实 Key 校验、服务商选择、模型发现、CC Switch 和 ChatGPT 授权轮询，附件简化版会破坏现有连接流程。

## 兼容验证

- 登录、Key、CC Switch、ChatGPT 授权定向测试：通过
- ChatInput 测试：2/2 通过
- 输出节奏、复制回退、动画调度、Markdown 安全测试：通过
- 定向测试合计：22/22 通过
- 全量测试：210/210 通过
- TypeScript、ESLint、Vite 构建：通过
- 最终资源：`index-Cfj6r8_N.js`、`index-BA12RL4H.css`
- 本地服务：HTTP 200

## 最终应用

`G:\p\Page07\desktop-app\releases\ui-optimized-merge-20261020\Strip Bot-win32-x64\Strip Bot.exe`

桌面快捷方式已更新。

## 回滚

上一版仍保留：

`G:\p\Page07\desktop-app\releases\composer-tools-removed-20261020\Strip Bot-win32-x64`