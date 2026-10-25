# Strip Bot 输入框“命令功能”按钮删除

日期：2026-10-20

## 已删除

- 输入框工具栏中的“按需运行命令”按钮
- `strip-workflow-terminal-button`
- `onToggleTerminal`
- `commandOpen`
- App 中对应的 `commands.toggle` 传参
- CommandPalette 对该按钮的例外点击处理
- 终端按钮专用 CSS

## 保留

- 手动命令状态机、后端命令接口和 `CommandPalette` 代码仍保留，仅移除当前输入框的可见入口。
- 附件、权限、模型、发送和停止生成功能不变。
- `Enter` 发送、`Shift+Enter` 换行和 IME 防误发不变。

## 验证

- 输入框定向测试：7/7 通过
- 全量测试：210/210 通过
- TypeScript、ESLint、Vite 构建：通过
- 最终 JS 已确认不存在 `strip-workflow-terminal-button` 和 `按需运行命令`
- 最终资源：`index-BnFoVKbj.js`、`index-D4tlLffZ.css`
- 本地服务：HTTP 200

## 最终应用

`G:\p\Page07\desktop-app\releases\composer-command-button-removed-20261020\Strip Bot-win32-x64\Strip Bot.exe`

桌面快捷方式已更新。

## 回滚

上一版仍保留：

`G:\p\Page07\desktop-app\releases\ui-optimized-merge-20261020\Strip Bot-win32-x64`