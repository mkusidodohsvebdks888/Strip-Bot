# API 账户头像 · DiceBear Bottts

StripBot 的 API Key 授权头像使用 **DiceBear / Bottts** 开源头像风格（机器人造型）。

- 美术作者：**Pablo Stanley**，原始项目 [Bottts](https://bottts.com/)。
- 头像风格定义：[dicebear/styles](https://github.com/dicebear/styles/blob/main/src/bottts.json)。
- 样式许可：**Free for personal and commercial use**，以原项目和其说明为准。
- DiceBear 渲染软件为 MIT，但美术样式拥有独立许可，不能将机器人插画视为 MIT 代码。
- 本仓库保留原作署名和来源，固定头像文件保存在 `dicebear-bottts-api.svg`。

此图使用 DiceBear 官方 `bottts.json` 的真实 SVG 图形元素，以固定样式组合制作，并非通过 `@dicebear/core` 在运行时生成，也不需要依赖 DiceBear 公共 HTTP API。为了在较小的账户按钮上更清晰，使用了柔和的紫蓝机器人头部和浅色圆形背景。

用户在没有互联网连接时也能正常看到它。不会向头像服务器发送 API Key、账号、模型名称、服务商地址或用户信息。

范围：仅当 StripBot 连接方式为 **API Key 授权 (direct)** 时，左下角工具栏头像与账户弹窗中的头像使用此图。CC Switch 和 ChatGPT 账号连接保留原来的头像。该变更纯属视觉呈现，不涉及认证逻辑。
