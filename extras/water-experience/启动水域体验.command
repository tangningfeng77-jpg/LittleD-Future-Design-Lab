#!/bin/bash
set -eu
cd -- "$(dirname -- "$0")"
if command -v node >/dev/null 2>&1; then
  exec node server.mjs --open
elif [ -x "/Users/tang/Desktop/LittleD-Complete/runtime/darwin-arm64/bin/node" ]; then
  exec "/Users/tang/Desktop/LittleD-Complete/runtime/darwin-arm64/bin/node" server.mjs --open
else
  echo "未找到 Node.js。请安装 Node.js 后重新打开。"
  read -r -p "按回车关闭" _
fi
