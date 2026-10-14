$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskSourcePath = Join-Path $taskRoot 'public\brand-logo.png'
$taskIconPath = Join-Path $taskRoot 'public\strip-bot.ico'
$taskImage = [Drawing.Image]::FromFile($taskSourcePath)
$taskSizes = @(16, 32, 48, 64, 128, 256)
$taskImages = @()
try {
    foreach ($taskSize in $taskSizes) {
        $taskBitmap = [Drawing.Bitmap]::new($taskSize, $taskSize, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $taskGraphics = [Drawing.Graphics]::FromImage($taskBitmap)
        $taskStream = [IO.MemoryStream]::new()
        try {
            $taskGraphics.Clear([Drawing.Color]::Transparent)
            $taskGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $taskGraphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $taskGraphics.DrawImage($taskImage, 0, 0, $taskSize, $taskSize)
            $taskBitmap.Save($taskStream, [Drawing.Imaging.ImageFormat]::Png)
            $taskImages += ,$taskStream.ToArray()
        } finally {
            $taskStream.Dispose()
            $taskGraphics.Dispose()
            $taskBitmap.Dispose()
        }
    }
} finally { $taskImage.Dispose() }
$taskFile = [IO.File]::Create($taskIconPath)
$taskWriter = [IO.BinaryWriter]::new($taskFile)
try {
    $taskWriter.Write([uint16]0)
    $taskWriter.Write([uint16]1)
    $taskWriter.Write([uint16]$taskSizes.Count)
    $taskOffset = 6 + 16 * $taskSizes.Count
    for ($taskIndex = 0; $taskIndex -lt $taskSizes.Count; $taskIndex++) {
        $taskDimension = if ($taskSizes[$taskIndex] -eq 256) { 0 } else { $taskSizes[$taskIndex] }
        $taskWriter.Write([byte]$taskDimension)
        $taskWriter.Write([byte]$taskDimension)
        $taskWriter.Write([byte]0)
        $taskWriter.Write([byte]0)
        $taskWriter.Write([uint16]1)
        $taskWriter.Write([uint16]32)
        $taskWriter.Write([uint32]$taskImages[$taskIndex].Length)
        $taskWriter.Write([uint32]$taskOffset)
        $taskOffset += $taskImages[$taskIndex].Length
    }
    foreach ($taskBytes in $taskImages) { $taskWriter.Write([byte[]]$taskBytes) }
} finally { $taskWriter.Dispose() }
# Verify Windows can read the generated icon before changing the shortcut.
$taskCheck = [Drawing.Icon]::new($taskIconPath)
$taskCheck.Dispose()
$taskDesktop = [Environment]::GetFolderPath('Desktop')
$taskShortcutPath = Join-Path $taskDesktop 'Strip Bot.lnk'
if (-not (Test-Path -LiteralPath $taskShortcutPath)) { throw 'Strip Bot desktop shortcut was not found.' }
$taskShell = New-Object -ComObject WScript.Shell
$taskShortcut = $taskShell.CreateShortcut($taskShortcutPath)
$taskShortcut.IconLocation = "$taskIconPath,0"
$taskShortcut.Save()
$taskVerified = $taskShell.CreateShortcut($taskShortcutPath)
if ($taskVerified.IconLocation -ne "$taskIconPath,0") { throw 'Shortcut icon verification failed.' }
Write-Host "Strip Bot desktop icon updated: $taskIconPath"
