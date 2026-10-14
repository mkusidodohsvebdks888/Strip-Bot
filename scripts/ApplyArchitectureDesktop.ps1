$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskExe = Join-Path $taskRoot 'desktop-app\releases\architecture-20261014\Strip Bot-win32-x64\Strip Bot.exe'
if (-not (Test-Path -LiteralPath $taskExe)) { throw 'Build the architecture release first.' }
$taskDesktop = [Environment]::GetFolderPath('Desktop')
$taskLink = Join-Path $taskDesktop 'Strip Bot.lnk'
if (Test-Path -LiteralPath $taskLink) {
    Copy-Item -LiteralPath $taskLink -Destination (Join-Path $taskRoot '.runtime\Strip Bot-before-architecture.lnk') -Force
}
# The existing launcher verifies PID and start time before stopping its own Node
# process. It does not stop the active desktop window or unrelated services.
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskRoot 'launch.ps1') -Mode stop
if ($LASTEXITCODE -ne 0) { throw 'Could not stop the launcher-owned service.' }
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskRoot 'launch.ps1') -Mode start -NoBrowser
if ($LASTEXITCODE -ne 0) { throw 'Could not restart the gateway.' }
$taskHealth = Invoke-RestMethod 'http://127.0.0.1:3060/api/health'
if ($taskHealth.service -ne 'stripbot-gateway') { throw 'An old or unrelated service is still listening on 3060.' }
$taskShell = New-Object -ComObject WScript.Shell
$taskShortcut = $taskShell.CreateShortcut($taskLink)
$taskShortcut.TargetPath = $taskExe
$taskShortcut.Arguments = ''
$taskShortcut.WorkingDirectory = Split-Path $taskExe
$taskShortcut.IconLocation = (Join-Path $taskRoot 'public\strip-bot.ico') + ',0'
$taskShortcut.Description = 'Strip Bot desktop application'
$taskShortcut.Save()
Write-Host 'Strip Bot desktop shortcut updated. Close and reopen the active app to load the new main process.'
Write-Host 'Gateway verified: stripbot-gateway on 3060.'
