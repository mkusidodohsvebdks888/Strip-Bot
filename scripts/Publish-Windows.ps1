param(
  [ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
  [string]$Notes='Strip Bot 功能与稳定性更新。',
  [switch]$SkipBuild
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$desktopRoot=Join-Path $projectRoot 'desktop-app'
$repo='mkusidodohsvebdks888/Strip-Bot-Releases'
$metadata=Get-Content (Join-Path $desktopRoot 'package.json') -Raw | ConvertFrom-Json
if(-not $Version){$Version=$metadata.version}
if($SkipBuild -and $Version -ne $metadata.version){throw 'Version does not match built package.'}
$requestOptions=@{}
if($IsWindows -or $env:OS -eq 'Windows_NT'){
  $proxy=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
  if($proxy.ProxyEnable -eq 1 -and $proxy.ProxyServer -match '^127\.0\.0\.1:\d+$'){$requestOptions.Proxy='http://'+$proxy.ProxyServer}
}
# Credentials remain in this process only. They are never embedded in the client or update metadata.
$token=$env:GH_TOKEN
if(-not $token){
  $lines="protocol=https`nhost=github.com`n`n" | git credential fill
  if($LASTEXITCODE -ne 0){throw 'GitHub login is required on the publisher computer.'}
  foreach($line in $lines){if($line.StartsWith('password=')){$token=$line.Substring(9)}}
}
if(-not $token){throw 'No GitHub publishing credential available.'}
$headers=@{Authorization='Bearer '+$token;Accept='application/vnd.github+json';'X-GitHub-Api-Version'='2022-11-28'}
$api='https://api.github.com/repos/'+$repo
$release=$null
try{$release=Invoke-RestMethod ($api+'/releases/tags/v'+$Version) -Headers $headers @requestOptions}catch{if([int]$_.Exception.Response.StatusCode -ne 404){throw}}
if($release -and -not $release.draft){throw "v$Version is already published. Increase the version instead of replacing an installed update."}
if(-not $SkipBuild){
  Push-Location $desktopRoot
  try{
    if($Version -ne $metadata.version){npm.cmd version $Version --no-git-tag-version;if($LASTEXITCODE -ne 0){throw 'Version update failed.'}}
    & (Join-Path $PSScriptRoot 'BuildUI.ps1')
    node build.cjs releases/update-ready;if($LASTEXITCODE -ne 0){throw 'Desktop build failed.'}
    node installer.cjs;if($LASTEXITCODE -ne 0){throw 'Installer build failed.'}
  }finally{Pop-Location}
}
$artifacts=Join-Path $desktopRoot 'releases/installers'
$names=@("Strip-Bot-Setup-$Version-x64.exe","Strip-Bot-Setup-$Version-x64.exe.blockmap",'latest.yml')
foreach($name in $names){if(-not(Test-Path -LiteralPath (Join-Path $artifacts $name))){throw "Missing artifact: $name"}}
$manifest=Get-Content (Join-Path $artifacts 'latest.yml') -Raw
if($manifest -notmatch ('(?m)^version:\s*'+[regex]::Escape($Version)+'\s*$')){throw 'Update metadata version mismatch.'}
$sums=@(foreach($name in $names){$hash=(Get-FileHash -LiteralPath (Join-Path $artifacts $name) -Algorithm SHA256).Hash.ToLower();$hash+'  '+$name})
[IO.File]::WriteAllLines((Join-Path $artifacts 'SHA256SUMS.txt'),$sums,[Text.UTF8Encoding]::new($false))
$names+='SHA256SUMS.txt'
$notesBody=$Notes+"`n`nWindows x64。首次使用请下载并安装 Setup.exe；已安装自动更新版的用户会收到更新提示。`n`n桌宠基于 PC2005-cloud/dsh-pet（https://github.com/PC2005-cloud/dsh-pet），请遵守随包许可和角色素材非商业、署名与相同方式共享要求。"
if(-not $release){
  $body=@{tag_name='v'+$Version;name='Strip Bot '+$Version;body=$notesBody;draft=$true;prerelease=$false}|ConvertTo-Json
  $release=Invoke-RestMethod ($api+'/releases') -Headers $headers @requestOptions -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
}
foreach($name in $names){
  $existing=$release.assets | Where-Object name -eq $name
  if($existing){throw "Draft asset already exists: $name. Remove it from the draft before retrying."}
  $url='https://uploads.github.com/repos/'+$repo+'/releases/'+$release.id+'/assets?name='+[uri]::EscapeDataString($name)
  Invoke-RestMethod $url -Headers $headers @requestOptions -Method Post -ContentType 'application/octet-stream' -InFile (Join-Path $artifacts $name) | Out-Null
  Write-Host "Uploaded: $name"
}
$result=Invoke-RestMethod ($api+'/releases/'+$release.id) -Headers $headers @requestOptions -Method Patch -ContentType 'application/json' -Body '{"draft":false}'
Write-Host ('Published: '+$result.html_url)
$token=$null;$headers=$null
