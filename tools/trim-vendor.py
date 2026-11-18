from pathlib import Path
import re
root=Path('robot-html/public/vendor/three').resolve();keep=set();todo=['build/three.module.js','examples/jsm/loaders/FBXLoader.js','examples/jsm/controls/OrbitControls.js','package.json','examples/jsm/postprocessing/EffectComposer.js','examples/jsm/postprocessing/RenderPass.js','examples/jsm/postprocessing/GTAOPass.js','examples/jsm/postprocessing/OutputPass.js']
while todo:
 p=(root/todo.pop()).resolve()
 if p in keep:continue
 assert p.is_relative_to(root)
 keep.add(p)
 if p.suffix=='.js':
  text=p.read_text(encoding='utf8')
  for rel in re.findall(r'(?:from\s*|import\s*)[\'\"]([^\'\"]+)[\'\"]',text):
   if rel.startswith('.'):
    q=(p.parent/rel).resolve();assert q.is_relative_to(root)
    todo.append(str(q.relative_to(root)))
before=sum(p.stat().st_size for p in root.rglob('*') if p.is_file())
for p in root.rglob('*'):
 if p.is_file() and p.resolve() not in keep:p.unlink()
after=sum(p.stat().st_size for p in keep)
print('Three.js reduced',round(before/1048576,2),'to',round(after/1048576,2),'MiB;',len(keep),'files')
for name in ['audit.mjs','fix.py','adjust.py','lighting.py','face-final.py']:
 p=Path('robot-html/tools')/name
 if p.exists():p.unlink()
