import pathlib,re,json,shutil,hashlib
r=pathlib.Path('.'); out=r/'robot-html'; a=out/'public/assets'
def write(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf8')
def blocks(p):
 s=p.read_text(encoding='utf8'); return {i:(int(t),b) for t,i,b in re.findall(r'--- !u!(\d+) &(\d+)[^\n]*\n(.*?)(?=--- !u!|\Z)',s,re.S)}
def field(b,k):
 m=re.search(r'^  '+re.escape(k)+r': (.*)$',b,re.M);return m.group(1) if m else ''
def ref(b,k):
 m=re.search(r'fileID: (\d+)',field(b,k));return m.group(1) if m else None
def vec(b,k): return [float(v) for v in re.findall(r'[xyzw]: ([^,}]+)',field(b,k))]
guid={}
for p in (r/'Assets').rglob('*.meta'):
 m=re.search(r'^guid: (\w+)',p.read_text(encoding='utf8',errors='ignore'),re.M)
 if m:guid[m[1]]=pathlib.Path(str(p)[:-5])
base=r/'Assets/GrigoriyArx/DrollRobots'; fbx=base/'Art/Meshes/Robots/Rob13Emo04/Rob13.fbx'
shutil.copy2(fbx,a/'Rob13.fbx')
meta=fbx.with_suffix('.fbx.meta').read_text(); clips=[]
for b in re.split(r'    - serializedVersion: 16\n',meta)[1:]:
 if not b.startswith('      name:'):continue
 def val(k):
  m=re.search(r'^      '+k+r': (.*)',b,re.M);return m[1] if m else ''
 clips.append(dict(name=val('name'),take=val('takeName'),first=float(val('firstFrame')),last=float(val('lastFrame')),loop=val('loopTime')=='1'))
write(a/'animations.json',clips)
for folder in [base/'Scripts',base/'Art/Materials/Robots/Rob13',r/'Assets/ResearchCenter/LittleD']:
 dest=out/'source-unity'/folder.name;shutil.copytree(folder,dest,dirs_exist_ok=True)
for p in (r/'Assets/ResearchCenter/Scripts').glob('Robot*.cs'):shutil.copy2(p,out/'source-unity'/p.name)
shutil.copy2(base/'Prefabs/Robots/Rob13.prefab',out/'source-unity/Rob13.prefab')
shutil.copy2(base/'Art/Animations/Rob13.controller',out/'source-unity/Rob13.controller')
materials={}
for p in list((base/'Art/Materials/Robots/Rob13').glob('*.mat'))+list((r/'Assets/ResearchCenter/LittleD').glob('*.mat')):
 s=p.read_text(); maps={}
 for prop,g in re.findall(r'    - (\w+):\n        m_Texture: \{fileID: \d+, guid: (\w+)',s):
  src=guid.get(g)
  if src and src.exists():shutil.copy2(src,a/src.name);maps[prop]=src.name
 colors={}
 for prop,v in re.findall(r'    - (\w+): \{([^}]+)\}',s):
  vals=re.findall(r'[rgba]: ([^,}]+)',v)
  if vals:colors[prop]=list(map(float,vals))
 materials[p.stem]=dict(maps=maps,colors=colors)
write(a/'materials.json',materials)
scene=blocks(r/'Assets/Scenes/展厅.unity'); transforms={i:b for i,(t,b) in scene.items() if t==4}; objects={i:b for i,(t,b) in scene.items() if t==1}
components={}
for i,(t,b) in scene.items():
 go=ref(b,'m_GameObject')
 if go:components.setdefault(go,[]).append((t,b))
def node(i):
 b=transforms[i];go=ref(b,'m_GameObject');gb=objects.get(go,'');n=dict(name=field(gb,'m_Name'),position=vec(b,'m_LocalPosition'),quaternion=vec(b,'m_LocalRotation'),scale=vec(b,'m_LocalScale'),children=[])
 for t,c in components.get(go,[]):
  if t==33:
   m=re.search(r'm_Mesh: \{fileID: (\d+)(?:, guid: (\w+))?',c)
   if m:n['mesh']=m[1];n['meshGuid']=m[2]
  if t==23:
   m=re.search(r'm_Materials:\n  - \{fileID: \d+, guid: (\w+)',c)
   if m and m[1] in guid:n['material']=guid[m[1]].stem
  if t==102:n['text']=field(c,'m_Text')
 for j,c in transforms.items():
  if ref(c,'m_Father')==i:n['children'].append(node(j))
 return n
accessories=[node(i) for i,b in transforms.items() if field(objects.get(ref(b,'m_GameObject'),''),'m_Name') in ['LittleD_ChestIdentity','LittleD_HeadIdentity']]
write(a/'accessories.json',accessories)
# Preserve only robot-related scene records, never the hall geometry.
selected=[]
for n in accessories:
 selected.append(n['name'])
shutil.copy2(r/'Assets/Resources/RobotKnowledge/LabIntroduction.json',a/'knowledge.json')
voice=scene['777403075'][1]; instruction=json.loads(field(voice,'instructions'))
write(a/'robot-config.json',dict(name='小D',voice='Tina',model='qwen3.8-omni-flash-realtime',instructions=instruction+'\n当前运行在独立机器人网页中，没有展厅场景。不要声称能够导航、转场或播放展厅影片。',shell='#ffffff',glow='#24cca8',intensity=.8,speed=1,emotion=0))
write(out/'migration-manifest.json',dict(source='Assets/Scenes/展厅.unity → Rob13 / Rob13_Body',modelSha256=hashlib.sha256(fbx.read_bytes()).hexdigest(),animations=len(clips),accessories=selected,excluded=['展厅场景','空间导航与场景转场','展厅影片'],originalScripts=[p.name for p in (out/'source-unity').glob('*.cs')]))
print('Migrated:',len(clips),'animation clips;',len(materials),'materials;',len(accessories),'accessory roots')
