# Strip Bot

> **模块化导航：** 程序已按执行、模型、插件、桌宠等拆分，参见 [模块索引](modules/README.md) 与 [分类清单](modules/catalog.json)、[全部项目分类](PROJECTS.md)。旧 backend 路径保持兼容。

React + Node.js + Electron 本地 AI 对话程序，使用深色 Codex 风格界面，只向本机 API 地址发送请求。当前架构、构建和回滚说明见 [ARCHITECTURE.md](ARCHITECTURE.md)。下文保留早期 Lucent 版本的说明作为历史参考。

## 截图 / 功能

- 透明白色玻璃质感、适配 PC 和手机
- 消息发送、流式回答、停止生成、复制回答
- 多会话、新建 / 删除会话、浏览器本地记录
- 内置 API 设置窗口、连通性测试
- 接口支持 OpenAI 兼容接口、Ollama、简单 JSON 接口
- 内置本机代理，解决网页直连本地 API 常见的 CORS 问题
- 出站地址仅允许 `localhost`、`127.0.0.1` 和 `[::1]`；不会主动连接公网。注意：**本地 API 是否自行连接外网，由该 API 自己决定**。

## 1. 启动前端 + 本地转发服务

需要 Windows / macOS / Linux 和 Node.js 18 或更新版本，不需要 `npm install`。

Windows：双击 `start-windows.bat`。浏览器打开：

```text
http://127.0.0.1:3060
```

或通过命令行运行：

```bash
node server.js
```

## 2. 连接你已经运行的本地 API

打开页面 → 右上角齿轮 → 选择 API 类型、填写本机地址和模型名 → “检测连接” → “保存配置” → 在聊天框发送消息。

| 类型 | 本地 API 地址示例 | 模型名称示例 |
| --- | --- | --- |
| OpenAI 兼容 | `http://127.0.0.1:8000/v1/chat/completions` | `local-model`（按你的服务填写） |
| Ollama | `http://127.0.0.1:11434/api/chat` | `qwen2.5:3b`（需本机已拉取该模型） |
| 普通 JSON | `http://127.0.0.1:8000/api/chat` | `local-model` |

### 接口协议

**OpenAI 兼容接口**：向配置地址发送 `POST` JSON：

```json
{
  "model": "local-model",
  "messages": [{ "role": "system", "content": "你是 AI 助手" }, { "role": "user", "content": "你好" }],
  "stream": true
}
```

接受 `text/event-stream`（`choices[0].delta.content`）或普通 JSON（`choices[0].message.content`）。

**Ollama**：发送 `POST` JSON `{ "model": "...", "messages": [...], "stream": true }`，接收 NDJSON 的 `message.content`。

**普通 JSON 接口**：发送 `POST` JSON `{ "message": "你好", "messages": [...], "model": "local-model" }`，接受以下任意 JSON 文本字段：

```json
{ "reply": "你好，我收到了" }
```

同样支持 `response`、`text`、`content`、`output`、`message.content` 字段，也支持直接返回纯文本。

后端接收到真实上游回复后，统一使用 `event: delta / done / error` 的 SSE 协议返回给前端；这样前端始终只需请求同源的 `/api/chat`。

## 3. 没有本地模型？先测试收发链路

Windows 双击 `start-demo-windows.bat`，它会同时启动 UI 和一个测试用 API：

- UI：`http://127.0.0.1:3060`
- 测试 API：`http://127.0.0.1:8000/v1/chat/completions`

点击右上角齿轮，“检测连接”，保存后即可发送测试消息。

**注意：测试 API 只把收到的消息回显给你，用于证明 UI、转发和 SSE 链路已连通。它不调用 AI 模型，不能当成真实 AI。** 真正使用时，先停掉测试 API，再把设置改为你的模型服务地址。

## 4. 更改端口 / 设置本地 API Key

PowerShell：

```powershell
$env:PORT = '3060'
$env:LOCAL_API_KEY = 'your-local-api-key'
node .\server.js
```

`LOCAL_API_KEY` 会由 **Node 转发服务**放入 `Authorization: Bearer ...`，不会返回到网页前端。如果接口的认证并非 Bearer，需要修改 `server.js` 的 `authHeaders()`。

可选服务端默认设置（首次访问时浏览器加载；此后以浏览器中的已保存设置为准）：

```powershell
$env:LOCAL_API_PROVIDER = 'openai'
$env:LOCAL_API_URL = 'http://127.0.0.1:8000/v1/chat/completions'
$env:LOCAL_MODEL = 'local-model'
node .\server.js
```

## 5. 前后端目录

