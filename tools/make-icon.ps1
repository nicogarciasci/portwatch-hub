# Gera app\assets\icon.ico a partir de app\assets\icon.png (16 a 256 px).
# Uso: powershell -ExecutionPolicy Bypass -File tools/make-icon.ps1

Add-Type -AssemblyName System.Drawing

$base = Split-Path $PSScriptRoot -Parent
$src = Join-Path $base 'app\assets\icon.png'
$icoPath = Join-Path $base 'app\assets\icon.ico'

if (-not (Test-Path -LiteralPath $src)) {
  throw "Icone fonte nao encontrado: $src"
}

$sizes = @(16, 24, 32, 48, 64, 96, 128, 256)
$source = [System.Drawing.Image]::FromFile($src)
$frames = New-Object System.Collections.ArrayList

foreach ($size in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($source, 0, 0, $size, $size)
  $g.Dispose()

  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  [void]$frames.Add([pscustomobject]@{ Size = $size; Data = $ms.ToArray() })
  $ms.Dispose()
}

$source.Dispose()

$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$frames.Count)

$offset = 6 + 16 * $frames.Count
foreach ($frame in $frames) {
  $dim = if ($frame.Size -ge 256) { 0 } else { $frame.Size }
  $bw.Write([Byte]$dim)
  $bw.Write([Byte]$dim)
  $bw.Write([Byte]0)
  $bw.Write([Byte]0)
  $bw.Write([UInt16]1)
  $bw.Write([UInt16]32)
  $bw.Write([UInt32]$frame.Data.Length)
  $bw.Write([UInt32]$offset)
  $offset += $frame.Data.Length
}

foreach ($frame in $frames) {
  $bw.Write([byte[]]$frame.Data)
}

$bw.Close()
$fs.Dispose()

Write-Output "icon: $icoPath"
