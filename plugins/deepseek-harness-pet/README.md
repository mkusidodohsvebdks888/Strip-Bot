# DeepSeek Q版桌宠（dsh-pet）替换适配器

此插件已从原来的 `DeepSeekHarnessPet.exe` 启动适配器，改成 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的 **Q版蓝发鲸鱼娘**（独立运行模式）。

- 为保持 StripBot 的插件状态和 API 兼容，**插件 id、存储目录仍为 `deepseek-harness-pet`**。
- 原来的桌宠源文件保留在 `桌宠/DeepSeek-Harness-Pet/` 作为回滚备份，不再是默认运行来源。
- 新源码固定在 `桌宠/DeepSeek-Q版-dsh-pet/`，Git 子模块指向提交 `dfc03961bdb4d26898838cb72c9c2ac09699b1e2`。
- 新插件通过已构建的 `dsh-pet/dsh-pet/lib/standalone.js` 启动桌宠，不要求安装 DeepSeek Harness 本体。
- 独立模式提供透明动画、拖拽、移动、多开和右键菜单；**不自动获得 StripBot/DSH 的 Agent 事件、余额和模型消息**。后续要实时显示任务状态，需要单独开发会话桥。
- 需要 Node.js >= 22.12 和构建依赖。首次桌面运行可能会由上游项目按自身机制下载 Electron Helper，建议审核源码并在可信环境执行。

## 一次性安装构建（Windows）

从 StripBot 仓库根目录执行：

~~~powershell
powershell -ExecutionPolicy Bypass -File scripts/pets/Build-DeepSeek-Q-Pet.ps1
~~~

脚本会初始化固定提交的子模块，并在其 `dsh-pet/` 下安装依赖、运行上游构建。完成后在 StripBot **插件中心 → DeepSeek Q版桌宠 → 启用 → 启动桌宠**。

如果是已安装的 Windows EXE（无法从工作目录看到 `桌宠/` 子模块），请在启动 StripBot 之前设置环境变量：

~~~powershell
$env:DSH_PET_STANDALONE_PATH="D:\Strip-Bot\桌宠\DeepSeek-Q版-dsh-pet\dsh-pet\lib\standalone.js"
~~~

可选 `DSH_PET_NODE_BIN` 指向本机 Node.js 可执行程序。

**启用/关闭插件**分别保存或清除允许使用该插件的配置；停用时会请求停止由 StripBot 启动的进程。**启动、停止本身仍要求在插件中心再次确认**。

## 授权和素材

- 上游代码许可证：MIT；保留项目中的 `LICENSE`。
- **上游 README 明示角色、动画等素材非商业用途限制以及公开二创署名要求。** 如果需要商业发布 StripBot，应先获得相应动画、形象和字体的授权，或替换为自行创作的合法资源。MIT 代码许可不能自动覆盖第三方素材。
- 此处为 **固定 Git 子模块引用，不是完整、独立的源码复制**：上游之后的更新不会自动更改固定版本；若上游删除且本机无缓存，则可能无法重新初始化。旧桌宠源码备份仍独立存在。
- 运行在本机的独立桌宠 HTTP 服务必须保持回环地址绑定，不要暴露到公网；首次运行前检查上游安全模型及自动下载行为。

## 验证

`node --test test/bundled-plugins.test.js test/deepseek-q-pet.test.js`

当前只完成 GitHub 侧代码更换，未在 Windows 上运行安装构建、透明动画或 Electron 实际窗口测试。
