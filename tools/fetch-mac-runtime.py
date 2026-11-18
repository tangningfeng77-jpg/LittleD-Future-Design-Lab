import pathlib,urllib.request,json,hashlib,tarfile
out=pathlib.Path('output/robot-handoff-2026-10-30'); downloads=out/'downloads';downloads.mkdir(parents=True,exist_ok=True)
index=json.load(urllib.request.urlopen('https://nodejs.org/dist/index.json',timeout=60))
release=next(x for x in index if x['version'].startswith('v24.') and 'osx-arm64-tar' in x['files'])
version=release['version'];name=f'node-{version}-darwin-arm64.tar.gz';url=f'https://nodejs.org/dist/{version}/{name}'
checks=urllib.request.urlopen(f'https://nodejs.org/dist/{version}/SHASUMS256.txt',timeout=60).read().decode()
expected=next(l.split()[0] for l in checks.splitlines() if l.split()[-1]==name)
archive=downloads/name
if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:
 with urllib.request.urlopen(url,timeout=120) as response,archive.open('wb') as f:
  while data:=response.read(1024*1024):f.write(data)
actual=hashlib.sha256(archive.read_bytes()).hexdigest();assert actual==expected,'Node checksum mismatch'
runtime=out/'mac-runtime';runtime.mkdir(exist_ok=True)
with tarfile.open(archive,'r:gz') as t:
 for member in t.getmembers():
  rel=pathlib.PurePosixPath(member.name).relative_to(f'node-{version}-darwin-arm64')
  if str(rel) not in ['bin/node','LICENSE','README.md','CHANGELOG.md']:continue
  if member.isfile():
   dest=runtime/pathlib.Path(str(rel));dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(t.extractfile(member).read())
metadata={'version':version,'platform':'darwin-arm64','download_url':url,'archive_sha256':actual,'binary_sha256':hashlib.sha256((runtime/'bin/node').read_bytes()).hexdigest()}
(out/'runtime-provenance.json').write_text(json.dumps(metadata,indent=2),encoding='utf8')
print('Verified official Apple Silicon Node runtime:',version)
