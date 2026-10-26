# Strip Bot Windows 更新发布

源码保留在私有 Strip-Bot 仓库，公开安装包和更新元数据发布到：
https://github.com/mkusidodohsvebdks888/Strip-Bot-Releases/releases

## 用户使用

首次需要安装 `Strip-Bot-Setup-版本-x64.exe`。过去收到的文件夹便携版需要手动安装这一次，之后支持在线更新。设置 → 软件更新可检查、下载、重启安装。客户端启动 30 秒后检查一次，之后每 6 小时检查；不会自动下载，也不会在退出时偷偷安装。

安装和更新使用稳定的应用 ID 与用户数据目录；不把聊天、API 配置或用户文件放进安装包。卸载默认保留应用数据。重启前应保存未发送草稿、完成当前任务。

## 发布新版本

在可信的构建电脑安装 Node.js 24、Git、项目依赖，并构建固定版本的桌宠。构建机须有 GitHub 发布仓库写权限；客户端不需要 GitHub 凭据。

```powershell
npm.cmd ci --prefix codex-ui
npm.cmd ci --prefix desktop-app
npm.cmd ci --prefix agent-runtime
powershell -File scripts/pets/Build-DeepSeek-Q-Pet.ps1
powershell -File scripts/Publish-Windows.ps1 -Version 1.0.3 -Notes "本次更新说明"
```

发布脚本读取本机 Git 凭据管理器（或仅本次进程的 GH_TOKEN），生成 NSIS 安装器、blockmap、latest.yml 和 SHA256SUMS.txt，先上传到草稿 Release，所有文件成功后才公开。公开过的版本禁止覆盖，请递增版本。发布源码变更时，另外提交并推送私有源码和实验仓库引用。

首次构建失败时先看错误，不要公开不完整的草稿。发行产物在 `desktop-app/releases/installers/`，该目录不进入源码仓库。公开发布仓库不存私有源码、个人配置或密钥。

7-Zip 和 LibreOffice 是独立可选依赖，用户需安装；软件内会显示是否可用。Node、Codex 和桌宠运行资源包含在安装包。桌宠许可证、原始 README 与 Node/其他第三方许可证随包保留。当前安装包没有 Windows 代码签名证书，Windows 可能显示未知发布者；如需可信发布者名称，应配置自己的代码签名证书。

本次采用 electron-builder 26.x / electron-updater 6.x 和公开 GitHub Releases，不运行常驻更新服务器。
