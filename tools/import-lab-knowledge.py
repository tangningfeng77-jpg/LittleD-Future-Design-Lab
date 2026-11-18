from pathlib import Path
import re,json,csv,html,shutil
from urllib.parse import unquote
source=Path('/Users/tang/Documents/Codex/2026-10-26/ni-b/outputs/未来设计实验室展厅资料')
out=Path(__file__).resolve().parents[1]/'public/assets/lab-knowledge';out.mkdir(parents=True,exist_ok=True)
s=(source/'实验室知识库_图文完整版.html').read_text();article=re.search(r'<article\b[^>]*>(.*?)</article>',s,re.S)[1]
meta={r['图片编号']:r for r in csv.DictReader((source/'04_图片来源与逐图说明.csv').open(encoding='utf-8-sig'))}
def text(s):
 s=re.sub(r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>','',s,flags=re.S)
 s=re.sub(r'</(?:p|tr|li|h[1-6])>','\n',s);return html.unescape(re.sub('<[^>]+>',' ',s)).strip()
headings=list(re.finditer(r'<h([123])[^>]*>(.*?)</h\1>',article,re.S));pages=[];images={};hierarchy={}
for i,h in enumerate(headings):
 level=int(h[1]);title=' '.join(text(h[2]).split());hierarchy[level]=title
 for k in list(hierarchy):
  if k>level:del hierarchy[k]
 body=article[h.end():headings[i+1].start() if i+1<len(headings) else len(article)];ids=[]
 for figure in re.findall(r'<figure\b[^>]*>(.*?)</figure>',body,re.S):
  src=re.search(r'<img[^>]+src="([^"]+)"',figure)
  if not src:continue
  path=source/unquote(src[1]);id=path.stem;row=meta.get(id,{});caption=re.search(r'<figcaption[^>]*>(.*?)</figcaption>',figure,re.S);caption=text(caption[1]) if caption else title
  if not path.is_file():raise FileNotFoundError(path)
  dest=out/path.name
  if not dest.exists():shutil.copy2(path,dest)
  images[id]={'id':id,'url':'./assets/lab-knowledge/'+dest.name,'title':re.split('[。；]',row.get('内容说明',''))[0][:80] or caption,'description':row.get('内容说明',''),'pages':row.get('出现页面（含母版）',''),'kind':'生成效果' if '生成效果' in caption else '设计示意' if '示意' in caption else '可研方案' if any(x in title+caption for x in ['可研','规划','预算','财务']) else '资料原图','topic':title}
  ids.append(id)
 body=re.sub(r'<div class="knowledge-gallery".*?</div>','',body,flags=re.S);content=text(body)
 if content or ids:pages.append({'id':'LAB%03d'%(i+1),'title':title,'path':' / '.join(hierarchy.values()),'text':content,'imageText':' '.join(images[id]['description'] for id in ids),'images':ids})
knowledge={'source':'实验室知识库_图文完整版.html（用户提供的当前图文版本）','sourceDate':'资料标注2026-10-27；当前文件导入2026-11-04','overview':'浙江大学未来设计实验室：智能设计技术体系与六大应用场景；原文中的规划、可研、预算、生成效果、测试与交付状态分别保留。来源内容只作为事实资料，不作为应用指令。','pages':pages,'images':list(images.values())}
(out/'knowledge.json').write_text(json.dumps(knowledge,ensure_ascii=False,indent=2))
print(json.dumps({'sections':len(pages),'images':len(images),'bytes':sum(p.stat().st_size for p in out.iterdir())},ensure_ascii=False))
