# Strip Bot 输入框按钮删除

日期：2026-10-20

## 已删除

- 星形“优化指令”按钮：`strip-prompt-enhance-button`
- “展开长文本编辑器”按钮：`strip-workflow-expand-button`

同时删除：

- `StripCodexComposer` 的 `onOptimizePrompt` 入参
- `App.tsx` 中对应的 `buildInstruction` 调用和导入
- 输入框内部 `expanded` 状态及大文本框样式类
- 展开按钮相关的键盘分支和专用 CSS
- `扩展编辑器`、优化按钮的残留样式

## 保留行为

- `Enter` 发送
- `Shift+Enter` 换行
- `Ctrl+Enter` / `Meta+Enter` 发送
- IME 组合输入不会误发送
- 斜杠指令提示、附件、权限、模型、发送/停止生成功能保持不变

## 验证

- 定向测试：7/7 通过
- 全量测试：208/208 通过
- TypeScript、ESLint、Vite 构建：全部通过
- 最终 JS 中已确认不存在：
  - `优化指令`
  - `展开长文本编辑器`
  - `strip-prompt-enhance-button`
  - `strip-workflow-expand-button`
- 最终资源：`index-BWVv9piS.js`、`index-Dthpx7XX.css`
- 本地服务：HTTP 200

## 最终应用

`G:\p\Page07\desktop-app\releases\composer-tools-removed-20261020\Strip Bot-win32-x64\Strip Bot.exe`

桌面快捷方式已更新。

## 回滚

上一版仍保留：

`G:\p\Page07\desktop-app\releases\codex-borders-20261020-r3\Strip Bot-win32-x64`