from pathlib import Path
p=Path('robot-html/public/app.js');s=p.read_text(encoding='utf8').replace('qualityTier?.5:.8','qualityTier ? .5 : .8').replace('keyLight.shadow.map=null;viewWidth=0','keyLight.shadow.map=null;keyLight.shadow.mapPass?.dispose();keyLight.shadow.mapPass=null;viewWidth=0');p.write_text(s,encoding='utf8')
p=Path('robot-html/README.md');s=p.read_text(encoding='utf8');s+='''
## 动作衔接与渲染细化

`public/motion.js` 使用约 0.58 秒的五阶缓动过渡，并从所有当前动作的实际权重继续混合，支持中途打断。重复选择同一动作不从头重播；一次性手势在末尾提前过渡回待机/说话。说话动作播放节奏降低到原速的 78%，手势为 90%，只在自然交流模式启用；编辑模式保留原速度。口型开合也做了平滑处理。

外壳根据原贴图明暗区分深色部件与白色涂层的粗糙度/金属度；增强玻璃面罩反射，调整曝光和摄影棚光比。新增官方 Three.js GTAO 环境遮蔽、Poisson 降噪和输出色彩处理，保留柔化实时阴影。渲染模块裁剪后 Three.js 资源约 2.23 MiB，无需远程 CDN。

运行时根据持续采样帧率降级遮蔽分辨率和阴影精度，必要时关闭 GTAO，优先保持动作流畅。当前电脑本地浏览器预览观察约 60 FPS；不同设备与窗口大小会有差异。

检查：`node tools/verify-motion.mjs` 验证快速中断切换中姿态连续、权重归一、提前回到待机、同一动作不重播。`node tools/verify-expression.mjs` 回归自动表情。浏览器连续切换问好/点赞正常，无运行时或着色器错误。
''';p.write_text(s,encoding='utf8')
root=Path('robot-html/tools').resolve()
for name in ['smooth-render.py','fix-motion.py','fetch-render.py','add-ao.py','adaptive-render.py']:
 p=(root/name).resolve();assert p.parent==root
 if p.exists():p.unlink()
