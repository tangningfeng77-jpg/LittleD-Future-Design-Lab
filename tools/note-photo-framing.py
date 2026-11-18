from pathlib import Path
p=Path('robot-html/public/photo-stage.js');s=p.read_text(encoding='utf8').replace('// Camera-calibrated 2.5D room: the supplied photo is projected onto separate\n// floor / rear / side / ceiling surfaces. Only a bounded viewpoint is valid.','// Camera-calibrated 2.5D room: separate floor and photographic rear layer.\n// Aspect-preserving framing and bounded movement prevent unsupported edge views.');p.write_text(s,encoding='utf8')
p=Path('robot-html/README.md');s=p.read_text(encoding='utf8');s+='''
## 背景文字与宽屏比例修正

后墙「未来设计实验室 / FUTURE DESIGN LAB」已用独立 2048×512 字体纹理重建，采用深蓝字面和轻微厚度边缘，覆盖原图中低清晰度的文字；标识仍位于后墙深度上，服从同一透视关系。

取消了不可靠的侧墙/顶面包裹投影，改为真实地面 + 照片后景层，保留机器人接触阴影、倒影与环境反光。纹理坐标越界会裁掉，不再复制最边缘像素形成拉长带。窗口较宽时适配相机视场，保持原图比例并裁切上下，窄窗口裁切左右；微调视角和拉近范围也收紧。

`node tools/verify-photo-framing.mjs` 验证从竖屏到超宽屏的画面边界均处于原照片内部。浏览器已实测默认窗口和 1600×720 宽屏，无两侧边缘延展。
''';p.write_text(s,encoding='utf8')
root=Path('robot-html/tools').resolve()
for name in ['fix-photo-projection.py','sharpen-sign.py','fit-photo-testable.py']:
 p=(root/name).resolve();assert p.parent==root
 if p.exists():p.unlink()
