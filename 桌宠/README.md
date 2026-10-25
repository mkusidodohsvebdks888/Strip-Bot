# 桌宠项目分类

这里存放独立桌面玩偶项目，不修改 Strip Bot 现有程序的运行逻辑。

## DeepSeek Harness 桌宠

- 路径：`桌宠/DeepSeek-Harness-Pet/`
- 来源：`wraven68/deepseek-harness-pet`
- 上游： https://github.com/wraven68/deepseek-harness-pet
- 版本来源：上游 `main` 的提交 `727554719360d58c49a16d3f4a4cc736ec95b4d8`
- 许可：MIT；请保留项目内原始 `LICENSE`、作者署名和版权声明。
- 内容：Python 桌面宠物源码、五张角色状态素材、文档与安装脚本。

该项目作为**实际文件副本**存储在此目录中，而不是 Git submodule、上游仓库快捷链接或只关联原作者的 Fork。复制后不会因为原作者修改或删除上游仓库而自动改变。

> 注意：此目录仍是独立源码备份。现通过 `plugins/deepseek-harness-pet/` 提供 **StripBot 插件适配器**：在本机已安装可信的 Windows EXE 后，可从左侧插件中心确认并启动桌宠。插件不会自动安装、下载或把原始源码复制一份，也不代表桌宠现已使用 StripBot 的聊天 API。桌宠仍需 DeepSeek Harness 的本地会话日志才能显示任务进度。

## 当前默认：DeepSeek Q版鲸鱼娘

- 插件入口仍为 `plugins/deepseek-harness-pet/`，保留原标识及已有启用设置。
- 新源码：`桌宠/DeepSeek-Q版-dsh-pet/`，固定子模块版本 `dfc03961bdb4d26898838cb72c9c2ac09699b1e2`，来自 `PC2005-cloud/dsh-pet`。
- 使用独立模式运行，不依赖 DeepSeek Harness 主程序；需先构建并安装 Node.js、pnpm 依赖。
- 原 `桌宠/DeepSeek-Harness-Pet/` 继续作为回滚备份，不再作为默认插件调用源。
- dsh-pet 代码采用 MIT；角色与动画素材另有限制（包括禁止商业使用），二次传播应遵守项目说明。
