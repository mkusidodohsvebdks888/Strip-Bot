# Strip Bot · 首页 / 动效 / 输入 / 指令优化

更新日期：2026-10-20。基于当前 G:\p\Page07 源码合并，未整包覆盖。

## 首页
- 移除三个快捷指令框，改用 HomeWelcome 组件。
- 标题中的“什么”使用品牌三色渐变；首页元素依次进场。

## 动效
- 新增 codex-ui/src/styles/home-motion.css。
- 输入框聚焦抬起、发送按钮弹性反馈、停止按钮脉冲环。
- 消息、执行步骤、通知、弹出菜单进入动效。
- 流式光标使用品牌色；首 token 显示骨架；复制成功有反馈。
- prefers-reduced-motion 下关闭动画。

## 输入
- /fix /ui /test 等斜杠命令按 Tab 展开模板。
- 输入 / 显示匹配命令列表，可点击套用。
- 工具栏新增“优化指令”，用本地模板整理为“任务/工作区/相关文件/要求”，不发起网络请求。
- 超过 4000 字符的纯文本粘贴自动转为 pasted-*.txt 附件。
- 现有按会话草稿持久化保留，未重复引入第二套 localStorage 逻辑。
- IME、Enter/Ctrl+Enter、附件、停止生成和权限逻辑不变。

## 内容生成
- prompt-enhancer.mjs 提供本地结构化指令、7 个斜杠模板和可选模型改写接口；当前只接入本地模板。
- markdown-stream.mjs 在流式输出时临时补齐未闭合代码围栏，降低高亮闪烁。
- PacedMessage 保持 30fps 刷新上限；等待首事件时显示骨架。

## UI 参考
参考 Motion、Magic UI、AI Elements/ChatCN、Lobe Editor、Lucide 的方向，但没有引入 Tailwind、Motion 或 shadcn 依赖。

## 验证
- typecheck、lint、build 均通过。
- npm test：181 项通过，0 失败。
- 新资源：index-BQe95P1x.js、index-77LOF5Xl.css。
- 桌面版：desktop-app/releases/home-motion-20261020/Strip Bot-win32-x64。
- 运行中的新版 127.0.0.1:3060 返回 200。

## 未完成
- 未做真实桌面截图视觉验收。
- 未使用真实 API 密钥验证模型改写。
- 源码备份：exports/before-home-motion-20261020-184305。