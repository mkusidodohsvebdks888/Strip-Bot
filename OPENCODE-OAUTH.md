# OpenCode 原生 ChatGPT 账号授权

## 最新验收结果

OpenCode 内置 `chatgpt-browser` 方式已授权成功，专用 `auth list` 显示 OpenAI stored，新引擎可读取19个目录模型。登录脚本默认采用该已验证的方式；修复 V2 `models` 命令不接受 `openai` 位置参数的问题，改为 `models --standalone`。

真实引擎验收又修复两处协议差异：会话模型字段必须为 `{providerID,id}`，Fast 等变体使用 OpenCode 内部 `id`，不能用相同的上游 `modelID` 替代。26项回归测试及生产构建通过。

真实模型请求结果：`gpt-6.1-sol` 被账号上游明确拒绝为不支持；`gpt-5.5` 返回429 `usage_limit_reached`，计划类型 `free`，额度100%，上游返回重置时间2026-10-17 12:48:03（北京时间，实际以服务端为准）。因此只确认授权及真实上游请求链路可达，尚未获得真实生成回复，工具验收也未进入执行阶段。默认新对话优先选择GPT-5.5，仍需账号额度恢复后验收。

运行 `node test/opencode-oauth-real.e2e.cjs` 可在额度可用时重新执行文本和受限文件/终端工具验收（不属于 `npm test`）。失败记录在 `.runtime/oauth-real-acceptance/verification.json`。桌面修复版本为 `desktop-app/releases/native-oauth-ready-20261014`。

## 当前登录阻塞（实测）

代理接入后的实际 Token Sharing 授权仍返回 `Request failed: 400`，不同于无凭据诊断中预期的400，不能视为授权通过。当前二进制未展示详细错误体，具体账号/授权参数原因待确认。可尝试 OpenCode 自带的另一浏览器 OAuth 方法（凭据仍存专用目录，不连接 CC Switch，不读写官方 Codex 登录配置）：`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\OpenCode-Auth.ps1 -Action login -LoginMethod chatgpt-browser`。尚未验证备用方式成功，默认方式未静默切换。

后续诊断：Windows 系统代理为 `127.0.0.1:7890`，但原启动进程没有代理环境变量。使用此现有代理重复无凭据测试，令牌端点返回 `400 unsupported_grant_type`，而非直连的地区限制403。已新增 `.runtime/opencode/proxy.json` 保存本机代理地址，登录脚本和原生引擎均读取此文件，设置 HTTP_PROXY/HTTPS_PROXY，NO_PROXY 保证本机连接直连。未修改系统代理节点和官方 Codex 配置。关闭此功能可移走此 JSON 文件并重启专用进程。新版桌面目录为 `desktop-app/releases/native-oauth-proxy-20261014`。26/26测试通过；OAuth仍需用户完成新的授权流程，端点诊断400不能作为真实授权成功的证据。

2026-10-14 浏览器回调显示 `Request failed: 403`。使用不携带账号凭据的诊断请求测试 `/api/accounts/oauth/token` 和 `/oauth/token`，两者均返回 JSON 错误 `unsupported_country_region_territory`，没有返回验证码挑战页面。当前进程的网络请求因此受到上游地区限制；尚未证明账号授权或真实 GPT 调用成功。若实际位于官方支持地区，应核查正常网络出口并联系上游支持处理误判。诊断记录为 `.runtime/oauth-network-diagnosis.json`，不含授权码或令牌。不要重复使用旧回调 URL。

2026-10-14：选择性合并用户提供的 OAuth 源码包，保留当前统一聊天与编程界面。产品新会话链路：Strip Bot → 独立 OpenCode 2.0.28 → OpenAI 原生提供商 → GPT。新会话与追问不会解析 CC Switch 当前路由。

凭据保存在工作区 `.runtime/opencode` 专用配置，由 OpenCode 管理；没有修改官方 Codex 登录文件或 CC Switch 配置。启动原生提供商时清除继承的 OPENAI_API_KEY、OPENAI_BASE_URL 等覆盖项。工具操作仍逐次批准。

