# Strip Bot Skills 拖放改造

日期：2026-10-20

## 已完成

- Skills 面板改为“已启用 / 技能库 / 移出区”三栏拖放交互。
- 从资源管理器拖入技能文件夹即可导入，默认进入技能库。
- 拖入“已启用”后，导入完成会继续请求启用确认。
- 卡片可在两个栏框之间拖动，完成启用或停用。
- 卡片拖到“移出”区后，沿用原删除确认并彻底移除。
- 保留路径、GitHub、自定义创建表单，作为键盘和无拖放环境的兜底。
- 点击按钮启停、删除和应用到 Agent 的原有流程保持不变。

## 双路径导入

- Electron：通过 preload 暴露的 `webUtils.getPathForFile` 获取真实路径，复用 `/api/skills/import`。
- 浏览器或无法取得路径时：递归读取拖入目录内容，调用新增的 `/api/skills/upload`。

新增上传接口：

`POST /api/skills/upload`

请求包含 `files[{path, base64}]`、`subdir`、`label`、`confirmed:true`。请求体上限 12 MB，解码后的技能仍受 100 文件 / 8 MB / 拒绝符号链接 / 最多 60 个技能的原有约束。

## 主要文件

- `codex-ui/src/components/Sidebar/SkillsTool.tsx`
- `codex-ui/src/components/Sidebar/skills-dnd.css`
- `codex-ui/src/lib/skills-drop.mjs`
- `codex-ui/src/lib/skills-drop.d.mts`
- `backend/skills.cjs`
- `backend/gateway.cjs`
- `desktop-app/preload.cjs`
- `test/skills-drop.test.mjs`
- `test/skills-upload.test.js`
- `test/extension-workspace.test.js`

## 验证

- Skills 拖放、上传、网关和 Agent 注入定向测试：16/16 通过。
- 全量测试：204/204 通过。
- TypeScript：通过。
- ESLint：通过。
- Vite 生产构建：通过。
- 本地服务：HTTP 200。
- 最终资源：
  - `index-BwNJmLxE.js`
  - `index-CQ_mSxOB.css`

## 最终应用

`G:\p\Page07\desktop-app\releases\skills-drag-drop-20261020\Strip Bot-win32-x64\Strip Bot.exe`

桌面快捷方式已更新：

`E:\Desktop\Desktop\Strip Bot.lnk`

## 回滚

上一版仍保留：

`G:\p\Page07\desktop-app\releases\manual-commands-store-20261020-r2\Strip Bot-win32-x64`