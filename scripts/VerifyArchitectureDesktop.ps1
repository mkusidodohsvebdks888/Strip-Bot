$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskExe = Join-Path $taskRoot 'desktop-app\releases\architecture-20261014\Strip Bot-win32-x64\Strip Bot.exe'
$taskEvidence = Join-Path $taskRoot '.runtime\architecture-desktop.png'
$env:STRIPBOT_VERIFY_FILE = $taskEvidence
$env:STRIPBOT_VERIFY_PROFILE = Join-Path $taskRoot '.runtime\architecture-acceptance-profile'
$env:STRIPBOT_PORT = '3061'
$taskProcess = $null
try {
    $taskProcess = Start-Process -FilePath $taskExe -WorkingDirectory (Split-Path $taskExe) -WindowStyle Hidden -PassThru
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        if (Test-Path -LiteralPath ($taskEvidence + '.json')) { break }
        if ($taskProcess.HasExited) { throw 'Desktop exited before loading its window.' }
    }
    if (-not (Test-Path -LiteralPath ($taskEvidence + '.json'))) { throw 'Desktop startup verification timed out.' }
    Get-Content -LiteralPath ($taskEvidence + '.json')
    Start-Sleep -Seconds 3
    if ($taskProcess.HasExited) { throw 'Desktop exited unexpectedly after window load.' }
    Write-Host 'Desktop window remained running after load.'
} finally {
    if ($taskProcess -and -not $taskProcess.HasExited) { Stop-Process -Id $taskProcess.Id }
    Remove-Item Env:\STRIPBOT_VERIFY_FILE,Env:\STRIPBOT_VERIFY_PROFILE,Env:\STRIPBOT_PORT -ErrorAction SilentlyContinue
}
