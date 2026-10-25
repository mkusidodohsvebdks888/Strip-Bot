[CmdletBinding()]
param(
    [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'DeepSeekHarnessPet'),
    [switch]$NoDesktopShortcut,
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$Repository = 'wraven68/deepseek-harness-pet'
$ApplicationName = 'DeepSeekHarnessPet.exe'

function Get-ReleaseAsset {
    param(
        [Parameter(Mandatory)] $Release,
        [Parameter(Mandatory)] [string] $Name
    )

    $asset = @($Release.assets | Where-Object { $_.name -eq $Name }) | Select-Object -First 1
    if ($null -eq $asset) {
        throw "The latest release does not contain $Name."
    }
    return $asset
}

Write-Host 'Fetching the latest DeepSeek Harness Pet release...'
$headers = @{ 'User-Agent' = 'DeepSeek-Harness-Pet-Installer' }
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/latest" -Headers $headers
$application = Get-ReleaseAsset -Release $release -Name $ApplicationName
$checksum = Get-ReleaseAsset -Release $release -Name "$ApplicationName.sha256"

$temporaryDirectory = Join-Path $env:TEMP ("DeepSeekHarnessPet-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporaryDirectory -Force | Out-Null
$temporaryApplication = Join-Path $temporaryDirectory $ApplicationName
$temporaryChecksum = Join-Path $temporaryDirectory "$ApplicationName.sha256"

try {
    Write-Host "Downloading version $($release.tag_name)..."
    Invoke-WebRequest -Uri $application.browser_download_url -OutFile $temporaryApplication -Headers $headers
    Invoke-WebRequest -Uri $checksum.browser_download_url -OutFile $temporaryChecksum -Headers $headers

    $expectedHash = (Get-Content -LiteralPath $temporaryChecksum -Raw).Trim().Split([char[]]" `t")[0].ToUpperInvariant()
    $actualHash = (Get-FileHash -LiteralPath $temporaryApplication -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($expectedHash -ne $actualHash) {
        throw 'Download verification failed: the SHA-256 checksum does not match.'
    }

    Get-Process -Name 'DeepSeekHarnessPet' -ErrorAction SilentlyContinue | Stop-Process -Force
    New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
    $targetPath = Join-Path $InstallDirectory $ApplicationName
    Move-Item -LiteralPath $temporaryApplication -Destination $targetPath -Force

    if (-not $NoDesktopShortcut) {
        $desktop = [Environment]::GetFolderPath('Desktop')
        $shortcutPath = Join-Path $desktop 'DeepSeek Harness Pet.lnk'
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $targetPath
        $shortcut.WorkingDirectory = $InstallDirectory
        $shortcut.IconLocation = "$targetPath,0"
        $shortcut.Description = 'Show DeepSeek Harness task progress on the desktop.'
        $shortcut.Save()
    }

    Write-Host "Installed $($release.tag_name) to $targetPath"
    if (-not $NoLaunch) {
        Start-Process -FilePath $targetPath -WorkingDirectory $InstallDirectory
    }
}
finally {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
