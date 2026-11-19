# 小D · 未来设计实验室展厅

包含当前桌面网页版完整源码、机器人模型、知识库与图片、欢迎视频、IFS 项目视频及本机手势识别模型。欢迎语、介绍视频、六大场景问答、项目邀请、手势项目和结束后的自由问答均由此版本运行。

## 下载与启动

1. 安装 **Node.js 22 或更新版本**（https://nodejs.org/）。建议使用桌面 Chrome/Edge。
2. 克隆本仓库，或点击 GitHub **Code → Download ZIP** 并完整解压。不要只下载 `public/index.html`。
3. 在根目录执行：

```sh
npm ci
npm run check
npm start
```

浏览器打开 http://127.0.0.1:4173 。也可执行 `npm run launch` 自动选择空闲端口并打开浏览器；Mac 可双击 `启动小D-Mac.command`，Windows 可双击 `启动机器人.cmd`。

**完整视频超过 GitHub 单文件限制，存放于 `packed-assets/` 分片。** `npm ci` 和启动命令会自动拼接并校验 SHA-256，无需 Git LFS，无需另找素材下载链接。首次还原需要额外磁盘空间。不要删除分片或 manifest。

## 开启 AI 语音

复制 `.env.example` 为 `.env.local`，填入自己阿里百炼账号的 `DASHSCOPE_API_KEY` 与 `DASHSCOPE_WORKSPACE_ID`，然后重启服务。当前模型配置在 `public/assets/robot-config.json`。账号需要拥有对应模型访问权限及可用额度；运行环境需能连接百炼服务。

密钥、作者账号配置和签名证书没有上传。未配置密钥时，网页、素材和独立 IFS 项目仍能加载，AI 对话不会工作。

首次连接时允许麦克风与摄像头。摄像头仅提前准备，项目保持静音，确认进入后才播放。项目左下角显示实时手部骨骼，可核对摄像头并切换输入。手势推理在本机执行。

独立检查 IFS 项目：http://127.0.0.1:4173/assets/ifs-project/index.html?autostart=1 。它使用相同项目素材，不需要 AI 密钥。

## 接入好设计馆知识（可选）

在 `.env.local` 再加一行 `GD_MCP_TOKEN=…`（好设计馆签发的只读令牌），重启后小D 就能用语音查询好设计馆的获奖项目和设计方法、比较两个项目的关联，并在身边的展示屏上打开好设计馆页面（可用翻页笔翻页、换项目）。未配置时小D 的行为与原来完全一样。详见 [好设计接入说明](好设计接入说明.md)。

实验室其他项目的资料可以做成知识包放进 `public/assets/packs/`，见 [知识包说明](public/assets/packs/README.md)。

## 三套原始资料

请从 [资料目录索引](资料/README.md) 开始，分为问答与展示图片、逐页逐图资料库、展厅完整资料三个目录。原 ZIP、解压后文件、图文对应关系与原图均保留。启动后访问 `/references/` 可直接浏览。

## 内容结构

- `public/`：当前可运行展厅，包含全部资源及前端代码。
- `server.mjs`、`web-search.mjs`：本地 HTTP、WebSocket 与检索服务。
- `gd-proxy.mjs`、`public/gooddesign.js`、`public/gd-screen.js`：好设计馆知识接入（本机只读转发、小D 工具、展示屏）。
- `packed-assets/`：大视频的完整分片与校验清单。
- `source-unity/`：原始 Unity 相关源码和机器人资产，作为参考保留，并非完整 Unity 工程。
- `platforms/android/`：既有安卓工程源码与原生 AudioRecord 桥；网页资源属于安卓旧基线，不等同当前桌面版本。构建需 Android SDK 35、JDK 17、Gradle 8.9，发布还需原发布者的签名证书。私人配置、证书和构建缓存已排除。未验证这份交付的安卓构建。
- `extras/water-experience/`：保留的水体验原始代码与素材。
- `handoff/`、`tools/`：历史交付记录、开发工具与参考测试。
- `deploy/`：可选 Docker/HTTPS 部署示例。

## 常见问题

- **页面只剩一张图**：使用 `npm start`，不要用文件协议双击 HTML，也不要用未配置 `.mjs` MIME 的静态服务器。
- **素材缺失**：重新执行 `node scripts/restore-assets.mjs` 和 `npm run check`。
- **远程摄像头不可用**：远程访问必须使用 HTTPS；本机使用 `localhost`/`127.0.0.1`。确认选择了面向自己的实际摄像头。
- **端口占用**：执行 `npm run launch`，或设置 `PORT`。
- **GitHub Pages**：不能运行本项目的 Node.js 与实时 WebSocket 后端，需本机运行或部署服务器。

## 资源许可

保留第三方许可（`THIRD_PARTY_NOTICES.txt` 及各 vendor 目录）。机器人模型、视频、图片和知识材料保留各自原许可；上传不代表授予所有素材额外的公开商用授权。
