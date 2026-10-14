@echo off
cd /d "%~dp0"
echo Demo mode: local echo only, not an AI model.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch.ps1" -Mode demo
if errorlevel 1 pause
