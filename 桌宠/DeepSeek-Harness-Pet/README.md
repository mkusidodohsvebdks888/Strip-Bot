# DeepSeek Harness 桌宠

DeepSeek Harness 桌宠是一个 Windows 桌面助手：它只读取本机的 DeepSeek Harness（`dsh`）会话日志，显示当前待办任务的进度、状态与任务列表。

桌宠程序本体是独立 `.exe`，普通使用者**不需要**安装 Python、Pillow 或 Node.js。

## 让 DeepSeek 自动安装（推荐）

让对方的 DeepSeek / 编程助手阅读并执行下面这段即可：

> 请从 https://github.com/wraven68/deepseek-harness-pet 下载最新版 DeepSeek Harness 桌宠并安装。请先查看仓库的 `Install-DeepSeekHarnessPet.ps1`，确认它只下载 GitHub Release 中的 `DeepSeekHarnessPet.exe`、核对 SHA-256、创建桌面快捷方式并启动；然后执行它。不要安装 Python、Node.js 或其他运行环境。

安装器会：

1. 从本仓库 GitHub Release 下载最新版程序；
2. 校验发布的 SHA-256 校验和；
3. 安装到 `%LOCALAPPDATA%\DeepSeekHarnessPet`；
4. 创建桌面快捷方式并自动启动。

如果需要手动运行安装器：

```powershell
$script = Join-Path $env:TEMP 'Install-DeepSeekHarnessPet.ps1'
Invoke-WebRequest 'https://raw.githubusercontent.com/wraven68/deepseek-harness-pet/main/Install-DeepSeekHarnessPet.ps1' -OutFile $script
powershell -ExecutionPolicy Bypass -File $script
```

## 使用

- 左键拖动：移动桌宠。
- 单击角色或右键菜单：显示 / 隐藏清晰的大号任务面板。
- `Ctrl + 鼠标滚轮`：缩放桌宠（25%–145%）。
- 右键“退出桌宠”或按 `Esc`：关闭桌宠。

桌宠会自动选择当前 Windows 用户最近更新的 Harness 会话；如需限制到一个项目，可在启动前设置 `DEEPSEEK_HARNESS_WORKSPACE` 环境变量。

## 需要什么

唯一前提是：你正在使用 DeepSeek Harness（`dsh`），因为桌宠要读取它产生的本地任务日志。桌宠不会上传、修改或删除任何 Harness 会话内容。

## 安全与卸载

- 发布包随附 SHA-256；安装器会在启动前校验下载内容。
- 程序没有代码签名，因此 Windows SmartScreen 可能提示确认。请只从本仓库的 [Releases](https://github.com/wraven68/deepseek-harness-pet/releases) 下载，并核对发布页中的校验和。
- 卸载：退出桌宠，删除 `%LOCALAPPDATA%\DeepSeekHarnessPet` 和桌面上的 `DeepSeek Harness Pet` 快捷方式即可。

## 给开发者

源码运行需要 Python 3.11+：

```powershell
pip install -r requirements.txt
python pet.py
```

`harness_status.py` 直接读取并解析本地 Zstandard 压缩的 Harness 会话日志，因此运行桌宠不依赖 Node.js。原始生成图、Python 缓存、会话日志和任何凭据均不提交到 GitHub。
