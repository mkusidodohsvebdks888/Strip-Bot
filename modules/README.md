# StripBot 业务模块分类

为便于分别优化，已把后端业务实现按职能拆分。旧路径保留轻量兼容入口，外部 API 不变。

```text
Strip-Bot/
├── modules/
│   ├── core/                 # 基础协议/校验
│   ├── agent/                # 引擎/桥接/调度/会话/工作区/指标
│   ├── connectors/           # API/账号/模型/CC Switch
│   ├── integrations/         # Skills/MCP/GitHub/后端/插件
│   └── companions/           # 桌宠和 AstrBot 后端
├── codex-ui/                 # 前端 React 工程
├── desktop-app/              # Electron 桌面端
├── plugins/                  # 独立插件实现
├── 解压缩/                    # 7-Zip 源码
├── PDF转换/                   # LibreOffice 子模块
├── 桌宠/                      # 桌宠开源源码
├── backend/                  # 网关 + 旧代码兼容路径
└── test/                     # 回归测试
```

## 分类与使用

- **实现目录**：`modules/<类别>/<名称>/`，各模块有 `module.json`。
- **导航入口**：`modules/catalog.json` 列出 19 个独立业务模块、22 条兼容路径和其他工程。
- **旧代码兼容**：`backend/*.cjs` 和 `backend/agent/*.cjs` 通过 `module.exports=require(...)` 导出新实现，保持老入口可用。
- **组合根**：`backend/gateway.cjs` 仍集中连接 HTTP、权限和服务生命周期，避免影响已有 API。
- **项目分离**：React 前端、Electron 桌面壳、桌宠、7-Zip、LibreOffice 和各个插件保留独立工程目录，不重复复制大型源码。
- **独立级别**：这是独立**源码目录、模块入口与职责**，不是创建 19 个 GitHub 仓库，也不是 19 个可单独安装的 npm 包。

## 开发规则

1. 先在归属的模块中修改业务逻辑，兼容转发入口不放业务代码。
2. 跨模块引用明确写入 `module.json` 的 `dependsOn`。
3. 新的跨模块复用能力放入 `modules/core`，不要重复造轮子。
4. 修改后运行 `node --test test/module-boundaries.test.js`、`npm test`、`cd codex-ui && npm run build`，桌面版需重新打包。
5. 大体积源码及 Git 子模块不随分类复制；许可证、固定版本仍保留。

⚠ 此次变更已做静态模块解析与语法检查，尚未在目标 Windows 电脑上完成整套运行或打包验证。
