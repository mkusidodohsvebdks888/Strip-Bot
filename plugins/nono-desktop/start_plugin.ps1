$ErrorActionPreference='Stop'
try {
  Invoke-RestMethod 'http://127.0.0.1:3060/api/plugins/nono/enable' -Method Post -ContentType 'application/json' -Body '{"enabled":true}' | Out-Null
  Write-Output 'Nono 3D enabled.'
} catch {
  Write-Output 'Start Strip Bot, then enable Nono in Settings > Desktop pet.'
  exit 1
}
