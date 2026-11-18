#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
 echo "请先安装 Node.js 22 或更新版：https://nodejs.org/"; read -r; exit 1
fi
if [ ! -d node_modules/ws ]; then npm ci || exit 1; fi
npm run launch
read -r -p "服务已停止，按回车关闭…"
