# 五种滑杆外观接入

当前版本在原有五档推理与响应预设上增加外观，未采用附件中不同版本的模型选择器逻辑。

输入框闪电按钮 → 滑杆外观，可选择五档圆点（默认）、极简细线、柔和胶囊、分段选择、渐变流体。选择通过 strip_slider_style_v1 保存在当前客户端本地存储中。存储不可用时仍可在当前页面切换。

新增组件位于 codex-ui/src/components/ModelSwitcher/：FiveStepSlider.tsx、SliderStylePicker.tsx、slider-styles.css、slider-styles.mjs 和类型声明。ModelSwitcher.tsx 接入外观与跨窗口偏好同步。原有 response-mode.mjs、模型目录校验和失败回滚不变。

滑动时预览，松手或方向键释放时提交；取消拖动恢复当前档位；关闭浮层不会因失焦提交。外观改变不会请求模型或改变权限。

构建：powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\BuildUI.ps1
测试：npm.cmd test

回滚：用 exports/before-slider-styles-20261019-160118/ModelSwitcher.tsx 恢复原组件，再重新构建。旧桌面发布目录保留。

验证范围：自动化测试与正式构建；未进行真实模型调用及桌面视觉验收。
