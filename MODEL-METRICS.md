# 模型性能面板

任务活动顶部使用 `Strip Activity Metrics v2` 展示最近一次模型请求的数据。
原有工具记录、终端输出、文件差异和逐次审批保留。

## 数据链路

`OpenCode /api/event` → 私有后端订阅 → 按已拥有的会话和模型步骤统计 →
`GET /api/agent/sessions/:id` 的 `metrics` → Activity Feed v2。
前端沿用会话快照刷新，约每 800ms 显示一次最新统计；计时在后端收到事件时进行，
不把前端轮询间隔当作真实输出间隔。CC Switch、API、账号连接均经同一 OpenCode 引擎路径。

## 指标口径

- 每个 `session.step.started` 是一次模型请求，连续工具调用会开始下一次请求并重置面板。
- 首输出延迟：模型分派到首次非空 text、tool input 或 reasoning delta 被本机后端收到的时差。
  私有 reasoning 的文本不会保存在统计器中或显示；仅观测事件是否非空。
- 速率：可见文字、工具参数的估算 Token 数除以首次至末次可见 delta 的到达时长。
  至少观测 350ms 才显示。它是本机观测速率估算，不是服务端纯解码性能。
- 没有 Token 增量接口时，汉字按约 1 Token、其他字符按约 1/4 Token 估算。
  实时输出数量有 `≈` 标识。最终由 OpenCode `tokens.output` 替换；不会用最终用量反推速率。
- 输入数量采用 OpenCode 的 input + cache.read + cache.write；输出不额外相加独立 reasoning 字段。
- 请求耗时在 `session.step.streamed` 冻结，排除工具执行及审批等待。
- 趋势按实际 delta 到达时间分成 24 个桶，展示最近 6 秒的可见输出估算变化。
- 只有历史消息时显示引擎用量与已有起止时间；没有真实事件记录的 TTFT、速度、趋势为空。
- 事件订阅丢失时停止提供速度和 TTFT，明确显示事件流中断；后续新步骤重新计时。
- 错误和用户停止均保留异常状态，不伪造成功。

无演示数据进入生产链路。仅引入用户提供包中的组件 JS/CSS，未引入 demo.js。
原组件在这里保留了轮询更新时的展开状态、`允许本次`标签，并支持不重建事件列表的指标更新。

## 验证

`npm.cmd test` 包括事件帧切分、UTF-8、跨会话隔离、步骤重置、最终用量、推理内容不泄漏、
断连与历史无计时数据等回归测试。真实账号验收结果另存于 `.runtime`；不将模拟测试当作真实模型测量。

回滚备份：`.runtime/before-activity-metrics-20261015`。还原文件后重新运行
`scripts/BuildUI.ps1` 和桌面打包脚本；先前桌面构建仍保留在 releases/vendor-model-20261015-final。
