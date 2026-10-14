param([ValidateSet('start','demo','stop')][string]$Mode = 'start', [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$runtimeDir = Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$uiPort = if ($env:PORT) { [int]$env:PORT } else { 3060 }
$demoPort = if ($env:DEMO_PORT) { [int]$env:DEMO_PORT } else { 8000 }
function Get-OwnedProcess([string]$Name, [string]$Script) {
    $pidFile = Join-Path $runtimeDir "$Name.pid"
    if (-not (Test-Path -LiteralPath $pidFile)) { return $null }
    $saved = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $candidate = Get-Process -Id $saved.id -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.ProcessName -eq 'node' -and $candidate.StartTime.ToUniversalTime().Ticks.ToString() -eq $saved.started) { return $candidate }
    return $null
}
if ($Mode -eq 'stop') {
    foreach ($entry in @(@('ui','server.js'), @('demo','test\demo-local-api.js'))) {
        $owned = Get-OwnedProcess $entry[0] $entry[1]
        if ($owned) { Stop-Process -Id $owned.Id }
        Remove-Item -LiteralPath (Join-Path $runtimeDir "$($entry[0]).pid") -Force -ErrorAction SilentlyContinue
    }
    Write-Host 'Page07 stopped.'
    exit 0
}
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
function Start-ServiceProcess([string]$Name, [string]$Script, [int]$Port) {
    if (Get-OwnedProcess $Name $Script) { return }
    $probe = [System.Net.Sockets.TcpClient]::new()
    try {
        $probe.Connect('127.0.0.1', $Port)
        throw "Port $Port is already in use. Stop its service or change the port."
    } catch [System.Net.Sockets.SocketException] {
        # No listener; port is available.
    } finally { $probe.Dispose() }
    $scriptPath = Join-Path $PSScriptRoot $Script
    $started = Start-Process -FilePath $nodePath -ArgumentList ('"' + $scriptPath + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir "$Name.log") -RedirectStandardError (Join-Path $runtimeDir "$Name-error.log")
    @{ id = $started.Id; started = $started.StartTime.ToUniversalTime().Ticks.ToString() } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeDir "$Name.pid")
}
if ($Mode -eq 'demo') { Start-ServiceProcess 'demo' 'test\demo-local-api.js' $demoPort }
Start-ServiceProcess 'ui' 'server.js' $uiPort
$url = "http://127.0.0.1:$uiPort"
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod "$url/api/health" -TimeoutSec 1
        if ($health.ok) { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 200 }
}
if (-not $ready) { throw "Startup failed. See $runtimeDir\ui-error.log" }
Write-Host "Page07 ready: $url"
if (-not $NoBrowser) { Start-Process $url }
