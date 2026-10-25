# Codex 桌面 UI 风格参考（StripBot 原创 CSS）

此目录存放 **独立编写的 Codex 风格研究版 CSS**，供 StripBot 后续主题扩展与功能界面改造使用。并非 OpenAI 官方 Codex 的源代码，也不是第三方网站提取的 `ChatGPT.app` 原始编译 CSS。

## 文件
- `strip-codex-inspired.css`：轻量、可移植的 CSS，包含浅色/深色/自动模式。
- `预览.html`：打开即可看到侧边栏、对话框、输入区、执行任务与状态视觉示例。

## 来源 / 参考
- 第三方设计研究页：https://codex-design.beacon.host/real/
- 第三方组件展示：https://codex-design.beacon.host/components/
- 该网站注明其 app-initial.css、app-primary.css 为 OpenAI 的私有应用样式。**本目录不包含这些官方 CSS、字体或官方图标**。

## 使用方式
将 CSS 引入一个页面，并在容器上添加 `class="sb-codex" data-theme="light"`。也可以将 `data-theme` 改为 `dark` 或 `auto`。组件类名使用 `sc-` 前缀，避免覆盖现有 UI。

这份 CSS 是**素材备份**，不会自动加载进 StripBot 前端。若要作为独立可切换主题，请后续在 `codex-ui/src/modules/theme` 注册主题并按需适配组件。现有用户主题、壁纸和业务页面不会被修改。

本目录中的参考链接仅用于出处及进一步学习。该链接未来可能变更，但已提交的文件不会依赖远程 CSS 或 CDN。
