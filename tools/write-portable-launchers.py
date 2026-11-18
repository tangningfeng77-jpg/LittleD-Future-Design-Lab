from pathlib import Path
root=Path('robot-html')
mac='''#!/bin/bash
set -eu
cd -- "$(dirname -- "$0")"
NODE_BIN="$PWD/runtime/darwin-arm64/bin/node"
if [ ! -f "$NODE_BIN" ]; then
  echo "Bundled Apple Silicon Node runtime is missing."
  read -r -p "Press Enter to close..." _
  exit 1
fi
if [ ! -x "$NODE_BIN" ]; then chmod u+x "$NODE_BIN"; fi
"$NODE_BIN" tools/launch.mjs
'''
(root/'启动小D-Mac.command').write_text(mac,encoding='utf8',newline='\n')
cmd='''@echo off
cd /d "%~dp0"
set "ROBOT_NODE=%~dp0runtime\\win32-x64\\node.exe"
if exist "%ROBOT_NODE%" goto run
set "ROBOT_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js is unavailable. Use the included Mac launcher on Apple Silicon Mac.
 pause
 exit /b 1
)
:run
"%ROBOT_NODE%" tools\\launch.mjs
pause
'''
(root/'启动机器人.cmd').write_text(cmd,encoding='ascii',newline='\r\n')
