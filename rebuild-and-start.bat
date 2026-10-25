@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [Strip Bot] Node.js 18 or later is required.
  pause
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [Strip Bot] npm is required.
  pause
  exit /b 1
)
echo [1/4] Installing UI dependencies...
call npm.cmd ci --prefix .\codex-ui
if errorlevel 1 goto failed
echo [2/4] Building the updated model-picker UI...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\BuildUI.ps1"
if errorlevel 1 goto failed
echo [3/4] Installing the local Agent engine...
call npm.cmd ci --prefix .\agent-runtime
if errorlevel 1 goto failed
echo [4/4] Starting Strip Bot...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\launch.ps1" -Mode start
if errorlevel 1 goto failed
exit /b 0
:failed
echo [Strip Bot] Installation or build failed. Read API-MODEL-AUTODISCOVERY.md.
pause
exit /b 1
