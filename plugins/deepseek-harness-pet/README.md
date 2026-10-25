# DeepSeek Harness Pet 插件适配器

这是 StripBot 的本地插件接口，原始桌宠源码位于 `../../桌宠/DeepSeek-Harness-Pet/`，未被复制到插件目录。

在 Windows 上读取本机安装目录 `%LOCALAPPDATA%/DeepSeekHarnessPet/DeepSeekHarnessPet.exe`；也可以设置环境变量 `DEEPSEEK_HARNESS_PET_BIN` 为可信 EXE 的绝对路径。

启用插件只改变本地配置，**不会下载或执行任何程序**；选择「启动桌宠」并二次确认后，才会调用本机 EXE。

原始项目自带安装脚本，但本插件不运行安装器、不下载 Release，不修改桌宠的代码、依赖和许可。退出时请使用桌宠自身菜单。
