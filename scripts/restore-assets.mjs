import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'packed-assets/manifest.json'),'utf8'));
const digest=p=>new Promise((resolve,reject)=>{const hash=createHash('sha256');const input=fs.createReadStream(p);input.on('data',b=>hash.update(b));input.on('end',()=>resolve(hash.digest('hex')));input.on('error',reject)});
for(const asset of manifest){
 const target=path.resolve(root,asset.path);if(!target.startsWith(root+path.sep))throw Error('Invalid asset path');
 if(fs.existsSync(target)&&fs.statSync(target).size===asset.size&&await digest(target)===asset.sha256)continue;
 fs.mkdirSync(path.dirname(target),{recursive:true});const temp=target+'.restoring';
 try{const fd=fs.openSync(temp,'w');try{for(const part of asset.parts){const input=path.resolve(root,part.path);if(!input.startsWith(root+path.sep))throw Error('Invalid part path');const data=fs.readFileSync(input);if(data.length!==part.size||createHash('sha256').update(data).digest('hex')!==part.sha256)throw Error('Missing or damaged part: '+part.path);let offset=0;while(offset<data.length)offset+=fs.writeSync(fd,data,offset,data.length-offset);}}finally{fs.closeSync(fd)}
 if(fs.statSync(temp).size!==asset.size||await digest(temp)!==asset.sha256)throw Error('Asset checksum mismatch: '+asset.path);
 fs.renameSync(temp,target);console.log('Restored: '+asset.path);
 }catch(e){fs.rmSync(temp,{force:true});throw e;}
}
