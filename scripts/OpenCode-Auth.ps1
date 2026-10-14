# Authenticate the *private* OpenCode profile used by Strip Bot (Windows).
# Nothing in ~/.codex or your regular ~/.local/share/opencode is modified.
param(
  [ValidateSet('login', 'status', 'models')]
  [string]$Action = 'login',
  [ValidateSet('chatgpt-token-sharing','chatgpt-browser','chatgpt-headless')]
  [string]$LoginMethod = 'chatgpt-browser'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$binary = Join-Path $root 'agent-runtime\node_modules\@opencode\cli\bin\opencode.exe'
if (-not (Test-Path -LiteralPath $binary)) {
  throw "Strip Bot OpenCode runtime was not found. Run: cd `"$root\agent-runtime`"; npm.cmd ci"
}
$private = Join-Path $root '.runtime\opencode'
foreach ($segment in @('data','cache','config','state','config\opencode')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $private $segment) | Out-Null
}
$env:XDG_DATA_HOME = Join-Path $private 'data'
$env:XDG_CACHE_HOME = Join-Path $private 'cache'
$env:XDG_CONFIG_HOME = Join-Path $private 'config'
$env:XDG_STATE_HOME = Join-Path $private 'state'
$env:OPENCODE_CONFIG_DIR = Join-Path $private 'config\opencode'
$env:OPENCODE_CONFIG_PROJECT_DISABLE = '1'
$proxyFile = Join-Path $private 'proxy.json'
if (Test-Path -LiteralPath $proxyFile) {
  $proxy = Get-Content -LiteralPath $proxyFile -Raw | ConvertFrom-Json
  $proxyUri = [uri]$proxy.endpoint
  if ($proxyUri.Scheme -notin @('http','https') -or -not $proxyUri.IsLoopback -or $proxyUri.UserInfo -or $proxyUri.AbsolutePath -ne '/' -or $proxyUri.Query -or $proxyUri.Fragment) { throw 'OpenCode proxy must be a plain loopback HTTP endpoint.' }
  $env:HTTP_PROXY = $proxyUri.GetLeftPart([UriPartial]::Authority)
  $env:HTTPS_PROXY = $env:HTTP_PROXY
  $env:NO_PROXY = 'localhost,127.0.0.1,::1,[::1]'
  Write-Host "OpenCode local proxy: $env:HTTP_PROXY (loopback bypassed)"
}
Remove-Item Env:OPENCODE_DISABLE_MODELS_FETCH -ErrorAction SilentlyContinue
# Ensure ChatGPT OAuth remains the credential source instead of an inherited API key.
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:OPENAI_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:OPENCODE_DB -ErrorAction SilentlyContinue
Remove-Item Env:OPENCODE_CONFIG -ErrorAction SilentlyContinue
Remove-Item Env:STRIPBOT_AGENT_API_KEY -ErrorAction SilentlyContinue
Push-Location $root
try {
  Write-Host "Strip Bot private OpenCode profile: $private"
  switch ($Action) {
    'login' {
      Write-Host "Starting OpenCode OpenAI OAuth: $LoginMethod"
      & $binary auth login openai --standalone --method $LoginMethod
    }
    'status' { & $binary auth list }
    'models' { & $binary models --standalone }
  }
  if ($LASTEXITCODE -ne 0) { throw "OpenCode command exited with $LASTEXITCODE" }
} finally {
  Pop-Location
}
