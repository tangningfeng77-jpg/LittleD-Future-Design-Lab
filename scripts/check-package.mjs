import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync(process.execPath,['scripts/restore-assets.mjs'],{cwd:root,stdio:'inherit'});
for(const file of ['server.mjs','web-search.mjs','gd-proxy.mjs','remote.mjs','public/gooddesign.js','public/gd-screen.js','public/gd-tour.js','public/gd-deck.js','public/gd-guide.js','public/gd-controls.js','public/gd-hall.js','public/app.js','public/voice.js','public/tour-flow.js','public/guide-flow.js','public/assets/ifs-project/player.mjs','public/assets/ifs-project/hands.mjs','public/assets/ifs-project/motion.mjs','public/assets/ifs-project/gesture-worker.mjs'])execFileSync(process.execPath,['--check',file],{cwd:root,stdio:'inherit'});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'CONTENT-MANIFEST.json')));let checked=0;
for(const asset of manifest.files){const file=path.join(root,asset.path);if(!fs.existsSync(file))throw Error('Missing: '+asset.path);const raw=fs.readFileSync(file);if(raw.length!==asset.bytes||createHash('sha256').update(raw).digest('hex')!==asset.sha256)throw Error('Damaged: '+asset.path);checked++;}
console.log('PASS: scripts and '+checked+' content files verified');
