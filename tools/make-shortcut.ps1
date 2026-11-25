# PortWatch Hub - cria um atalho na area de trabalho.
# O atalho aponta para ABRIR-LAUNCHER.vbs e usa o icone do app.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$host.UI.RawUI.WindowTitle = 'PortWatch Hub - criar atalho'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$vbs = Join-Path $root 'ABRIR-LAUNCHER.vbs'
$icon = Join-Path $root 'app\assets\icon.ico'

if (-not (Test-Path -LiteralPath $vbs)) {
  Write-Host "   × ABRIR-LAUNCHER.vbs nao encontrado em $root" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path -LiteralPath $icon)) {
  Write-Host "   × Icone nao encontrado em $icon" -ForegroundColor Red
  exit 1
}

$desktop = [Environment]::GetFolderPath('Desktop')
$linkPath = Join-Path $desktop 'PortWatch Hub.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($linkPath)
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$shortcut.Arguments = '"' + $vbs + '"'
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = "$icon,0"
$shortcut.Description = 'PortWatch Hub - corrida GTA VI no PC'
$shortcut.Save()

Write-Host ''
Write-Host '   ✓ Atalho criado na area de trabalho' -ForegroundColor Green
Write-Host "     $linkPath" -ForegroundColor DarkGray
Write-Host ''
Write-Host '   O atalho usa o icone do app e abre sem janela de console.' -ForegroundColor Gray
Start-Sleep -Seconds 2
