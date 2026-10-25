# 独立插件清单

各插件拥有自己的 `plugin.json` 和入口，不等同于 AI Agent 自动授权。

| 插件 | 源码目录 | 依赖 |
|---|---|---|
| 7-Zip 文件压缩解压 | `archive-7zip/` | 本机 7-Zip CLI；源码留在 `解压缩/7-Zip/` |
| Word/PPT/Excel → PDF | `office-pdf/` | 本机 LibreOffice；源码引用 `PDF转换/LibreOffice/` |
| AstrBot / QQ | `astrbot-desktop/` | AstrBot + NapCat 本地服务 |
| 糯糯桌宠 | `nono-desktop/` | Windows Electron/WebGL 环境 |

插件可逐项审查、测试、更新；原有大型第三方源码不因分类而重复复制。
