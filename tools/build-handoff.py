from pathlib import Path
import shutil,json,hashlib,struct,subprocess,zipfile,os,stat,re
workspace=Path.cwd();project=workspace/'robot-html';out=workspace/'output/robot-handoff-2026-10-30';stage=out/'LittleD-Complete'
shutil.copytree(project,stage,dirs_exist_ok=True)
# Keep both the saved browser values and source defaults for review.
shutil.copy2(stage/'public/assets/robot-config.json',stage/'handoff/source-default-config.json')
current=json.loads((stage/'handoff/current-browser-config.json').read_text(encoding='utf-8-sig'))
assert isinstance(current.get('instructions'),str) and isinstance(current.get('voice'),str)
(stage/'public/assets/robot-config.json').write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding='utf8')
private=project/'.env.local'
if not private.exists():private=workspace/'.env.local'
assert private.is_file(),'AI environment file missing'
shutil.copy2(private,stage/'.env.local')
settings={}
for line in private.read_text(encoding='utf-8-sig').splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  key,value=line.split('=',1);settings[key.strip()]=value.strip().strip('\"\'')
assert settings.get('DASHSCOPE_API_KEY') and settings.get('DASHSCOPE_WORKSPACE_ID'),'AI settings incomplete'
mac=stage/'runtime/darwin-arm64';shutil.copytree(out/'mac-runtime',mac,dirs_exist_ok=True)
header=(mac/'bin/node').read_bytes()[:16];assert header[:4]==bytes.fromhex('cffaedfe') and struct.unpack('<I',header[4:8])[0]==0x0100000c,'Runtime is not Apple Silicon Mach-O'
windows=stage/'runtime/win32-x64';windows.mkdir(parents=True,exist_ok=True);node=Path(shutil.which('node'));shutil.copy2(node,windows/'node.exe');shutil.copy2(mac/'LICENSE',windows/'LICENSE')
provenance=json.loads((out/'runtime-provenance.json').read_text());provenance['windows_backup']={'version':subprocess.check_output([str(node),'--version'],text=True).strip(),'source':'Existing Codex Node runtime on the source Windows machine','binary_sha256':hashlib.sha256((windows/'node.exe').read_bytes()).hexdigest()}
(stage/'handoff/runtime-provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2),encoding='utf8')
# Original FBX import metadata and editable Rob13 assets are retained alongside
# the standalone web assets. No Unity installation is required to run the web app.
base=workspace/'Assets/GrigoriyArx/DrollRobots';dest=stage/'source-unity/original-robot-assets'
for rel in ['Art/Meshes/Robots/Rob13Emo04','Art/Textures/Robots/Rob13','Art/Materials/Robots/Rob13','Scripts']:
 src=base/rel;shutil.copytree(src,dest/rel,dirs_exist_ok=True)
 if Path(str(src)+'.meta').exists():shutil.copy2(Path(str(src)+'.meta'),Path(str(dest/rel)+'.meta'))
for rel in ['Art/Animations/Rob13.controller','Art/Animations/Rob13.controller.meta','Prefabs/Robots/Rob13.prefab','Prefabs/Robots/Rob13.prefab.meta','Art/Textures/Emotions4.png','Art/Textures/Emotions4.png.meta','Art/Textures/Curves.png','Art/Textures/Curves.png.meta']:
 src=base/rel
 if src.exists():target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,target)
# Resolve any remaining GUID-linked raw robot dependencies (including atlas metadata).
index={}
for folder in [base,workspace/'Assets/ResearchCenter/LittleD']:
 for meta in folder.rglob('*.meta'):
  match=re.search(r'^guid: ([a-f0-9]{32})',meta.read_text(encoding='utf8',errors='ignore'),re.M)
  if match:index[match[1]]=Path(str(meta)[:-5])
known=set()
for meta in (stage/'source-unity').rglob('*.meta'):
 match=re.search(r'^guid: ([a-f0-9]{32})',meta.read_text(encoding='utf8',errors='ignore'),re.M)
 if match:known.add(match[1])
added=[]
for iteration in range(8):
 wanted=set()
 for f in (stage/'source-unity').rglob('*'):
  if f.is_file() and f.suffix.lower() in ['.mat','.prefab','.controller','.meta','.asset','.shader']:
   wanted.update(re.findall(r'guid: ([a-f0-9]{32})',f.read_text(encoding='utf8',errors='ignore')))
 missing=[g for g in wanted-known if g in index]
 if not missing:break
 for g in missing:
  src=index[g];target=stage/'source-unity/dependency-assets'/src.relative_to(workspace);target.parent.mkdir(parents=True,exist_ok=True)
  if src.is_file():shutil.copy2(src,target)
  shutil.copy2(Path(str(src)+'.meta'),Path(str(target)+'.meta'));known.add(g);added.append(src.relative_to(workspace).as_posix())
(stage/'handoff/extra-source-dependencies.json').write_text(json.dumps(added,ensure_ascii=False,indent=2),encoding='utf8')
files=[]
for p in sorted(stage.rglob('*')):
 if not p.is_file() or p.name=='TRANSFER_MANIFEST.json':continue
 files.append({'path':p.relative_to(stage).as_posix(),'size':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
manifest={'project':'LittleD complete standalone HTML project','created_date':'2026-10-30','target':'macOS Apple Silicon','file_count':len(files),'uncompressed_bytes':sum(f['size'] for f in files),'private_files':['.env.local'],'browser_config':'handoff/current-browser-config.json','model_animations':36,'runtime':provenance,'files':files}
(stage/'TRANSFER_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(out/'staging-summary.json').write_text(json.dumps({k:manifest[k] for k in ['project','target','file_count','uncompressed_bytes','private_files','model_animations']},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'stage':str(stage),'files':len(files),'size_MiB':round(manifest['uncompressed_bytes']/1048576,1),'mac_runtime':provenance['version'],'ai_local_config':'included (values not logged)','browser_configuration':'included'},ensure_ascii=False))