```text
lucent-local-chat/
├─ public/
│  ├─ index.html           # 页面
│  ├─ styles.css           # 半透明白色 UI
│  ├─ app.js               # 会话管理、消息显示、SSE 流式接收
│  └─ favicon.svg
├─ server.js               # 本地 UI HTTP 服务 + API 转发
├─ test/
│  ├─ demo-local-api.js    # 测试回显（非 AI）
│  └─ integration.test.js
├─ start-windows.bat
├─ start-demo-windows.bat
└─ package.json
```

安全约束：UI HTTP 服务只监听 `127.0.0.1`；API 地址仅支持回环地址；不会把本地 API Key 保存在网页设置中；前端使用文本节点显示模型输出以减少 HTML 注入问题。会话保存在该浏览器的 `localStorage`；它不加密，**不适合在共用电脑中保存敏感聊天记录**。此项目是本地开发原型，不提供多用户登录、服务端消息数据库或部署到公网的鉴权能力。想部署为公网服务，应增加登录鉴权、授权、速率限制和独立会话存储。

## 组件图标

当前 Codex UI 的功能图标来自 Lucide（ISC），另有 4 个 MingCute 柔和版（Apache-2.0）。清单在 codex-ui/icons/manifest.json，执行 node codex-ui/scripts/build-icons.mjs 生成 codex-ui/src/icons.generated.ts；全部为 24×24 描边图标，颜色跟随组件（currentColor）。模型品牌图标仍为 Lobe Icons（MIT）。许可全文见 licenses/README.md。

旧版页面脚本 public/app.js 仍内嵌 Solar Icons Bold Duotone（@solar-icons/static 2.3.2，480 Design，CC BY 4.0），由 server.js 以 /app.js 历史路由继续提供，因此该许可说明保留。替换前备份位于 .runtime/before-lucide-icons、.runtime/before-solar-icons 与 .runtime/public-assets-stale-20261013。

## 按钮与图标套件（Strip UI Kit）

按钮体系来自 Strip UI Kit（MIT，独立作品），按原样集成：

- 图标：codex-ui/public/icons/ 共 48 枚 24×24 SVG（1.8px 细线描边），既可用 CSS mask 引用，也可在 codex-ui/icons/manifest.json 中作为 `kit` 源内联
- 样式：codex-ui/src/styles/strip-buttons.css，在 main.tsx 中最先引入作为基础层，应用自身样式随后加载并覆盖
- 组件：codex-ui/src/components/StripButton.tsx（StripButton / StripIcon，可选）
- 令牌：kit 的 `--sb-*` 在 strip.css 中映射到 Strip Bot 既有调色板（--surface-3 / --border-10 / --accent 等）；几何保持 kit 原值：9px 圆角、34/28/40px 高度、13px 字号、160ms 过渡、禁用态 44% 不透明度
- 已套用 kit 类的控件：新建对话（secondary）、发送（primary 图标按钮）、删除会话（ghost 图标 small）、提示词条（secondary small）、复制回复（ghost small）、设置对话框三个动作按钮、左下角设置齿轮（ghost 图标）
- 输入框：消息输入框容器 14px 圆角 + kit 焦点环（`--sb-focus-stroke` / `--sb-focus`）；侧栏搜索框 34px 高、9px 圆角、16px kit 图标；设置对话框 input/select/textarea 统一 34px 高、9px 圆角、13px 字号、kit 焦点环，select 用 kit `chevron-down` 替换原生箭头（`.strip-select` 包裹）
- 设置入口只有一个：位于侧栏左下角的齿轮图标按钮（ghost 图标按钮，`aria-label="本地 API 设置"`），其上一道分隔线与下方许可署名相邻；顶栏不再放设置按钮，只在生成时显示「正在生成」状态。之前的账号行与顶栏齿轮均已按需求移除
- 注意：kit 的 `.strip-ui .strip-btn` 设了 `display:inline-flex`，会盖掉单类选择器的 `display:none`；移动端专用控件改用 `.strip-ui .strip-btn.strip-mobile` 控制显隐
- 许可全文：licenses/strip-ui-kit-MIT.txt；原始 zip 保存在 .runtime/ui-kit-20261013

## 输入框（Strip Codex Composer）

输入区改用 Strip Codex Composer（MIT，独立作品），原有发送逻辑保留：