## 登录

在项目目录执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\OpenCode-Auth.ps1 -Action login
```

选择 ChatGPT OAuth 方式，命令使用 `--standalone`，避免连接普通 OpenCode 后台服务。手动完成浏览器账号授权后重启 Strip Bot，在“OpenCode · ChatGPT 授权”中刷新模型。新建对话选择原生模型；旧 CC Switch 会话保留记录，继续工作需新建原生对话。

状态检查：同一脚本 `-Action status`；模型检查：`-Action models`。可见模型不等于授权成功，真实回复和工具执行仍需单独验收。不同账号可用模型、配额以 OpenCode 和上游实际返回为准。

## 验证与部署

25/25 自动测试通过，包含原生模型校验、新建与追问不访问 CC Switch、权限与会话隔离；TypeScript 和生产构建通过。真实 OpenCode 进程可以启动。授权前检查未发现 OpenAI 凭据，原生模型列表为空。尚不能声称真实 GPT 回复或 OAuth 工具闭环已通过。

新版：`desktop-app/releases/native-oauth-20261014/Strip Bot-win32-x64/Strip Bot.exe`。桌面快捷方式已更新。旧版保留于 `desktop-app/releases/unified-chat-20261014`。源文件备份位于 `.runtime/before-native-oauth-20261014`，快捷方式备份 `.runtime/Strip Bot-before-native-oauth.lnk`。

普通网页入口通过 `npm.cmd start` 启动3060端口；运行 `npm.cmd test` 验证回归。回滚前退出新版并停止其3060网关，再启动旧程序，避免复用不同版本的网关。

## 2026-10-14：恢复 CC Switch 连接切换

桌面发布：desktop-app/releases/ccswitch-unified-20261014/Strip Bot-win32-x64。
对话页顶部可选择 CC Switch 或 ChatGPT 账号；新安装/未保存连接时默认 CC Switch。
CC Switch 模式每 5 秒及窗口重新获得焦点时读取公开 Codex 路由模型，创建会话时后端再次读取最新配置，不传入原生账号模型覆盖值。
切换连接保留草稿并新建对话；模型发生变化时旧对话提示新建，不会静默重绑定。
原生 OpenCode 授权数据和官方 Codex 配置未修改。
验证：UI TypeScript/Vite 构建通过，27 项自动测试通过（包含当前路由模型变化及原生模式隔离）。
回滚：运行 desktop-app/releases/send-state-20261014/Strip Bot-win32-x64/Strip Bot.exe；旧版本保留。
真实验收：在界面输入后发送按钮启用；新会话通过 OpenCode -> CC Switch Responses 路由发出请求，当前 OpenAI Official 返回 401 cc_switch_auth_error。用户确认尚未配置 API 供应商，因此未通过真实回复验收，未执行真实编程工具测试。需要先在 CC Switch 的 Codex 页面配置有额度的 API 供应商。

## 2026-10-14：仅保留 CC Switch 连接

发布：desktop-app/releases/ccswitch-only-20261014/Strip Bot-win32-x64/Strip Bot.exe，桌面快捷方式已更新。
聊天与编程仅通过 CC Switch，移除界面账号授权入口及连接选择；模型自动跟随 Codex 路由，新对话发送时后端重新解析模型。
部署启用 ccSwitchOnly，拒绝原生账号连接配置、会话创建与 prompt 请求；旧账号会话仅可查看，保留授权数据及历史。
OpenCode 继续作为工具执行引擎，文件和命令仍逐次审批。
验证：前端构建通过，28/28 自动测试通过，运行服务 health.ccSwitchOnly=true、nativeAuth=false，界面已确认仅有 CC Switch 连接。
真实上游之前为 OpenAI Official 401，用户尚未配置 API 供应商；此次不重复产生模型请求，未声称真实回复成功。
回滚：启动上一版 desktop-app/releases/ccswitch-unified-20261014/Strip Bot-win32-x64/Strip Bot.exe。
