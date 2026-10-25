# PDF 转换工具

此目录存放免费的 Office → PDF 转换模块，与 `解压缩/7-Zip` 并列管理，不修改现有 StripBot 聊天或执行器逻辑。

## LibreOffice 源码

- 源码子模块：`PDF转换/LibreOffice/`（Git submodule；不是源码直接复制）
- 你的独立 Fork：https://github.com/mkusidodohsvebdks888/core
- 原始项目：https://github.com/LibreOffice/core
- 本次固定版本：`0ea8f79d15a62dfb5a0325640ed5771fc8b75ef2`（Fork 的 `master` 分支）
- 支持的转换：Word（DOC/DOCX）、PowerPoint（PPT/PPTX）、Excel（XLS/XLSX）、ODF 等转 PDF。
- LibreOffice 是免费开源软件，无转换次数限制；须遵守项目原有开源许可证。因源码体积非常大，这里只保存固定版本引用；不会把整套源码再次复制进 StripBot。

默认克隆 StripBot 后 **不会**自动获得 LibreOffice 源码文件；需要时单独执行：

```bash
git submodule update --init --depth 1 -- PDF转换/LibreOffice
```

源码并不等于已安装的转换程序。直接运行下面的脚本，需要 **另行在本机安装 LibreOffice**，或通过 `--soffice` 指定已有的 `soffice` 可执行文件。无需购买 API、会员或云转换服务。

## Windows / macOS / Linux：本地转换命令

要求：Node.js 18+，以及已安装 LibreOffice。

单文件：

```bash
node "PDF转换/convert-to-pdf.mjs" "C:/Docs/demo.docx" --out "C:/Docs/pdf"
```

批量（输入文件夹中的 Office 文件；不递归子文件夹）：

```bash
node "PDF转换/convert-to-pdf.mjs" "C:/Docs/office" --out "C:/Docs/pdf"
```

手动指定 LibreOffice 路径：

```bash
node "PDF转换/convert-to-pdf.mjs" "./demo.pptx" --soffice "C:/Program Files/LibreOffice/program/soffice.com"
```

参数：
- `--out/-o`：输出目录，默认当前工作目录的 `pdf-output/`。
- `--soffice`：指定 LibreOffice 的 `soffice` 可执行文件；也支持环境变量 `LIBREOFFICE_BIN`。
- 可一次传入多个文件或文件夹。仅转换支持的 Office 格式。
- **安全默认值**：目标 PDF 已存在时直接跳过，不会覆盖；不删除原文件；不上传第三方服务器。转换期间 LibreOffice 本身可能按文档内容加载外部链接，处理不可信文件需另行隔离。

## 当前集成范围

- ✅ 已纳入 StripBot 源码目录，并有可从命令行使用的本地转换脚本。
- ✅ 保留了你的 LibreOffice Fork 的固定版本指针。
- ❌ 未安装 LibreOffice，也未验证实际 PDF 转换。
- ❌ 尚未接入 StripBot 的 AI 工具注册、前端按钮或自动任务执行器。

复杂字体、公式和动画的转换质量取决于 LibreOffice 环境，不保证与 Microsoft Office 完全一致。此工具只负责 Office → PDF，不提供 PDF → Word/PPT 逆向转换。
