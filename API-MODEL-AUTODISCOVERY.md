# Strip Bot：API 模型自动发现与推理档位（2026-10-17）

## 已实现

- 在首次 API 接入页面填写 **API Key**，失焦后自动从所填 Base URL 的 `GET /models` 接口尝试读取模型列表；也可点击「刷新模型列表」。优先选择实时返回的模型。保留「连接配置 → 模型 ID」手动输入作为不支持 `/models` 接口时的回退。
- 在 **设置 → 模型设置 → API 连接** 中点击「从 API 获取模型」，即使修改了还未保存的密钥也可以先查询模型。下拉框显示实时模型 ID、已保存的历史 ID 和当前 ID，且不会把历史 ID 伪装成实时验证通过。
- 聊天输入框旁的 **模型切换器** 会从当前 API `/models` 查询可用模型（服务器内存缓存 60 秒）；切换模型前校验连接，新的对话采用新模型。列表支持搜索，`-fast` 等具有独立 ID 的模型不会被合并。
- 在 **设置 → API 连接** 中手动开启「允许发送兼容推理强度参数」后，输入框旁的推理档位滑条支持轻度 / 中 / 高 / 极高 / Ultra，以及「恢复自动推理强度」。Responses 协议发送 `reasoning.effort`；Chat Completions 协议发送 `reasoning_effort`。选择不同档位后会保存新配置、更新配置版本并新建对话。
- 独立保留原有 **文字显示速度** 滑条。它只改变 UI 显示的 tok/s，不影响服务商的真实生成速率。推理强度也不是直接提升 tok/s 的功能，它可能影响耗时、质量与费用；对不支持该参数的服务，关闭开关即可。

## 重要限制

- `/models` 返回可见 ID，不代表该 API Key 一定具备具体模型的使用权限；「检测真实请求」才会发送真实测试请求（可能产生少量费用）。
- 不是所有兼容 API 都提供 `GET /models`，或支持 `reasoning.effort`、`reasoning_effort`。未返回模型时，继续用手动模型 ID。参数不兼容时，关闭推理强度开关或恢复自动模式。
- Key 仅通过本机的 POST 请求送达后端，再由后端发送给上游；不放在 URL、前端 localStorage 或模型目录响应中。保存时沿用既有 Windows DPAPI 加密。已保存的 Key 仅可在 **相同 API Base URL** 查询时使用，不会因用户编辑地址自动转发到新的服务器。
- 用户切换模型或推理档位后，已有会话仍绑定先前模型/配置并保持记录，新会话才使用新配置。
- 该源码包内 `public/` 包含上一次打包时的前端静态资源。由于交付环境无法获取 npm 依赖，**务必先执行构建**，不要只运行 `start-windows.bat` 并误认为旧页面就是修改后的版本。

## Windows 安装并启动（建议）

在解压后的 `Strip-Bot` 目录内双击 **`rebuild-and-start.bat`**。需要已经安装 Node.js 18+（建议 Node 22）和 npm，并能访问 npm 依赖下载源。它会依次：

1. `npm.cmd ci --prefix .\codex-ui`
2. `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\BuildUI.ps1`
3. `npm.cmd ci --prefix .\agent-runtime`
4. `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\launch.ps1 -Mode start`

已构建并安装依赖时，可以运行 `start-windows.bat`，在浏览器中访问 `http://127.0.0.1:3060`。要构建 Windows Electron 安装程序还需要 `npm.cmd ci --prefix .\desktop-app`，随后执行 `node .\desktop-app\build.cjs`。

## 修改文件说明

| 文件 | 修改重点 |
|---|---|
| `backend/api-connection.cjs` | `models()` 后端获取真实模型列表、限制响应体积、缓存、Key 隔离、`setEffort()` 更新配置、代理转发推理强度字段 |
| `backend/gateway.cjs` | 添加 `POST /api/connection/models` 和 `POST /api/connection/effort` |
| `codex-ui/src/components/api-models.ts` | 前端 API 模型查询入口 |
| `codex-ui/src/components/ApiEntry.tsx`、`api-entry.css` | 初次录入密钥后获取可选模型 |
| `codex-ui/src/components/ConnectionSettings.tsx`、`connection-settings.css` | 设置页模型目录和推理强度开关 |
| `codex-ui/src/components/ModelSwitcher/model-catalog.ts` | 从实时 API 模型列表构建聊天区模型目录 |
| `codex-ui/src/components/ModelSwitcher/ModelSwitcher.tsx`、`model-switcher.css` | 模型全文搜索、独立 ID 切换、真实推理档位设置 |
| `codex-ui/src/state/useConnection.ts`、`codex-ui/src/App.tsx` | 与后端推理档位状态同步，切换后刷新并建立新对话 |
| `test/api-model-discovery.test.js` | 模拟 API 模型获取、密钥隔离、参数透传和配置版本测试 |
| `rebuild-and-start.bat` | Windows 重新安装依赖、编译 UI、启动服务 |

## 自检与调试

```powershell
node --test .\test\api-model-discovery.test.js .\test\api-connection.test.js
npm.cmd test
```

在有完整前端依赖的机器上执行：

```powershell
npm.cmd run build --prefix .\codex-ui
```

本次在隔离环境中，和新增功能相关的 13 个测试通过、排除两个无法在当前无前端依赖环境中运行的现有用例后 59 个测试通过；前端 TypeScript 源码通过语法级编译检测。**无法在此环境中完成 Vite 正式产物构建、Electron 封装或真实供应商 API 端到端测试**。`public/` 中的旧构建仅用于存档，非本次最新 UI。
