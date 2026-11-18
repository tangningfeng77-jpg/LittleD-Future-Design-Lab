# 部署

根目录配置 `.env.production`（参照 `.env.example`），通过 `PUBLIC_ORIGIN=https://你的域名 docker compose -f deploy/compose.yaml up -d --build` 启动。配置 HTTPS 反向代理后，浏览器才能在远程地址使用摄像头和麦克风。不要只发布到 GitHub Pages；实时 AI 需要 Node.js/WebSocket 服务。
