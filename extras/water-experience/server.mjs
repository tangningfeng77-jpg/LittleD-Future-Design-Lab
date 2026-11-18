import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.task':'application/octet-stream','.md':'text/plain; charset=utf-8'};
let port=Number(process.env.PORT||4180);
const server=http.createServer((req,res)=>{let filename;try{const url=new URL(req.url,'http://localhost');filename=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname))}catch{res.writeHead(400);return res.end()}
if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404);return res.end('Not found')}
res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');fs.createReadStream(filename).pipe(res)});
server.on('error',e=>{if(e.code==='EADDRINUSE'&&port<4200){server.listen(++port,'127.0.0.1')}else{console.error(e);process.exit(1)}});
server.on('listening',()=>{const url=`http://127.0.0.1:${port}`;console.log('水域手势体验：'+url);if(process.argv.includes('--open'))spawn('open',[url],{stdio:'ignore'}).on('error',()=>{})});server.listen(port,'127.0.0.1');
