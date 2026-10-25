# 解压缩

此目录用于管理 Windows 压缩与解压缩开源工具的独立源码副本，不修改或依赖 Strip-Bot 现有功能。

## 7-Zip

- 本地目录：`解压缩/7-Zip/`
- 原始仓库：`ip7z/7zip`
- 上游地址：https://github.com/ip7z/7zip
- 固定版本：`b88c6bc09339de32f7d18bbab900686b244f42ba`（上游 main 分支提交）
- 用途：Windows 文件压缩、解压缩及命令行程序集成
- 许可：以原项目内 `DOC/License.txt` 为准。大部分源码为 LGPL；部分 RAR 相关文件附有 unRAR 限制，其他个别文件采用 BSD 许可证。

此目录存储的是真实源码文件（不是 Fork、submodule 或外部地址快捷方式）。复制后不会自动跟随上游修改或删除。

> 注意：这是独立源码备份，不是已经安装可运行的 7-Zip 软件。当前已通过 `plugins/archive-7zip/` 提供插件入口，可以在左侧「插件」中启用，仍需本机安装 7-Zip 命令行程序。插件不会自动授予 AI Agent 执行权限；每次操作都要求确认。
