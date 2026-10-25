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
