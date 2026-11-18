import urllib.request,tarfile,io,pathlib
root=pathlib.Path('robot-html')
for name,ver in [('three','0.180.0'),('ws','8.18.3')]:
 data=urllib.request.urlopen(f'https://registry.npmjs.org/{name}/-/{name}-{ver}.tgz').read()
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as t:
  target=root/('public/vendor/three' if name=='three' else 'node_modules/ws')
  target.mkdir(parents=True,exist_ok=True)
  for m in t.getmembers():
   if m.isfile():
    rel=pathlib.PurePosixPath(m.name).relative_to('package')
    if name=='three' and not (str(rel).startswith('build/') or str(rel).startswith('examples/jsm/')): continue
    p=target/pathlib.Path(str(rel));p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(t.extractfile(m).read())
 print(name,ver,'installed')
