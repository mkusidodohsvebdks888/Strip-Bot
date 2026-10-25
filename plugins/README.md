# StripBot 工具与插件

已将桌面宠物、压缩解压和文件转换统一归入 **plugins/**，并保留原项目源码，避免大量二进制资源的重复存储。插件默认停用，属于本地模块，不自动授予 AI Agent 权限。

| 分类 | 插件目录 | 关联的原项目 | 功能 |
| --- | --- | --- | --- |
| 桌宠 | `nono-desktop/` | 插件内已有 3D 资产 | 开启或关闭糯糯窗口，复用已有 Nono 后端 |
| 桌宠 | `deepseek-harness-pet/` | `桌宠/DeepSeek-Q版-dsh-pet/` | Q版蓝发鲸鱼娘、透明动画、拖拽漫游（固定版本源码） |
| 压缩 | `archive-7zip/` | `解压缩/7-Zip/` | 解压和压缩 ZIP / 7z |
| 文档 | `office-pdf/` | `PDF转换/LibreOffice/` | Word / PPT / Excel → PDF |

## 使用方式

在 StripBot 左侧「工具与插件」入口统一管理「本地工具」「GitHub」「MCP 连接」和「AstrBot」。本地工具开关直接启用或停用，不弹二次确认；桌宠开启即显示、关闭即隐藏。执行文件处理仍会确认输入、输出和动作。

- Nono 使用已有 `/api/plugins/nono` 服务实现启停，统一插件中心不会启动第二套 Nono 服务。
- DeepSeek Q版桌宠通过 `dsh-pet` 的独立运行入口 `lib/standalone.js` 启动，无需运行 DeepSeek Harness。首次需运行 `scripts/pets/Build-DeepSeek-Q-Pet.ps1` 构建，或者使用 `DSH_PET_STANDALONE_PATH` 指向编译好的独立入口。关闭插件会停止 StripBot 启动的桌宠进程。上游角色与动画素材存在非商业使用限制，商业发布前请确认授权。
- 7-Zip 使用本机已安装的 `7z` 程序，可用 `SEVENZIP_BIN` 指定；LibreOffice 使用 `soffice`，可用 `LIBREOFFICE_BIN` 指定。自动检测默认目录、PATH 和 Windows 安装注册表，支持自定义盘符；找不到可执行程序时显示「待安装」。源码子模块不等于已安装的程序。
- 项目内 `桌宠/`、`解压缩/`、`PDF转换/` 保留原始项目和许可记录。插件通过清单和运行接口引用，不会将整个 LibreOffice 或 7-Zip 源码复制到插件目录。
- `plugins/catalog.json` 列出插件分类、依赖和原始源码位置；每个插件都有自己的 `plugin.json`。

## 本地接口（同源限制）

- `GET /api/plugins/bundled`：读取插件列表及状态
- `POST /api/plugins/bundled/enable`：`{id,enabled,confirmed:true}`
- `POST /api/plugins/bundled/execute`：`{id,action,input,output,confirmed:true}`；Q版桌宠 `deepseek-harness-pet` 的 `launch/stop` 无须文件路径。

此接口只为本地插件管理而设计，不是面向公网的安全代理。文件格式、压缩包和来源均需用户审查；插件不会自动安装或远程下载第三方程序。
