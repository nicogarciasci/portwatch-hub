@echo off
chcp 65001 >nul
setlocal
title PortWatch Hub - criar atalho
cd /d "%~dp0"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\make-shortcut.ps1"
if errorlevel 1 pause
endlocal
