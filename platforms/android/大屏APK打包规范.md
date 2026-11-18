# 小D大屏 APK 固定打包规范

成功基线：2026.11.04.4，versionCode 20261107。用户已反馈该版本成功使用，后续面向同一台大屏的更新默认继承本规范。

这是一份发布基线，不会限制电脑版的新功能开发。只有确实需要改变设备兼容策略时，才修改相关适配，并记录原因、验证结果。`release-profile.json` 是对应的机器可读参数记录，**不会自动应用到代码或 Gradle**。

## 项目与更新关系

- 电脑主项目：`/Users/tang/Desktop/LittleD-Complete/`，继续在这里编辑机器人、知识、图片和新功能。
- 独立安卓工程：`/Users/tang/Documents/ChatGPT/展厅/littled-android/`。
- 安卓网页副本：`app/src/main/assets/web/`。从电脑项目的 `public/` 获取新版内容，再合并大屏专用适配。
- 原生容器：`MainActivity.java`；原生录音：`NativeAudio.java`，位于 `app/src/main/java/com/futurelab/littled/`。
- 不把安卓修改写回电脑版，不通过移动、删除或覆盖电脑主项目来打包。

`release-baseline/desktop/` 和 `release-baseline/android/` 保存成功版本中有差异的前端文件，`desktop-to-android.patch` 保存差异。其余资源以 `source-snapshot.json` 的初始哈希为参考。它们供未来三方比较和人工合并，**不能当成可以无条件覆盖新版的完整项目**。

## 固定设备与构建设置

| 项目 | 基线值 |
| --- | --- |
| 目标设备 | 用户已成功安装的 BOE 大屏；系统照片确认为 Android 13 |
| 显示 | 3840×2160，横屏，8GB RAM |
| 应用包名 | `com.futurelab.littled`，后续更新保持一致 |
| 应用名 | 小D展厅助手 |
| minSdk / targetSdk / compileSdk | 26 / 35 / 35 |
| JDK / Gradle / Android Gradle Plugin | 17 / 8.9 / 8.7.3 |
| Java 源码和目标版本 | 17 |
| NanoHTTPD WebSocket / OkHttp | 2.3.1 / 3.14.9 |
| Release | 当前不混淆，使用固定本地签名 |

以上为已验证的构建组合；依赖升级单独验证，不与内容更新混在一起。

**后续每次发布都必须提高 versionCode**，基线为 20261107，下一次至少 20261108；若已发布更高版本，以最新版本为准。同步更新 versionName、交付文件名和测试报告。versionCode 是递增整数，不必作为日期解释。

## 签名与覆盖安装

固定使用工程里的 `.signing/littled.keystore`。签名配置已在 `app/build.gradle` 中，不更换证书，不临时生成新的 debug keystore。

已安装基线的证书 SHA-256：

```
cd8059cd1ec043b061b008fb241d023c96fd00951aa342ae9d18fe8909d072e8
```

这个基线沿用了当时的开发证书身份；后续本机大屏覆盖更新必须继续保持同一证书。若将来上架应用商店或迁移签名，作为独立迁移处理，不能直接换签名覆盖。

私下备份签名文件及其访问配置；不把 keystore 放进用户安装包或公开仓库。不能通过要求用户卸载旧版来绕过签名不一致：卸载会丢失设备内保存的连接配置。

## 原生容器设置

- 全屏横屏、保持亮屏、硬件加速；网页宽高以 WebView 实际可视区域为准。
- 字体缩放 `setTextZoom(100)`，禁止页面缩放和内置缩放按钮。
- JS、DOM Storage 启用；允许音频播放；禁止 file/content 文件访问。
- 本地服务固定绑定 `127.0.0.1:4173`，只在设备内部提供网页及 AI 转发；不依赖 Mac 或域名。
- 服务读超时保持 0，避免空闲 WebSocket 被短超时断开。
- 保留 INTERNET、RECORD_AUDIO、CAMERA 权限；录音权限运行时申请。
- `LittleDAudio` 桥接仅供随包的本地可信页面使用，不能让不受信任网页获得原生录音桥。
- 切换后台、退出或断开时停止录音。保持拒绝外部页面直接在该 WebView 中导航。

