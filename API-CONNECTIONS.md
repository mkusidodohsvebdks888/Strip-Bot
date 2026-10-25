# 模型连接方式

当前 Strip Bot 支持 **CC Switch**、**API Key 连接**与 **ChatGPT 账号登录**。入口在侧栏“模型连接”，或聊天标题栏的当前连接按钮。

## CC Switch

保留现有 Codex 本地路由，默认 `http://127.0.0.1:15721/v1/responses`。模型从 CC Switch 当前公开配置读取。上游必须有可用认证；选择 OpenAI Official 不会自动将官方 Codex 的登录凭据传给 OpenCode。

## API Key 连接

在连接页选择 API Key，填写带版本路径的 Base URL（例如 `https://api.openai.com/v1`）、API Key、实际模型 ID，以及 Responses 或 Chat Completions 协议。

1. 保存连接。
2. 可选：点击“检测真实请求”，发送一条简短模型请求（可能产生费用）。
3. 返回对话，以新会话开始使用。聊天和编程使用同一连接。

公网 API 必须使用 HTTPS。本机回环地址支持 HTTP。切换供应商时需要重新填写该服务的密钥，避免将旧密钥发送给新地址。清除密钥用于不需要认证的本机接口。

API Key 通过 Windows DPAPI 加密后保存在 `.runtime/api-connection.json`。此文件不应提交 Git；它只能由原 Windows 用户解密。前端状态只返回 `hasKey`，不会回显密钥。输入框中的新密钥在成功保存后清空。程序不改动官方 Codex 登录配置。

OpenCode 通过带随机内部凭据的本机转发接口调用已保存的 API。转发地址不能由请求方任意指定，不跟随上游重定向。模型、协议或密钥改变时，旧会话保留记录，后续操作须新建会话。文件和命令权限仍逐次审批。

## 验证范围

自动化测试覆盖保存与加载、密钥不回传、地址变更密钥保护、两种连接路由隔离、认证错误/额度错误、工具结果透传和旧配置拒绝。

测试通过不代表真实供应商可用。首次使用仍需用户填写有效密钥，并以真实请求结果确认模型兼容性。

源码备份：`.runtime/before-connection-options-20261015`。上一桌面版本：`desktop-app/releases/notification-popup-20261015-r2`。

## ChatGPT 账号登录

在模型连接页选择 ChatGPT 账号登录。程序会读取 `.runtime/opencode` 中现有的专用 OpenCode 授权；尚未登录时点击登录，再点击打开浏览器完成授权。使用 OpenCode 2.0.28 的 `chatgpt-browser` 流程，官方 Codex 的凭据保持独立。模型从 OpenCode 目录读取，在连接页选择型号后新建对话。

授权页面可重新打开，也可取消本次授权。账号服务使用独立的 `account-config` 配置目录，避免覆盖正在工作的 CC Switch/API 连接。授权地址只允许 HTTPS auth.openai.com，状态接口不返回凭据与凭据 ID。

目录列出的模型不保证账号可用。上游可能返回模型不支持或额度不足，需以真实调用为准；不得将登录成功视为真实模型验收通过。

本次源码备份：`.runtime/before-chatgpt-login-20261015`。回滚可运行 `desktop-app/releases/connection-options-20261015/Strip Bot-win32-x64/Strip Bot.exe`，并将桌面快捷方式指回该程序。

2026-10-15 实测：同一 ChatGPT 授权使用 gpt-5.5 / gpt-6.1-sol / gpt-5.3-codex-spark 被上游拒绝；gpt-6-luna 成功返回 STRIP_ACCOUNT_OK。未手动选择型号时，当前优先使用 gpt-6-luna（若目录存在）。模型可用性仍可能随账号和上游变化。
