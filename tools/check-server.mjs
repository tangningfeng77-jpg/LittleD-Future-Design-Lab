import http from 'node:http';import assert from 'node:assert/strict';
for(const p of ['/','/app.js','/voice.js','/assets/Rob13.fbx','/api/status','/../.env.local','/%2e%2e%2f.env.local']){
 await new Promise((resolve,reject)=>http.get('http://127.0.0.1:4173'+p,r=>{const secret=p.includes('.env');assert.equal(r.statusCode,secret?404:200,p);let n=0;r.on('data',b=>n+=b.length);r.on('end',()=>{assert(n||secret);console.log(p,r.statusCode);resolve();});}).on('error',reject));
}
