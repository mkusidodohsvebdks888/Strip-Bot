# Strip Bot 任务流程图接入（2026-10-20）

## 已完成

任务流程组件已接入真实执行记录，而不是使用演示数据。

接入位置：

- 筛选栏右侧新增“任务流程”切换按钮。
- 开启后在筛选栏下方显示任务流程图。
- 原“全部 / 执行过程 / 文件修改 / 提醒与异常”和原始执行列表继续保留。
- 点击流程节点会展开对应执行记录，并滚动定位到该步骤。

## 真实事件映射

新增：

- `codex-ui/src/components/Activity/TaskFlow.tsx`
- `codex-ui/src/components/Activity/task-flow-plan.ts`
- `codex-ui/src/styles/task-flow.css`

状态映射：

| ActivityEvent.status | TaskStatus |
| --- | --- |
| success | completed |
| running | running |
| error | failed |
| pending | pending |
| idle / cancelled | cancelled |

流程按当前最后一个用户消息之后的真实执行事件顺序生成节点和连线。OpenCode 会把同一用户任务拆成多个 assistant 消息，因此会聚合该用户轮次中的全部工具事件，而不是只取最后一个 assistant 消息。

普通连接线始终保留；只有 completed ↔ completed、completed → running、running → completed 使用高亮连线。

## 交互

- 开关：`aria-pressed`、`aria-controls`
- 节点：按钮语义，支持键盘焦点
- 节点点击：打开对应执行详情并滚动定位
- 横向空间不足：流程图内部横向滚动
- 减少动态效果：保留静态状态环并关闭旋转动画

## 验证

- TypeScript：通过
- ESLint：通过
- 完整测试：221 / 221 通过
- Vite 正式构建：通过
- Electron 打包：通过
- OpenCode 打包版本：2.1.1

真实浏览器验收使用项目确定性 Agent 测试环境，完成 5 个真实工具步骤：

1. 读取文件
2. 写入文件
3. 编辑文件
4. 再次读取文件
5. 执行 shell 命令

验收结果：5 / 5 完成，节点状态、连线亮度和执行记录联动正常。

截图：

- `G:\p\Page07\exports\task-flow-live-two-nodes-20261020.png`
- `G:\p\Page07\exports\task-flow-live-completed-top-20261020.png`

## 最终发布

`G:\p\Page07\desktop-app\releases\task-flow-20261020\Strip Bot-win32-x64`

桌面快捷方式已指向该版本。

旧快捷方式备份：

`E:\Desktop\Desktop\Strip Bot.pre-task-flow-20261020.lnk.bak`

源码合并前备份：

`G:\p\Page07\exports\task-flow-premerge-20261020-215553`

当前正在运行的旧窗口不会自动切换；关闭后重新从桌面快捷方式打开即可使用新版。
