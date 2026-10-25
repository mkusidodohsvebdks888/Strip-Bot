param(
  [string]$Source = (Join-Path (Split-Path $PSScriptRoot -Parent) 'codex-ui\src\assets\alpha-eye.jpg'),
  [string]$UiPublic = (Join-Path (Split-Path $PSScriptRoot -Parent) 'codex-ui\public'),
  [string]$PublishedPublic = (Join-Path (Split-Path $PSScriptRoot -Parent) 'public')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$width,[float]$height,[float]$radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
  $path.AddArc($width - $diameter, 0, $diameter, $diameter, 270, 90)
  $path.AddArc($width - $diameter, $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc(0, $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Save-RoundedPng([System.Drawing.Image]$image,[string]$path,[int]$size) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $radius = [float]($size * 0.22)
    $clip = New-RoundedPath $size $size $radius
    try {
      $graphics.SetClip($clip)
      $graphics.DrawImage($image, [System.Drawing.Rectangle]::new(0, 0, $size, $size))
    } finally {
      $clip.Dispose()
    }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Get-RoundedPngBytes([System.Drawing.Image]$image,[int]$size) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $stream = [System.IO.MemoryStream]::new()
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $radius = [float]($size * 0.22)
    $clip = New-RoundedPath $size $size $radius
    try {
      $graphics.SetClip($clip)
      $graphics.DrawImage($image, [System.Drawing.Rectangle]::new(0, 0, $size, $size))
    } finally {
      $clip.Dispose()
    }
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return $stream.ToArray()
  } finally {
    $stream.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Save-MultiSizeIcon([System.Drawing.Image]$image,[string]$path) {
  $sizes = @(16, 24, 32, 48, 64, 128, 256)
  $frames = foreach ($size in $sizes) {
    [pscustomobject]@{ Size = $size; Bytes = Get-RoundedPngBytes $image $size }
  }
  $stream = [System.IO.File]::Create($path)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$frames.Count)
    $offset = 6 + (16 * $frames.Count)
    foreach ($frame in $frames) {
      $dimension = if ($frame.Size -ge 256) { 0 } else { $frame.Size }
      $writer.Write([byte]$dimension)
      $writer.Write([byte]$dimension)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$frame.Bytes.Length)
      $writer.Write([uint32]$offset)
      $offset += $frame.Bytes.Length
    }
    foreach ($frame in $frames) { $bytes = [byte[]]$frame.Bytes; $writer.Write($bytes, 0, $bytes.Length) }
  } finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

$sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source))
try {
  foreach ($directory in @($UiPublic, $PublishedPublic)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    Save-RoundedPng $sourceImage (Join-Path $directory 'brand-logo.png') 1024
    Save-MultiSizeIcon $sourceImage (Join-Path $directory 'strip-bot.ico')

    $jpeg = [System.Drawing.Bitmap]::new(1080, 1080, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $graphics = [System.Drawing.Graphics]::FromImage($jpeg)
    try {
      $graphics.Clear([System.Drawing.Color]::Black)
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.DrawImage($sourceImage, [System.Drawing.Rectangle]::new(0, 0, 1080, 1080))
      $jpeg.Save((Join-Path $directory 'login-brand.jpg'), [System.Drawing.Imaging.ImageFormat]::Jpeg)
    } finally {
      $graphics.Dispose()
      $jpeg.Dispose()
    }
  }
} finally {
  $sourceImage.Dispose()
}

Write-Host 'Alpha brand assets generated: brand-logo.png, login-brand.jpg, strip-bot.ico'