## 页面、镜头和性能设置

- 左侧场景 76%，右侧交流区 24%；两栏都约束在实际视口内。
- 覆盖电脑版媒体查询遗留的 400px/580px 等最小高度，避免设备逻辑像素较小时整页被裁。
- 页面不整体滚动，右侧内容必要时单独滚动；按钮和输入框不能被固定尺寸挤出屏幕。
- 镜头使用参考位置，不额外向机器人前移；关闭场景触摸缩放，保留轻微受限转动。
- 初始 pixelRatio：`Math.min(window.devicePixelRatio || 1, 1920 / window.innerWidth)`。
- 帧率不足时，保留当前自动降档到 1440、1280 宽度上限的逻辑。
- 关闭 MSAA 抗锯齿，关闭环境光遮蔽；阴影贴图 1024。
- 反射渲染最大 256×256，最短更新间隔 200ms。

**不要因为设备物理屏幕是 4K，就强制 4K 实时渲染。** 上一版提高到 3840 渲染上限后用户反馈动作严重卡顿。4K 屏幕输出、网页逻辑像素和 3D 渲染分辨率是三个不同的量。性能优化后再提升画质，必须以同一台实机的表现为依据。

## 录音、声音及交流方式

### 使用方式

1. 点击一次「开始交流」，自动连接 AI 并打开持续收音。
2. 不需要按住按钮，也不需要每句话点击发送；用户说完稍停，由服务端自动判断分句并回答。
3. 再点「结束交流」，停止录音并停止当前回复。
4. V 键同样是切换开始/结束，不恢复成按住快捷键。
5. 切后台或断开后结束收音，返回时由用户重新开始。

### 录音链路

默认使用 Android 原生 `AudioRecord`，经 `LittleDAudio` 向前端发送 PCM；不能恢复成只依赖 WebView `getUserMedia`。该设备曾持续出现 `Could not start audio source / NotReadableError`，网页重试和重启未解决，原生录音版随后获用户成功反馈。

- 保留系统输入设备列表、手动输入选择、「测试麦克风」和实时输入电平。
- 输入源依次尝试 MIC、VOICE_RECOGNITION、DEFAULT。
- 支持尝试 16000、48000、44100Hz，单声道和双声道；失败要释放资源再尝试。
- 统一输出 16000Hz、单声道、PCM16 little endian，每 100ms 一包，3200 字节，Base64 传给前端。
- 设备输入列表或驱动错误要能显示出来，不能只让用户反复重启。
- 不把录音写入文件。麦克风测试期间不向 AI 发送声音；真正开始交流后才发送。

### 自动分句与回声抑制策略

