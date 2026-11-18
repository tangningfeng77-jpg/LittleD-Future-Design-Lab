from pathlib import Path
p=Path('robot-html/README.md');s=p.read_text(encoding='utf8');s+='''
## 小D材质细化

`public/material-finish.js` 负责分区材质：使用原 MetallicSmoothness 贴图的红通道与 Alpha 通道控制金属度/表面变化，配合原法线贴图；白色外壳采用细腻半哑光涂层，深色关节保留更粗糙的表面。程序生成的小尺寸粗糙度数据只用于微表面变化，不叠加明显噪点。

胸章青色边框、石墨内衬、铜件和发光附件使用独立物理材质参数。铜件有轻微方向性反光，白色涂层与关节不再共用同一层清漆。面罩根据视角改变透明度：正面更清透，边缘保留玻璃反射，保护眼睛与嘴型的可读性。

滚轮允许进一步拉近查看材质（最小视距 4.75），重置视角回到原构图。浏览器实测近景无着色器错误，未改变原骨骼、表情与动作。
''';p.write_text(s,encoding='utf8')
root=Path('robot-html/tools').resolve()
for name in ['premium-materials.py','premium-closeup.py']:
 p=(root/name).resolve();assert p.parent==root
 if p.exists():p.unlink()
