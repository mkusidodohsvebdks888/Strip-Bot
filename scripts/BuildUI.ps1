$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Push-Location (Join-Path $taskRoot 'codex-ui')
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'UI build failed.' }
    # Publish assets first and the entry last. Old assets remain available for
    # already-open windows; the desktop package selects only this build's files.
    $taskPublic = Join-Path $taskRoot 'public'
    Copy-Item -LiteralPath 'dist\assets' -Destination $taskPublic -Recurse -Force
    Copy-Item -LiteralPath 'dist\brand-logo.png' -Destination $taskPublic -Force
    $taskAssets = @(Get-ChildItem -LiteralPath 'dist\assets' -File | ForEach-Object { 'assets/' + $_.Name })
    @{ assets = $taskAssets } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskPublic 'build-manifest.json') -Encoding UTF8
    Copy-Item -LiteralPath 'dist\index.html' -Destination $taskPublic -Force
} finally { Pop-Location }
Write-Host 'Strip Bot UI deployed to Page07/public. Restart only if server.js changed.'
