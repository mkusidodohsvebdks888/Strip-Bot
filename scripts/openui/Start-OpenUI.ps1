param([switch]$BuildOnly)
$ErrorActionPreference = 'Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Source=Join-Path $Root 'external\OpenUI'
if(-not(Test-Path (Join-Path $Source 'backend\Dockerfile'))){
  git -C $Root submodule update --init -- external/OpenUI
  if($LASTEXITCODE -ne 0){throw 'Could not initialize pinned OpenUI submodule.'}
}
if(-not(Get-Command docker -ErrorAction SilentlyContinue)){throw 'Install Docker Desktop before starting OpenUI.'}
$Tag='stripbot-openui:42d7ab4'
docker build -t $Tag -f (Join-Path $Source 'backend\Dockerfile') (Join-Path $Source 'backend')
if($LASTEXITCODE -ne 0){throw 'OpenUI Docker build failed.'}
if($BuildOnly){exit 0}
$Running=docker ps -q --filter 'name=^/stripbot-openui$'
if($Running){Write-Host 'Already running at http://127.0.0.1:7878';exit 0}
$Existing=docker ps -aq --filter 'name=^/stripbot-openui
$Args=@('run','-d','--name','stripbot-openui','--publish','127.0.0.1:7878:7878','--volume','stripbot-openui-data:/root/.openui')
if($env:OPENAI_API_KEY){$Args+=@('-e','OPENAI_API_KEY')}
if($env:OPENAI_COMPATIBLE_ENDPOINT){$Args+=@('-e','OPENAI_COMPATIBLE_ENDPOINT')}
if($env:OPENAI_COMPATIBLE_API_KEY){$Args+=@('-e','OPENAI_COMPATIBLE_API_KEY')}
$Args+=@('-e','OLLAMA_HOST=http://host.docker.internal:11434')
$Args+=$Tag
docker @Args
if($LASTEXITCODE -ne 0){throw 'OpenUI Docker startup failed.'}
Write-Host 'OpenUI: http://127.0.0.1:7878'

if($Existing){
  docker rm -f stripbot-openui | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Unable to remove the stopped OpenUI container.'}
}
$Args=@('run','-d','--name','stripbot-openui','--publish','127.0.0.1:7878:7878','--volume','stripbot-openui-data:/root/.openui')
if($env:OPENAI_API_KEY){$Args+=@('-e','OPENAI_API_KEY')}
if($env:OPENAI_COMPATIBLE_ENDPOINT){$Args+=@('-e','OPENAI_COMPATIBLE_ENDPOINT')}
if($env:OPENAI_COMPATIBLE_API_KEY){$Args+=@('-e','OPENAI_COMPATIBLE_API_KEY')}
$Args+=@('-e','OLLAMA_HOST=http://host.docker.internal:11434')
$Args+=$Tag
docker @Args
if($LASTEXITCODE -ne 0){throw 'OpenUI Docker startup failed.'}
Write-Host 'OpenUI: http://127.0.0.1:7878'