当前 `semantic_vad` 参数：threshold 0.5、prefix_padding_ms 500、silence_duration_ms 800。配置通过真实服务端验证，自动分句模式参考[阿里云实时对话文档](https://www.alibabacloud.com/help/en/model-studio/realtime)。

AI 回复处理期间、工具处理期间、有待播放音频时，以及播放结束后约 650ms，不向 AI 发送麦克风帧，避免把扬声器声音再作为提问。这里是应用层收音门控，并不保证所有现场声学回声都被消除；当前以轮流交流为准。

AI 播放为 24000Hz PCM。失败路径不能遗留 suspended 的 AudioContext，不能为了打开麦克风而让扬声器一直静音。测试时要分别检查收到音频、上下文运行以及实机确实有声，三者不等价。

## AI 连接配置

- 沿用现有账号配置和模型，不为打包擅自改服务商、音色或模型。
- JSON 通过设备文件选择器首次导入；设备上用 AndroidKeyStore AES/GCM 加密保存。
- 保持 API 密钥不进入 APK、前端、日志、测试报告或文档。
- 私人安装包如附连接 JSON，需要标明“不可公开转发”。不把 `.env.local` 或测试资产里的私人配置复制到网页 assets。
- 覆盖升级保留包名、签名和设备内配置；保留重导入入口。

## 每次从电脑版更新到 APK 的流程

1. 记录当前成功 APK、版本号及证书指纹，保留上一份交付以便定位问题。不要删除已有成功包。
2. 将电脑新版 `public/` 复制到临时发布目录，先做资源与脚本差异检查。
3. 用 `release-baseline/desktop`（旧桌面基线）、电脑新版文件、`release-baseline/android`（成功安卓适配）进行三方比较，再把新功能合并到安卓网页副本。
4. 重点检查 `app.js`、`voice.js`、`style.css`、`photo-stage.js`、`index.html`，保留 `android-bootstrap.js`。不能全量覆盖后只改文件名就发布，也不要不看上下文强行应用补丁。
5. 电脑新增的知识、模型、图片、音色和角色设定可正常同步，检查资源路径和命中相关图片的逻辑。涉及原生录音、AI 协议、UI 选择器的变化单独核对。
6. 保留 `MainActivity.java`、`NativeAudio.java` 和固定签名；提高 Gradle 版本号。
7. 编译、Lint、必要测试和签名检查通过后再复制 APK 到新的交付目录。
8. 写明版本和变更，输出 SHA256、测试报告、安装说明及 ZIP；验证 ZIP 可解压及 APK 无密钥。
9. 在该 BOE 大屏覆盖安装，确认实际声音、对话、流畅度和图片展示。模拟器通过不能替代实机验收。
10. 经用户确认成功后，再新增一份发布基线及差异记录；不要擦掉本次原始成功基线。

## 当前电脑的构建命令

以下路径只用于当前 Mac 的构建环境，不是大屏的启动方式。大屏始终通过应用图标打开。

```sh
cd '/Users/tang/Documents/ChatGPT/展厅'
export JAVA_HOME='/Users/tang/Documents/ChatGPT/展厅/android-build-tools/jdk/zulu17.70.113-ca-fx-jdk17.0.21.0.3-macosx_aarch64/Contents/Home'
android-build-tools/gradle-8.9/bin/gradle -p littled-android assembleRelease lintRelease --no-daemon
```

输出：`littled-android/app/build/outputs/apk/release/app-release.apk`。

```sh
android-build-tools/sdk/build-tools/35.0.0/apksigner verify --verbose --print-certs littled-android/app/build/outputs/apk/release/app-release.apk
```

有可用 Android 测试设备/模拟器时：

```sh
android-build-tools/gradle-8.9/bin/gradle -p littled-android connectedDebugAndroidTest --no-daemon
```

现有集成测试的私人 fixture 位于 `app/src/androidTest/assets/private-config.json`，被 gitignore 排除；换电脑后需要在私下恢复，不能提交或打包进 Release。它只属于测试 APK 的 assets。

## 发布验收

- 编译及 Lint 零错误；签名指纹一致；versionCode 递增。
- 模型、知识和图片都能在 APK 内找到，无遗漏，无私人密钥。
- 小逻辑视口下左右两栏不越界，机器人和配图不被裁切。
- 点击一次可以自动连接并持续收音，松手后仍有效；再次点击停止并释放麦克风。
- 原生录音读取、重采样、录音时播放上下文运行、停止释放均正常。
- 真实 AI 连接可回复；有模拟器网络超时时复核原因，不能把未通过写成通过。
- 实机可以听到小D声音，实际说话有输入电平，能自动分句、回答后继续听。
- 动作无明显卡顿，图片正面可读，持图动作稳定。
- 说明哪些是模拟器结果、哪些是实机反馈，不编造长时间运行或帧率测试。
- 打包前后电脑主项目文件保持不变。

## 后续可以直接这样下达更新任务

> 按 littled-android/大屏APK打包规范.md 和 release-profile.json，把我电脑最新的 LittleD-Complete 更新成同一台 BOE 大屏可覆盖安装的 APK。继承成功基线的原生录音、点击式持续交流、页面比例、镜头和自适应性能设置；电脑源码不要改动；沿用签名，递增版本，验证后交付新包。
