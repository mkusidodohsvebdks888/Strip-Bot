$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskOldExe = [IO.Path]::GetFullPath((Join-Path $taskRoot 'desktop-app\dist\Strip Bot-win32-x64\Strip Bot.exe'))
$taskNewExe = Join-Path $taskRoot 'desktop-app\releases\architecture-20261014\Strip Bot-win32-x64\Strip Bot.exe'
if (-not (Test-Path -LiteralPath $taskNewExe)) { throw 'Verified release is missing.' }
$taskOldProcesses = @(Get-Process -Name 'Strip Bot' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and [IO.Path]::GetFullPath($_.Path) -eq $taskOldExe })
foreach ($taskOldProcess in $taskOldProcesses) { Stop-Process -Id $taskOldProcess.Id -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 750
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'ApplyArchitectureDesktop.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Architecture deployment failed.' }
Start-Process -FilePath $taskNewExe -WorkingDirectory (Split-Path $taskNewExe) -WindowStyle Hidden
Write-Host 'Verified Strip Bot architecture release started.'
