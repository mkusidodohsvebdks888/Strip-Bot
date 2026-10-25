# Electron 桌面项目模块导航

| 功能 | 文件 |
|---|---|
| Electron 主进程 | `main.cjs` |
| Renderer 安全桥接 | `preload.cjs` |
| 本地服务启动 | `runtime/local-service.cjs` |
| 运行时与外观 | `runtime/` |
| Windows 安装包构建 | `build.cjs` |

业务层移动至 `modules/` 后，桌面打包脚本必须同时复制 `backend/` 和 `modules/`。前者包含网关及兼容入口，后者包含业务实现；缺一不可。
