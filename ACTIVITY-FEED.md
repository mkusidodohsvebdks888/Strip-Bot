# 任务活动面板

用户提供的 Strip Activity Feed 已接入统一聊天与编程页面。来源组件保存在 `codex-ui/src/components/Activity/vendor`，MIT 许可保存在 `licenses/strip-activity-feed-MIT.txt`。

活动数据来自 OpenCode 会话快照：真实工具名称与状态、输入、输出、错误、待审批请求和文件差异。界面不显示模型内部推理文本，也不生成模拟执行记录。工具停止或未知状态不会标为成功。

支持全部、执行过程、文件修改、提醒与异常筛选，展开/收起详情，命令输出复制。成功的 edit 调用可显示实际替换片段；会话提供 patch 时展示文件差异。模型通过 shell 修改文件且上游没有提供差异时，仅显示真实命令，不推断文件变更。

“允许本次”和“拒绝”调用原有会话审批接口。后端仍检查请求归属与一次性审批，组件不会自行执行命令。连续点击会被阻止；轮询更新保留已展开详情，新审批会滚动到可见位置。

附带修复：授权尝试完成、过期或返回 404 后结束跟踪，现有有效 OAuth 凭据仍独立检查，避免旧授权尝试阻塞发送。

源码备份：`.runtime/before-activity-feed-20261015`。回滚桌面版本可启动 `desktop-app/releases/chatgpt-model-fix-20261015/Strip Bot-win32-x64/Strip Bot.exe` 并恢复该备份中的快捷方式。

验收文件只写入 `.runtime/activity-feed-acceptance`。自动化映射测试与真实工具执行记录分开保存；真实结果以该目录的报告为准。
