param([switch]$OnlyCheck)
$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Source=Join-Path $Root '桌宠\DeepSeek-Q版-dsh-pet'
$Package=Join-Path $Source 'dsh-pet'
$Entry=Join-Path $Package 'lib\standalone.js'
if(-not(Test-Path $Package)){
  git -C $Root submodule update --init -- '桌宠/DeepSeek-Q版-dsh-pet'
  if($LASTEXITCODE -ne 0){throw 'Failed to initialize pinned dsh-pet source.'}
}
if(-not(Test-Path (Join-Path $Package 'package.json'))){throw 'dsh-pet package.json missing; check submodule.'}
node -v
if($LASTEXITCODE -ne 0){throw 'Node.js >= 22.12 is required.'}
if($OnlyCheck){
  if(Test-Path $Entry){Write-Host "Built entry: $Entry"}else{Write-Host 'Not built; run without -OnlyCheck.'}
  exit 0
}
if(-not(Get-Command pnpm -ErrorAction SilentlyContinue)){throw 'Install pnpm (or enable corepack) before building.'}
Push-Location $Package
try{
  pnpm install --frozen-lockfile
  if($LASTEXITCODE -ne 0){throw 'pnpm install failed.'}
  pnpm run build
  if($LASTEXITCODE -ne 0){throw 'dsh-pet build failed.'}
}finally{Pop-Location}
if(-not(Test-Path $Entry)){throw 'dsh-pet standalone.js was not generated.'}
Write-Host 'Q pet built. Restart StripBot, enable Q pet plugin, and choose Launch.'
Write-Host "Built entry: $Entry"