- 组件：codex-ui/src/components/StripCodexComposer.tsx，相邻放置套件的 strip-codex-composer.css，未改动其内部结构与类名
- 为接入宿主追加了可选能力：`value` / `onValueChange`（受控文本，宿主持有草稿，空状态提示词条与发送后清空才生效）、`busy` / `onStop`（生成中把圆形发送按钮换成停止按钮）以及 `stop` 图标路径；不传这些属性时行为与套件原版一致
- 受控模式下不再由组件在发送成功后清空文本（宿主自行管理），流式生成期间文本框保持可编辑，与旧版行为一致
- 已具备：Enter 发送 / Shift+Enter 换行、中文输入法合成期间不误发、随内容自动增高（上限 220px，超出内部滚动）、附件选择 / 拖拽 / 粘贴与 chips 逐个移除
- 样式：`--scc-*` 令牌在 strip.css 中映射到 Strip 调色板（面板底色 --head-bg、边框 --border-10、chip --surface-3、hover --surface-2），并屏蔽全局 `input/textarea:focus-visible` 描边，焦点改由面板 `:focus-within` 呈现
- 与前端的接线：`value` 接 lucent 草稿状态，`onSend` 调用现有 `send(text, attachments)`，`busy` 接生成状态，`onStop` 调用 AbortController
- 尚未接后端（当前本机桥接接口不支持）：附件只记录文件名并显示在消息气泡上，文件内容不会上传；推理强度 / 运行环境 / 权限模式是前端选择项，不参与后端鉴权；模型下拉目前只有「当前配置模型」一项，需要后端提供模型列表
- 许可全文：licenses/strip-codex-composer-MIT.txt

## 下拉框（Strip Dropdown V3）

输入框下方的 模型 / 推理强度 / 运行环境 / 权限 四个原生 `select` 已换成 V3 的 `StripDropdown` 自定义下拉：

- 组件：codex-ui/src/components/StripDropdown.tsx + 同目录 strip-dropdown.css；composer 也换成 V3 版（其 `Choice` 内部渲染 StripDropdown），并按 README 要求重新套用了宿主扩展（value/onValueChange/busy/onStop/stop 图标）
- 交互：选中项显示对勾、悬停/方向键高亮、Enter 确认、Esc 关闭、点击外部关闭、选项多于 5 个时自动出现搜索框、菜单向上展开避免被裁切、水平方向自动夹到视口内
- 主题：`--sdd-*` 继承 `--scc-*`，因此复用同一套映射；另有独立规则给弹出菜单单独的表面色（`#17171b`）与阴影，否则会和输入面板同色而看不见
- 选项支持 `description` 副标题：Low/Medium/High 分别为「更快，输出更精简 / 速度与深度均衡 / 更深入，耗时更长」，本地=仅请求本机 API，按需批准=发送前由你确认，模型=来自本地 API 配置
- 重要修复：套件的暗色令牌选择器是 `.strip-ui[data-theme="dark"] .strip-codex-composer`（3 个类），此前 strip.css 里的映射只有 1 个类、**实际一直被覆盖**（面板其实是套件的 `#25262a`）。现已改用同权重选择器，面板底色才真正跟随 `--head-bg`
- 套件类型 bug：StripDropdown.tsx 的 `itemRefs` 声明为 `Array<HTMLDivElement | null>`，但选项渲染为 `<span>`，`tsc` 报错；已改为 `HTMLSpanElement`
- 许可全文：licenses/strip-ui-kit-MIT.txt；V3 套件归档在 .runtime/ui-kit-20261013/Strip-UI-Kit-v3
- 验证用探针（不改动应用）：.runtime/dropdown-probe.html + dropdown-probe.cjs，可用 .runtime/electron-runtime/electron.exe 运行，用于单独检查套件 CSS

## 接入 Page02 browser-ai-bridge

工作台默认后端已指向 `G:\p\Page02` 的 browser-ai-bridge（Playwright 复用已登录网页版 AI，OpenAI 兼容接口，默认 `http://127.0.0.1:3010`）。

