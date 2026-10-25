# StripBot 插件中心

已将桌面宠物、压缩解压和文件转换统一归入 **plugins/**，并保留原项目源码，避免大量二进制资源的重复存储。插件默认停用，属于本地模块，不自动授予 AI Agent 权限。

| 分类 | 插件目录 | 关联的原项目 | 功能 |
| --- | --- | --- | --- |
| 桌宠 | `nono-desktop/` | 插件内已有 3D 资产 | 开启或关闭糯糯窗口，复用已有 Nono 后端 |
| 桌宠 | `deepseek-harness-pet/` | `桌宠/DeepSeek-Harness-Pet/` | 启动本机已安装的 DeepSeek Harness 桌宠 |
| 压缩 | `archive-7zip/` | `解压缩/7-Zip/` | 解压和压缩 ZIP / 7z |
| 文档 | `office-pdf/` | `PDF转换/LibreOffice/` | Word / PPT / Excel → PDF |

## 使用方式

在 StripBot 左侧「插件」页面，按类别找到插件，确认启用，然后使用对应操作。每次本地文件处理或启动外部桌宠需要明确确认。

- Nono 使用已有 `/api/plugins/nono` 服务实现启停，统一插件中心不会启动第二套 Nono 服务。
- DeepSeek Harness Pet 不随插件包附带编译好的 EXE。Windows 默认检测 `%LOCALAPPDATA%\\DeepSeekHarnessPet\\DeepSeekHarnessPet.exe`；可用 `DEEPSEEK_HARNESS_PET_BIN` 环境变量指定可信 EXE 的绝对路径。需要手动安装。其窗口关闭请使用桌宠自身的退出功能。
- 7-Zip 使用本机已安装的 `7z` 程序，可用 `SEVENZIP_BIN` 指定；LibreOffice 使用 `soffice`，可用 `LIBREOFFICE_BIN` 指定。
- 项目内 `桌宠/`、`解压缩/`、`PDF转换/` 保留原始项目和许可记录。插件通过清单和运行接口引用，不会将整个 LibreOffice 或 7-Zip 源码复制到插件目录。
- `plugins/catalog.json` 列出插件分类、依赖和原始源码位置；每个插件都有自己的 `plugin.json`。

## 本地接口（同源限制）

- `GET /api/plugins/bundled`：读取插件列表及状态
- `POST /api/plugins/bundled/enable`：`{id,enabled,confirmed:true}`
- `POST /api/plugins/bundled/execute`：`{id,action,input,output,confirmed:true}`；桌宠 `deepseek-harness-pet` 的 `launch` 无须文件路径。

此接口只为本地插件管理而设计，不是面向公网的安全代理。文件格式、压缩包和来源均需用户审查；插件不会自动安装或远程下载第三方程序。
