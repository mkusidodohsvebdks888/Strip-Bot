# DeepSeek Harness 桌宠：实现计划

## 范围

这是一台本机运行、只读 Harness 会话日志的桌宠，不是浏览器扩展，也不修改 `dsh`、项目文件或会话内容。

## 数据链路

```text
Harness 会话日志（%USERPROFILE%\\.dsh\\sessions）
  -> read_harness_status.js（仅筛选 cwd 位于 G:\\DeepSeek 的会话）
  -> pet.py（每 2 秒读取一次 JSON）
  -> 透明置顶 Tkinter 窗口（角色状态徽章）
  -> 单击角色打开不透明、大字号的任务面板
```

## 状态规则

| Harness 事件 / 待办快照 | 桌宠画面 | 百分比规则 |
| --- | --- | --- |
| 没有匹配会话 | 休息 | 显示“未连接”，不显示百分比 |
| 有会话但无 `todo/write` | 待机 / 休息 | 显示“处理中”或“等待任务”，不伪造百分比 |
| `in_progress` 或 `pending` 待办 | 工作 | `completed / total` 的四舍五入百分比 |
| 全部待办为 `completed` | 完成 | 100% |

`todo/write` 是 Harness 的整份待办快照；新的 `turn/start` 会清空旧清单。因此旧任务不会被当成当前进度。

## 程序文件

- `read_harness_status.js`：Node 内置 Zstandard 解码器读取追加式日志，输出一行 JSON。
- `pet.py`：Tkinter + Pillow。将绿色范围设为透明，桌宠置顶、可拖动、右键退出；只在内存中处理图片。
- `启动桌宠.cmd`：双击启动，不弹出 Python 控制台。
- `assets/selected/`：本轮通过验收的 5 张 FHL 状态图。

## 动效

- 待机图与眨眼图短暂切换；角色持续小幅上下浮动。
- 工作中显示抽象终端；完成时切换挥手图。
- 桌宠只保留一个清晰状态徽章；具体百分比与完整待办放在独立任务面板中。
- 所有数字和状态文字实时读取，永远以读取结果为准。

## 失败策略

日志不可读、Harness 升级改变格式或 Node 不可用时，桌宠只显示“未连接 / 读取失败”，绝不沿用旧百分比冒充实时数据。
