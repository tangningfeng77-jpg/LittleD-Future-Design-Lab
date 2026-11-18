from pathlib import Path
import json
root=Path('robot-html')
report={'source_platform':'Windows x64','target_platform':'macOS Apple Silicon','checks':{'all_36_animations_and_144_pose_samples':'passed','smooth_motion':'passed','speech_expression':'passed','photo_framing':'passed','isolated_server_assets_and_63_module_references':'passed','package_local_ai_settings_without_parent_environment':'passed','private_env_not_http_accessible':'passed','official_mac_runtime_sha256':'passed','mac_runtime_mach_o_arm64_header':'passed'},'mac_execution':'Official ARM64 executable verified; not executed on an actual Mac in this Windows session.'}
(root/'handoff/verification-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
p=root/'从这里开始-Mac.md';s=p.read_text(encoding='utf-8-sig').replace('## 包内内容','浏览器里尚未保存的表单草稿另存于 `handoff/browser-form-draft.json`，当前页面可见聊天记录保存于 `handoff/current-page-transcript.txt`，供你对照恢复。\n\n## 包内内容');s+='\n核验说明：本次在 Windows 上完成了隔离运行和全部文件核验；Mac 的官方 ARM64 运行环境已核对官方 SHA-256 与二进制架构，尚未在真实 Mac 上执行。详细结果见 `handoff/verification-report.json`。\n';p.write_text(s,encoding='utf8')
p=root/'tools/build-handoff.py';s=p.read_text(encoding='utf-8-sig');s=s.replace('import shutil,json,hashlib,struct,subprocess,zipfile,os,stat','import shutil,json,hashlib,struct,subprocess,zipfile,os,stat,re')
marker='files=[]\n'
extra='''# Resolve any remaining GUID-linked raw robot dependencies (including atlas metadata).
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
'''
s=s.replace(marker,extra+marker);p.write_text(s,encoding='utf8')
