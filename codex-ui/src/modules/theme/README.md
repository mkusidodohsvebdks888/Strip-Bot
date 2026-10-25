# StripBot 主题设置模块

主题设置与聊天、执行器、MCP、插件管理解耦，独立位于 `codex-ui/src/modules/theme/`。实际运行的主题逻辑已移动到此处，旧位置留下只转发的兼容文件。

## 模块结构

```text
theme/
├── index.ts                  # 公开 API
├── module.json                # 模块元数据
├── state/
│   ├── useAppearance.ts       # 5 套主题 + 持久化 + 桌面同步
│   ├── useAppTheme.ts         # 简化的亮色/深色兼容状态
│   └── useWallpaper.ts        # 本机壁纸存储及配置
├── components/
│   ├── ThemePicker.tsx        # 主题卡片选择器
│   ├── ThemeToggle.tsx        # 主题切换按钮
│   └── WallpaperSettings.tsx  # 壁纸上传/选择/渐变设置
└── styles/                    # 7 个主题与壁纸 CSS 文件
```

Electron 标题栏主题由 `desktop-app/runtime/theme/window-appearance.cjs` 维护，它通过原有 IPC 接口同步，不依赖 React 运行时。

## 使用

```tsx
import {useAppearance,useWallpaper,WallpaperSettings} from './modules/theme';
const {appearance,setAppearance}=useAppearance();
const wallpaper=useWallpaper();
// <WallpaperSettings theme={appearance} onThemeChange={setAppearance} wallpaper={wallpaper}/>
```

CSS 由 App.tsx 按原顺序从 `./modules/theme/styles/` 引入，避免级联优先级变化；主题控件会单独导入自己的 CSS。

## 外部背景素材与主题的区别

- `背景素材/` 是独立的开源样式和 CSS/SVG 素材库，默认不自动安装或覆盖 UI。
- 本目录是 **真正接入 StripBot 的主题设置逻辑**，现有暖白、纯白、雾蓝灰、深色、石墨灰和自定义图片行为保持不变。
- 要将新的毛玻璃主题加入选项，优先在 `state/useAppearance.ts` 的枚举与 `THEME_CHOICES` 添加，并在 `styles/theme-palettes.css` 提供对应变量，必要时同步修改 Electron 的标题栏配色。

## 兼容与验证

- 旧的 `src/state/useAppearance.ts`、`src/state/useWallpaper.ts` 等转发到主题模块；本地 storage key 不变。
- 原有 `src/styles/*.css` 主题文件保留 `@import` 兼容路径，避免打断其他页面引用。
- 回归测试：`node --test test/appearance.test.js test/wallpaper.test.js test/window-appearance.test.js test/theme-module.test.js`。
- 在 `codex-ui/` 运行 `npm run build` 并按照原脚本发布新前端资源后，新模块才会实际出现在已安装软件中。

这是单仓库的独立功能模块，不是新建 GitHub 仓库、npm 包或插件。暂未改变任何用户正在使用的主题设置。

## 全模块统一切换（2026-10）

- **主题选择是唯一入口**：`useAppearance` 更新 `html[data-strip-palette]`、根色板、本地保存值，并通过现有桥接同步 Electron 标题栏。
- **根主题色板**：`styles/unified-modules.css` 为暖白、纯白、雾蓝灰、深色、石墨灰分别定义共享语义变量；包括独立于主工作区的弹出菜单。
- **同步范围**：API 登录/连接、聊天区、左侧导航与历史、任务/执行信息、Skills、MCP、GitHub、插件管理、设置页、文件操作控件及模型选择所继承的色板。
- **跨窗口**：在其他同源 StripBot 浏览器窗口改变主题时，`storage` 事件同步可用的主题 ID；当前窗口立即应用。不会覆盖用户已上传的壁纸。
- **外部插件窗口例外**：独立的第三方桌宠或其他外部程序不受此 CSS 控制，若要同步它们必须有各自的主题接口。
- **安全与可读性**：状态警告、差异增删颜色、代码高亮和用户背景图片不被强制变色；按当前语义变量保证文本与背景可读。
- **样式顺序**：`App.tsx` 在其他 CSS 之后最后导入 `unified-modules.css`。新增 UI 模块应优先使用 `var(--card-bg)`、`var(--surface-2)`、`var(--fg)`、`var(--border-10)`，不要硬编码白色/黑色。
- **验证**：`node --test test/theme-unification.test.js test/appearance.test.js test/wallpaper.test.js test/window-appearance.test.js`；仍需要在 Windows 运行前端构建和手工测试各个模块。

## 圆角窗口与顶部标题栏

- 桌面工作台与模型登录页共用 `styles/window-frame.css`，呈现 18px 圆角矩形外框、细边框及轻柔投影；浏览器页面保留 7px 外边距，Electron 桌面则贴齐窗口顶沿以完整覆盖系统标题栏。
- Windows Electron 隐藏默认标题栏后仍保留原生最小化 / 最大化 / 关闭按钮；主题化顶部条贯穿整个页面顶部，背景覆盖原生标题栏按钮下方区域。
- CSS 顶部条与 Electron `titleBarOverlay` 使用相同的 48px 高度，右侧留出 160px 空间供原生窗口按钮使用，并保留顶部拖动窗口能力。
- 小屏（≤640px）恢复满宽、无外边距和无圆角，避免压缩可操作空间。壁纸、主题选择、工具侧栏和聊天功能不更改。
- 圆角修饰的是网页内容外框。**Windows 的系统级原生窗口外边角仍由 Windows/Electron 管理**；无需改用无边框窗口以牺牲系统按钮。
- 测试：`node --test test/window-frame.test.js`，并重新构建前端与 Windows 安装程序后检查窗口最大化、拖动、右上角按钮、窄窗和主题切换。
