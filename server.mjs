import {searchWeb} from './web-search.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
const root=path.dirname(fileURLToPath(import.meta.url)),pub=path.join(root,'public');
// Secrets remain on this loopback server. Browser files cannot access .env.local.
for(const p of [path.join(root,'.env.local'),path.join(root,'..','.env.local')]){
 if(fs.existsSync(p))for(const line of fs.readFileSync(p,'utf8').split(/\r?\n/)){
 const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
 }
}
const config=()=>JSON.parse(fs.readFileSync(path.join(pub,'assets/robot-config.json'),'utf8').replace(/^\uFEFF/,''));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.fbx':'application/octet-stream','.css':'text/css; charset=utf-8','.mov':'video/quicktime','.mp4':'video/mp4','.m4a':'audio/mp4','.wav':'audio/wav','.wasm':'application/wasm','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 if(new URL(req.url,'http://localhost').pathname==='/api/search'){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');try{const q=new URL(req.url,'http://localhost').searchParams.get('q');return res.end(JSON.stringify(await searchWeb(q)));}catch{return res.end(JSON.stringify({results:[],error:'联网查询暂不可用，请使用已确认的知识回答，不编造结论。'}));}}
 if(req.url==='/api/status'){res.setHeader('Content-Type',mime['.json']);return res.end(JSON.stringify({configured:!!(process.env.DASHSCOPE_API_KEY&&process.env.DASHSCOPE_WORKSPACE_ID),provider:'阿里百炼',model:config().model}));}
 const urlPath=new URL(req.url,'http://localhost').pathname;
 const reference=urlPath==='/references'||urlPath.startsWith('/references/');
 const staticRoot=reference?path.join(root,'资料'):pub;
 let p;try{p=path.resolve(staticRoot,'.'+decodeURIComponent(reference?urlPath.slice('/references'.length)||'/':urlPath));}catch{res.writeHead(400);return res.end();}
 if(reference&&fs.existsSync(p)&&fs.statSync(p).isDirectory()){
  if(!urlPath.endsWith('/')){res.writeHead(302,{Location:urlPath+'/'});return res.end();}
  if(!p.startsWith(staticRoot+path.sep)&&p!==staticRoot){res.writeHead(404);return res.end();}
  const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>小D原始资料</title><h1>小D原始资料</h1><ul>'+fs.readdirSync(p,{withFileTypes:true}).map(e=>'<li><a href="'+encodeURIComponent(e.name)+(e.isDirectory()?'/':'')+'">'+escape(e.name)+'</a></li>').join('')+'</ul>');return;
 }

 if(req.url==='/')p=path.join(pub,'index.html');
 if(!p.startsWith(staticRoot+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);return res.end('Not found');}
 res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');
 if(['.html','.js','.mjs','.css'].includes(path.extname(p)))res.setHeader('Cache-Control','no-store');
 const size=fs.statSync(p).size;res.setHeader('Accept-Ranges','bytes');
 let start=0,end=size-1,partial=false;
 if(req.headers.range){const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));end=m[1]&&m[2]?Math.min(Number(m[2]),size-1):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}partial=true;res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);}
 res.setHeader('Content-Length',Math.max(0,end-start+1));if(req.method==='HEAD')return res.end();
 const stream=fs.createReadStream(p,partial?{start,end}:undefined);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
});
const wss=new WebSocketServer({noServer:true,maxPayload:1024*1024});
server.on('upgrade',(req,socket,head)=>{
 const origin=req.headers.origin;const port=server.address().port;
 const allowedOrigins=['http://127.0.0.1:'+port,'http://localhost:'+port];
 if(process.env.PUBLIC_ORIGIN){try{allowedOrigins.push(new URL(process.env.PUBLIC_ORIGIN).origin);}catch{}}
 if(req.url!='/realtime'||!allowedOrigins.includes(origin)){socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
});
wss.on('connection',client=>{
 const key=process.env.DASHSCOPE_API_KEY,workspace=process.env.DASHSCOPE_WORKSPACE_ID;
 const fail=message=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify({type:'relay.error',message}));};
 if(!key||!workspace||!/^[a-zA-Z0-9-]+$/.test(workspace)){fail('未配置百炼密钥或业务空间 ID。请在本地 .env.local 中配置。');client.close();return;}
 const upstream=new WebSocket(`wss://${workspace}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=${encodeURIComponent(config().model)}`,{headers:{Authorization:'Bearer '+key},handshakeTimeout:15000});
 const allowed=new Set(['session.update','input_audio_buffer.append','input_audio_buffer.commit','input_audio_buffer.clear','input_image_buffer.append','response.create','response.cancel','conversation.item.create']);
 client.on('message',data=>{try{const e=JSON.parse(data);if(allowed.has(e.type)&&upstream.readyState===WebSocket.OPEN)upstream.send(JSON.stringify(e));}catch{fail('消息格式错误');}});
 upstream.on('message',data=>{if(client.readyState===WebSocket.OPEN)client.send(data.toString());});
 upstream.on('error',()=>{fail('百炼连接失败，请检查网络、密钥、业务空间和模型权限。');client.close();});
 upstream.on('close',()=>client.close());client.on('close',()=>upstream.close());client.on('error',()=>upstream.close());
});
const port=Number(process.env.PORT||4173);server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`小D HTML: http://127.0.0.1:${port}`));
