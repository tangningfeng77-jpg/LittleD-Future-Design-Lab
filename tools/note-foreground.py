from pathlib import Path
p=Path('robot-html/README.md');s=p.read_text(encoding='utf8');s+='''
## 主体与背景分层

照片后景适度降亮度、降低饱和度，独立的后墙标识保持清晰。地面只轻微压亮度，保留倒影与脚下接触感。小D采用稍暖的白色主光、暖色轮廓光与较弱的蓝色补光，涂层白色也略偏暖；默认相机略微拉近，突出机器人主体。
''';p.write_text(s,encoding='utf8')
root=Path('robot-html/tools').resolve()
for name in ['separate-foreground.py','tune-foreground.py']:
 p=(root/name).resolve();assert p.parent==root
 if p.exists():p.unlink()
