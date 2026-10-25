param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Programs\Strip Bot'),
  [switch]$NoLaunch,
  [switch]$NoShortcut,
  [switch]$NoUi,
  [switch]$AllowRunning
)
$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$payload = Join-Path $base 'payload.zip'
$stage = Join-Path $env:TEMP ('StripBot-install-' + [guid]::NewGuid().ToString('N'))
function Show-Message([string]$text,[string]$title,[string]$kind='Information') {
  if($NoUi){Write-Host $text;return}
  try {
    Add-Type -AssemblyName System.Windows.Forms
    $icon = if($kind -eq 'Error'){[System.Windows.Forms.MessageBoxIcon]::Error}else{[System.Windows.Forms.MessageBoxIcon]::Information}
    [void][System.Windows.Forms.MessageBox]::Show($text,$title,[System.Windows.Forms.MessageBoxButtons]::OK,$icon)
  } catch {Write-Host $text}
}
try {
  Write-Host 'Strip Bot 1.0.1 installer'
  $running = @(Get-Process -Name 'Strip Bot' -ErrorAction SilentlyContinue)
  if(-not $AllowRunning -and $running.Count -gt 0){
    throw 'Strip Bot is currently running. Close it, then run this installer again.'
  }
  if(-not (Test-Path -LiteralPath $payload)){throw 'payload.zip is missing from the installer.'}
  Write-Host 'Extracting application files...'
  New-Item -ItemType Directory -Path $stage -Force | Out-Null
  Expand-Archive -LiteralPath $payload -DestinationPath $stage -Force
  $source = Get-ChildItem -LiteralPath $stage -Directory | Select-Object -First 1
  if(-not $source -or -not (Test-Path -LiteralPath (Join-Path $source.FullName 'Strip Bot.exe'))){
    throw 'The application payload is invalid.'
  }
  New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
  Write-Host "Installing to $InstallRoot ..."
  & robocopy.exe $source.FullName $InstallRoot /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  $copyCode = $LASTEXITCODE
  if($copyCode -ge 8){throw "Unable to copy application files (robocopy exit code $copyCode)."}
  $target = Join-Path $InstallRoot 'Strip Bot.exe'
  if(-not (Test-Path -LiteralPath $target)){throw 'Installed executable was not found.'}
  if(-not $NoShortcut){
    $shell = New-Object -ComObject WScript.Shell
    $places = @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))
    foreach($place in $places){
      if(-not $place){continue}
      $linkPath = Join-Path $place 'Strip Bot.lnk'
      $shortcut = $shell.CreateShortcut($linkPath)
      $shortcut.TargetPath = $target
      $shortcut.WorkingDirectory = $InstallRoot
      $shortcut.IconLocation = "$target,0"
      $shortcut.Description = 'Strip Bot'
      $shortcut.Save()
    }
  }
  if(-not $NoLaunch){Start-Process -FilePath $target -WorkingDirectory $InstallRoot}
  Show-Message "Strip Bot 1.0.1 has been installed successfully.`n`n$InstallRoot" 'Strip Bot'
} catch {
  Show-Message $_.Exception.Message 'Strip Bot installation failed' 'Error'
  exit 1
} finally {
  if(Test-Path -LiteralPath $stage){
    $tempRoot = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
    $stageFull = [IO.Path]::GetFullPath($stage)
    if($stageFull.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $stageFull -Recurse -Force -ErrorAction SilentlyContinue}
  }
}
