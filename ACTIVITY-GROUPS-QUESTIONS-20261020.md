# Strip Bot 执行记录折叠与问题卡接入（2026-10-20）

## 已完成

### 1. Codex 风格执行记录分组

新增并接入：

- `codex-ui/src/components/Activity/activity-types.ts`
- `codex-ui/src/components/Activity/ActivityStream.tsx`
- `codex-ui/src/components/Activity/useThrottledValue.ts`
- `codex-ui/src/components/Activity/activity-stream-adapter.ts`
- `codex-ui/src/styles/activity-stream.css`

行为：

- 当前用户轮次内的连续 read / shell / edit / search 事件合并为一个摘要组。
- 摘要示例：`已读取文件（2）、已编辑文件（2）、运行了命令`。
- 运行中的组默认展开，并在摘要行显示当前步骤。
- 完成后自动收起；用户仍可手动展开。
- 展开后只先显示最近 6 条，更早步骤可以点击显示。
- UI 更新节流为 150ms，尾部保证最终一致。
- 展开后的步骤仍使用原来的富 `Step` 组件，因此命令输出、diff、复制和异常详情没有降级。
- “展开全部 / 收起全部”同时控制分组和详情。

### 2. Claude Code / Codex 风格问题卡

新增：

- `codex-ui/src/components/Questions/QuestionCard.tsx`
- `codex-ui/src/styles/question-card.css`

`QuestionForm` 已适配为点选卡片，但保持原有 API 和动态 `when` 可见性：

- 不显示原生 `<select>`。
- 选项平铺为卡片，含序号、说明、推荐标记和选中对勾。
- 单题单选直接提交。
- 多题显示 `已答 / 总数`，全部答完后启用提交。
- 支持单选、多选、推荐、自定义文本。
- 支持数字键 1–9 选择。
- `AgentForm` 字段继续以原 `Record<string, unknown>` 格式回传，后端接口无需更改。

## 验证

- TypeScript：通过
- ESLint：通过
- 完整测试：225 / 225 通过
- Vite 正式构建：通过
- Electron 打包：通过
- OpenCode：2.1.1

真实浏览器验收：

- 5 个真实工具步骤折叠为 1 行摘要。
- 完成后自动收起。
- 展开后显示原来的 5 条富详情。
- 三题卡片预览显示推荐、选中、进度和禁用提交状态。

截图：

- `G:\p\Page07\exports\activity-group-collapsed-20261020.png`
- `G:\p\Page07\exports\activity-group-expanded-20261020.png`
- `G:\p\Page07\exports\question-card-preview-20261020.png`
- `G:\p\Page07\exports\verified-activity-groups-20261020.png`

## 最终发布

`G:\p\Page07\desktop-app\releases\activity-groups-20261020\Strip Bot-win32-x64`

桌面快捷方式已切换到该版本。

上一版快捷方式备份：

`E:\Desktop\Desktop\Strip Bot.pre-activity-groups-20261020.lnk.bak`

合并前源码备份：

`G:\p\Page07\exports\activity-questions-premerge-20261020-220759`

当前正在运行的旧窗口不会自动更新；关闭后从桌面快捷方式重新打开即可使用新版。
