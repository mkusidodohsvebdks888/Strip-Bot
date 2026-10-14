$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskExe = Join-Path $taskRoot 'desktop-app\releases\agent-20261014\Strip Bot-win32-x64\Strip Bot.exe'
if (-not (Test-Path -LiteralPath $taskExe)) { throw 'Agent desktop release is missing.' }
$taskDesktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Strip Bot.lnk'
if (Test-Path -LiteralPath $taskDesktopLink) { Copy-Item -LiteralPath $taskDesktopLink -Destination (Join-Path $taskRoot '.runtime\Strip Bot-before-agent.lnk') -Force }
$taskKnownExecutables = @(
    (Join-Path $taskRoot 'desktop-app\releases\architecture-20261014\Strip Bot-win32-x64\Strip Bot.exe'),
    (Join-Path $taskRoot 'desktop-app\dist\Strip Bot-win32-x64\Strip Bot.exe')
)
Get-Process -Name 'Strip Bot' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $taskKnownExecutables -contains $_.Path } | Stop-Process
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskRoot 'launch.ps1') -Mode stop
if ($LASTEXITCODE -ne 0) { throw 'Could not stop launcher-owned gateway.' }
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskRoot 'launch.ps1') -Mode start -NoBrowser
if ($LASTEXITCODE -ne 0) { throw 'Could not start Agent gateway.' }
$taskHealth = Invoke-RestMethod 'http://127.0.0.1:3060/api/health'
if ($taskHealth.capabilities.agent -ne 'opencode-v2') { throw 'Agent gateway capability check failed.' }
$taskShell = New-Object -ComObject WScript.Shell
$taskShortcut = $taskShell.CreateShortcut($taskDesktopLink)
$taskShortcut.TargetPath = $taskExe
$taskShortcut.Arguments = ''
$taskShortcut.WorkingDirectory = Split-Path $taskExe
$taskShortcut.IconLocation = (Join-Path $taskRoot 'public\strip-bot.ico') + ',0'
$taskShortcut.Save()
Start-Process -FilePath $taskExe -WorkingDirectory (Split-Path $taskExe) -WindowStyle Normal
Write-Host 'Strip Bot Agent desktop deployed and opened.'
