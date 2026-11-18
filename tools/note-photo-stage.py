from pathlib import Path
p=Path('robot-html/README.md');s=p.read_text(encoding='utf8');s+='''
## 照片空间背景

使用用户提供的未来设计实验室照片（`public/assets/lab-background.png`），在 `public/photo-stage.js` 中按参考相机重建地面、后墙、侧墙及顶面的投影关系。机器人位于地面圆环中心附近。原截图直接作为投影来源，没有修改原图。

地面采用单独的投影材质、阴影接收层和机器人镜面相机，每秒最多 20 次更新经过柔化的动态倒影；机器人继续按正常帧率更新。蓝白顶光、蓝色低位补光、图片衍生环境反射与现场色调匹配。遮蔽只计算机器人和接触面，不重复污染图片中已存在的墙面阴影。

这是单张照片的有限视角 2.5D 重建，支持小幅水平/垂直视差与拉近，不是可自由漫游的完整展厅模型。为了不暴露单张图没有提供的信息，关闭平移并限制旋转角度。重置视角会回到校准相机。

浏览器验证：原始照片背景正常、地面与墙面衔接、小幅视差、问好动作、机器人倒影和阴影；无着色器/运行时错误，当前设备采样约 60 FPS。AI 的当前场景说明已同步更新，但不会声称能在图片之外导航。
''';p.write_text(s,encoding='utf8')
root=Path('robot-html/tools').resolve()
for name in ['add-photo-stage.py','tune-photo-stage.py','photo-ao.py']:
 p=(root/name).resolve();assert p.parent==root
 if p.exists():p.unlink()
