# OpenCode `metadata.literal` 数据格式异常修复（2026-10-20）

## 现象

界面显示：

```text
数据格式异常
Expected JSON value
at ["data"][0]["metadata"]["literal"]
```

## 根因

这不是 CSS、模型正文或停止按钮写入数据的问题。

OpenCode 2.0.28 的 `grep` 工具在权限请求中构造：

```js
metadata: {
  root: ".",
  path: _.path,
  include: _.include,
  literal: _.literal,
  caseSensitive: _.caseSensitive,
  limit: _.limit
}
```

其中 `literal`、`include`、`limit` 等是可选项。模型调用 `grep` 时若不传这些字段，它们的值是 `undefined`。OpenCode 2.0.28 在序列化 `GET /api/session/:id/permission` 时把这些 `undefined` 当成非法 JSON，返回 400。

实际运行日志：

```text
level=WARN message="schema rejection" kind=Body
reason="Expected JSON value\n  at [\"data\"][0][\"metadata\"][\"literal\"]"
http.method=GET
http.url=/api/session/ses_.../permission
http.status=400
```

前端每 800ms 轮询该会话；`/permission` 失败后，`issue-presentation.mjs` 把原始错误映射成“数据格式异常”，所以看到的是前端翻译后的提示。

## 代码位置

- 错误展示映射：`codex-ui/src/components/issue-presentation.mjs`
- 权限轮询与会话快照：`backend/agent/service.cjs`
- OpenCode 引擎启动和版本检查：`backend/agent/engine.cjs`
- OpenCode `grep` 工具实现位于运行时二进制内部，不在前端源码中。

## 修复

将 OpenCode 运行时从 `2.0.28` 升级到 `2.1.1`。

修改：

- `agent-runtime/package.json`
- `agent-runtime/package-lock.json`
- `backend/agent/engine.cjs`
- `backend/agent/service.cjs`
- `test/agent-native.e2e.cjs`

没有通过把 `literal` 强制改成字符串或 `null` 来掩盖错误。

## 回归测试

新增：

`test/opencode-grep-permission.test.js`

测试使用真实 OpenCode、真实权限接口和本地确定性模拟模型：

1. 强制模型调用 `grep`。
2. 故意不传 `literal`、`include`。
3. 读取 `/permission`。
4. 批准该权限。
5. 等待 `grep` 工具完成。

结果：通过。

完整测试：

```text
tests 217
pass 217
fail 0
```

## 最终运行时

安装位置：

`G:\p\Page07\agent-runtime\node_modules\@opencode\cli\bin\opencode.exe`

版本：

```text
opencode v2.1.1
```

最终桌面发布目录已重新打包：

`G:\p\Page07\desktop-app\releases\stop-button-20261020\Strip Bot-win32-x64`

需要关闭当前旧版窗口，再从桌面快捷方式重新打开，新的 OpenCode 2.1.1 才会生效。
## 兼容性补充验证

真实 OpenCode 2.1.1 Agent 端到端测试也已通过：

```powershell
node test/agent-native.e2e.cjs
```

验证工具：

- read
- write
- edit
- shell

全部完成，审批流程正常，实际文件内容正确。