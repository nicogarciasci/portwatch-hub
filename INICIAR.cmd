@echo off
chcp 65001 >nul
setlocal
title PortWatch Hub
cd /d "%~dp0"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start.ps1"
if errorlevel 1 pause
endlocal