- 默认接口：`provider: openai` + `http://127.0.0.1:3010/v1/chat/completions`（桥接**只**实现 chat/completions，旧的 `/v1/responses` 默认值已修正；桌面端 `desktop-app/main.cjs` 与 `server.js` 的默认值同步更新）
- 令牌：桌面端启动时会自动读取 `G:\p\Page02\browser-ai-bridge\.env` 里的 `BRIDGE_TOKEN` 并作为 `LOCAL_API_KEY` 注入内嵌服务，由 Node 侧放进 `Authorization: Bearer`，不下发到页面；独立运行 `node server.js` 时需自己设置 `LOCAL_API_KEY`
- 规则实时调配：设置面板可改 桥接平台（chatgpt/gemini/claude/grok/qwen/deepseek）、联网搜索（enableSearch）、模型名称、系统提示词；这些字段随每条消息即时下发，改完保存后下一条消息即生效，无需重启
- 推理强度：输入框的 Low/Medium/High 直接映射桥接的 `enableReasoning`（Low=关闭、Medium=跟随桥接默认、High=开启）
- 转发字段：`server.js` 的 `bridgeRules()` 把 `bridgeProvider`→`provider`、`enableSearch`、`enableReasoning`、`temperature`、`conversationId` 透传给上游；`systemPrompt` 会作为第一条 `system` 消息注入
- 会话连续性：工作台每个会话把自己的 chat id 作为 `conversationId` 下发，桥接据此复用同一个浏览器标签页。桥接的规则是「不带 id = 开新对话（新标签页），带 id = 继续该对话」，所以不带 id 会每条消息都新开对话、网页端丢失上下文
- 不再反复弹浏览器：桥接只在新开对话或检测到人机验证时把浏览器窗口切到前台（`bringPageToFront` 注释里写明仅用于人机验证）。实测：复用同一个 `conversationId` 发送时前台窗口保持为 Strip Bot；换新的 `conversationId` 时前台会切到 chrome。所以「每条消息都弹 Google」的根因就是缺 `conversationId`，现已修复；新建会话的第一条消息仍会开一个标签页
- 模型实时切换：启动时与切换接口地址时都会静默调用 `/api/models`，把桥接提供的模型（chatgpt/gemini/claude/grok/qwen/deepseek）填进输入框的模型下拉；选中的模型随该条消息下发，桥接模型 id 同时作为 `provider`，并写回 `config.model`
- 速度档位：输入框的 快速/自动/思考 分别映射 `enableReasoning=false / 不干预 / true`（DeepSeek 网页端的「快速/自动/思考」同义）
- 接口选择：桥接同时提供 `/v1/responses`（Codex 工具协议，支持 tools，但不支持 provider/enableReasoning/enableSearch）与 `/v1/chat/completions`（文本，支持规则字段）。默认选 chat/completions，因为「规则实时调配」依赖那些字段；需要工具执行时可在设置里切回 OpenAI Responses
- 实测（2026-10-14）：经工作台自身服务 3060 → 桥接 → 真实 ChatGPT，单轮 16s 返回「收到」；随后用同一 `conversationId` 只发新问题，第二轮答出第一轮告知的暗号，确认会话被复用
- 模型列表：新增 `GET /api/models?endpoint=…`，由 Node 侧代理读取桥接的 `GET /v1/models`（浏览器无法直连：跨源且桥接默认只允许同源）。设置面板的「从桥接读取模型」按钮填充模型下拉
- 连通性检测：`/api/check` 对 `openai` 类型会请求 `…/v1/models`，因此能直接验证桥接是否就绪
- 启动桥接：运行 `G:\p\Page02\02-Start.cmd`（首次需在弹出的 Chromium 里登录各 provider）
- 契约测试：`.runtime/bridge-contract-test.cjs`（单个 node 进程内起 mock 桥接 + 代理，校验转发字段、system 注入、token 透传、SSE 中继与 /api/models）
- 备份：`.runtime/before-page02-bridge-20261013-server.js`、`.runtime/before-page02-bridge-20261013-main.cjs`

## 字体

界面与聊天沿用 Codex Desktop 风格的系统字体栈，变量在 codex-ui/src/styles/tokens.css，基础层在 codex-ui/src/styles/global.css：

- `--font-ui`：-apple-system / BlinkMacSystemFont / Segoe UI / Microsoft YaHei UI / PingFang SC / Noto Sans SC；界面 14px、行高 1.5、字距 0
- `--font-code`：Geist Mono / SFMono-Regular / SF Mono / Cascadia Code / Consolas；代码与终端 13px、行高 1.6
- 侧边栏与工具栏 13px，聊天内容 14px/1.65，设置页标题 18px 半粗体
- 界面字体全部使用系统自带字体，无需安装；只有希望代码区优先使用 Geist Mono 时才需要单独安装该字体


窗口外观：桌面版使用 `titleBarStyle: 'hidden'` + `titleBarOverlay`（`#0a0a0b` / 符号色 `#cfcfd2` / 高 34px），并设 `nativeTheme.themeSource = 'dark'`，因此不再出现 Windows 原生白色标题栏，深色界面铺满整个窗口；系统的最小化/最大化/关闭按钮以暗色覆盖层绘制在右上角。顶部拖动区域分别落在 `.strip-header` 与侧栏 `strip-drag` 行上，其中的按钮/输入框/链接设为 `-webkit-app-region: no-drag`；`.strip-header` 右侧预留 150px 内边距避开覆盖层按钮。改动前备份：`.runtime/before-titlebar-20261013-main.cjs`。
## 当前界面：Strip Bot Codex UI

3060 页面现已使用 codex-ui/src 的 React 前端，完整迁移、构建、启动与回滚说明见 CODEX-UI-MIGRATION.md。原本本地 API 网关继续使用 server.js。构建命令：powershell -File scripts/BuildUI.ps1。

# 架构更新（2026-10-14）

当前 Strip Bot 已分离界面、会话管理、流式客户端、协议网关和桌面服务生命周期。模块职责、验证命令及回滚方法见 [ARCHITECTURE.md](ARCHITECTURE.md)。

