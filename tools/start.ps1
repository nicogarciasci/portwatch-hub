# PortWatch Hub - inicializador geral.
# Confere o Node.js, instala as dependencias na primeira vez e abre o launcher.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$host.UI.RawUI.WindowTitle = 'PortWatch Hub'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Banner {
  Write-Host ''
  Write-Host '   ██████╗  ██╗    ██╗' -ForegroundColor Magenta
  Write-Host '   ██╔══██╗ ██║    ██║' -ForegroundColor Magenta
  Write-Host '   ██████╔╝ ██║ █╗ ██║   PORTWATCH HUB' -ForegroundColor Magenta
  Write-Host '   ██╔═══╝  ██║███╗██║   GTA VI no PC' -ForegroundColor DarkMagenta
  Write-Host '   ██║      ╚███╔███╔╝   tracker ao vivo' -ForegroundColor DarkMagenta
  Write-Host '   ╚═╝       ╚══╝╚══╝' -ForegroundColor DarkMagenta
  Write-Host ''
  Write-Host '   ─────────────────────────────────────────────' -ForegroundColor DarkGray
  Write-Host ''
}

function Stop-WithError($message) {
  Write-Host ''
  Write-Host "   × $message" -ForegroundColor Red
  Write-Host ''
  exit 1
}

Write-Banner
Write-Host '   Verificando o ambiente...' -ForegroundColor DarkGray
Write-Host ''

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
  Stop-WithError 'Node.js nao encontrado. Instale a versao 22 ou mais recente em https://nodejs.org'
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $npm) {
  Stop-WithError 'npm nao encontrado. Reinstale o Node.js com o npm incluido.'
}

$nodeVersion = (& $node.Source --version).Trim()
$nodeMajor = 0
try { $nodeMajor = [int]($nodeVersion.TrimStart('v').Split('.')[0]) } catch { }
Write-Host "   ✓ Node.js $nodeVersion" -ForegroundColor Green
if ($nodeMajor -gt 0 -and $nodeMajor -lt 22) {
  Write-Host '   ! Recomendado Node.js 22 ou mais recente.' -ForegroundColor Yellow
}

$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path -LiteralPath $electron)) {
  Write-Host '   • Primeira execucao: instalando dependencias...' -ForegroundColor Yellow
  Write-Progress -Activity 'PortWatch Hub' -Status 'Instalando dependencias (primeira execucao)...' -PercentComplete 0
  Push-Location $root
  try {
    & $npm.Source install --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) {
      throw "npm install terminou com codigo $LASTEXITCODE."
    }
  } catch {
    Pop-Location
    Write-Progress -Activity 'PortWatch Hub' -Completed
    Stop-WithError $_.Exception.Message
  }
  Pop-Location
  Write-Progress -Activity 'PortWatch Hub' -Completed
  if (-not (Test-Path -LiteralPath $electron)) {
    Stop-WithError 'O Electron nao foi instalado corretamente.'
  }
  Write-Host '   ✓ Dependencias instaladas' -ForegroundColor Green
} else {
  Write-Host '   ✓ Dependencias prontas' -ForegroundColor Green
}

Write-Host '   ✓ Abrindo o PortWatch Hub...' -ForegroundColor Green
Start-Process -FilePath $electron -ArgumentList '.' -WorkingDirectory $root
Start-Sleep -Milliseconds 900
Write-Host ''
Write-Host '   Pronto. Bom jogo!' -ForegroundColor DarkGray
Start-Sleep -Milliseconds 700
