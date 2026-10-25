# Strip Bot 本地插件

旧版工具已转换为独立插件入口，管理入口为左侧「插件」。默认禁用、需要用户确认。

| 插件 | 功能 | 原有源码 | 运行依赖 |
|---|---|---|---|
| archive-7zip | ZIP/7z 压缩与解压 | 解压缩/7-Zip | 安装 7-Zip CLI (7z) |
| office-pdf | Word、PPT、Excel 转 PDF | PDF转换/LibreOffice（Git 子模块） | 安装 LibreOffice (soffice) |

配置：.runtime/bundled-plugins.json（不提交）；API /api/plugins/bundled（GET）、/enable（POST）、/execute（POST）。
启用及每次执行都需要确认。只在本机同源服务中开放，不自动授权 AI Agent。
程序使用 spawn 无 shell 拼接，输入/输出必须为绝对路径，拒绝覆盖已有目标。
原有「解压缩」与「PDF转换」目录仍保留作为源码与历史 CLI，避免破坏原始代码。
注意：源码不等于已安装程序；未在目标 Windows 环境完成运行验证。
