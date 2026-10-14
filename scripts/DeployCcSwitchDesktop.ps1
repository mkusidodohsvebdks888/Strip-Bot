$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskExe = Join-Path $taskRoot 'desktop-app\releases\ccswitch-20261014\Strip Bot-win32-x64\Strip Bot.exe'
if (-not (Test-Path -LiteralPath $taskExe)) { throw 'CC Switch desktop release is missing.' }
$taskDesktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Strip Bot.lnk'
if (Test-Path -LiteralPath $taskDesktopLink) { Copy-Item -LiteralPath $taskDesktopLink -Destination (Join-Path $taskRoot '.runtime\Strip Bot-before-ccswitch.lnk') -Force }
$taskKnownExecutable = Join-Path $taskRoot 'desktop-app\releases\agent-20261014\Strip Bot-win32-x64\Strip Bot.exe'
Get-Process -Name 'Strip Bot' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $taskKnownExecutable } | Stop-Process
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskRoot 'launch.ps1') -Mode stop
if ($LASTEXITCODE -ne 0) { throw 'Could not stop launcher gateway.' }
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskRoot 'launch.ps1') -Mode start -NoBrowser
if ($LASTEXITCODE -ne 0) { throw 'Could not start updated gateway.' }
$taskHealth = Invoke-RestMethod 'http://127.0.0.1:3060/api/health'
if (-not $taskHealth.capabilities.ccswitch) { throw 'CC Switch capability check failed.' }
$taskShell = New-Object -ComObject WScript.Shell
$taskShortcut = $taskShell.CreateShortcut($taskDesktopLink)
$taskShortcut.TargetPath = $taskExe
$taskShortcut.Arguments = ''
$taskShortcut.WorkingDirectory = Split-Path $taskExe
$taskShortcut.IconLocation = (Join-Path $taskRoot 'public\strip-bot.ico') + ',0'
$taskShortcut.Save()
Start-Process -FilePath $taskExe -WorkingDirectory (Split-Path $taskExe) -WindowStyle Normal
Write-Host 'Strip Bot CC Switch desktop deployed and opened.'
