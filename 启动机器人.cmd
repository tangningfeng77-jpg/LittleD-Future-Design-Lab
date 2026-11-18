@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Please install Node.js 22+ from https://nodejs.org/ & pause & exit /b 1)
if not exist node_modules\ws call npm ci
if errorlevel 1 exit /b 1
call npm run launch
pause
