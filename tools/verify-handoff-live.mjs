import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';import http from 'node:http';import net from 'node:net';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),pub=path.join(root,'public');
const exists=p=>assert(fs.existsSync(p),'Missing dependency: '+path.relative(root,p));
for(const dir of [pub,path.join(pub,'vendor/three')])exists(dir);
const resolveImport=(file,spec)=>spec==='three'?path.join(pub,'vendor/three/build/three.module.js'):spec.startsWith('three/addons/')?path.join(pub,'vendor/three/examples/jsm',spec.slice(13)):spec.startsWith('.')?path.resolve(path.dirname(file),spec):null;
let imports=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(p.endsWith('.js')){for(const match of fs.readFileSync(p,'utf8').matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){const target=resolveImport(p,match[1]);if(target){exists(target);imports++;}}}}}walk(pub);
for(const p of ['Rob13.fbx','animations.json','materials.json','accessories.json','robot-config.json','knowledge.json','lab-background.png'])exists(path.join(pub,'assets',p));
const mats=JSON.parse(fs.readFileSync(path.join(pub,'assets/materials.json'),'utf8'));for(const m of Object.values(mats))for(const tex of Object.values(m.maps))exists(path.join(pub,'assets',tex));
const probe=port=>new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});let port=4196;while(!await probe(port))port++;
const env={...process.env,PORT:String(port)};delete env.DASHSCOPE_API_KEY;delete env.DASHSCOPE_WORKSPACE_ID;
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let startupError='';child.stderr.on('data',()=>startupError='The isolated server reported an error.');
try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Isolated server startup timed out')),15000);child.once('error',reject);child.stdout.on('data',d=>{if(d.toString().includes('http://127.0.0.1:')){clearTimeout(timeout);resolve();}});child.once('exit',c=>{if(c)reject(Error(startupError||'Isolated server failed'));});});
 const get=p=>new Promise((resolve,reject)=>http.get(`http://127.0.0.1:${port}${p}`,r=>{const chunks=[];r.on('data',c=>chunks.push(c));r.on('end',()=>resolve({code:r.statusCode,data:Buffer.concat(chunks)}));}).on('error',reject));
 for(const p of ['/','/app.js','/photo-stage.js','/material-finish.js','/capture-worklet.js','/vendor/three/build/three.module.js','/assets/Rob13.fbx','/assets/lab-background.png']){const result=await get(p);assert.equal(result.code,200,p);assert(result.data.length,p);}
 const status=await get('/api/status');assert.equal(JSON.parse(status.data).configured,true,'Private AI config did not load independently');assert.equal((await get('/%2e%2e%2f.env.local')).code,404);assert.equal((await get('/.env.local')).code,404);
 console.log(`PASS: ${imports} local module references; assets/textures; isolated HTTP server; local AI configuration; secret paths denied.`);
}finally{child.kill();}
