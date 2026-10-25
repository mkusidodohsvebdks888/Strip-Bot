$ErrorActionPreference='Stop'
if(-not(Get-Command docker -ErrorAction SilentlyContinue)){throw 'Docker CLI not found.'}
docker stop stripbot-openui
if($LASTEXITCODE -ne 0){throw 'OpenUI is not currently running.'}
docker rm stripbot-openui
