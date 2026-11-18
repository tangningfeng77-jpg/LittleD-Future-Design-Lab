import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three/build/three.module.js';
import {FBXLoader} from '../public/vendor/three/examples/jsm/loaders/FBXLoader.js';
THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
globalThis.window={URL:{createObjectURL:()=>''}};
const url=n=>new URL('../public/assets/'+n,import.meta.url);
const meta=JSON.parse(fs.readFileSync(url('animations.json'),'utf8'));
const b=fs.readFileSync(url('Rob13.fbx'));const robot=new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
for(const n of ['Rob13_Body','Eyes','MouthEmo','MouthSpeach','Rob13_Glass','hip','head'])assert(robot.getObjectByName(n),`missing ${n}`);
assert.equal(meta.length,36);const mesh=robot.getObjectByName('Rob13_Body');let samples=0;
for(const item of meta){const clip=robot.animations.find(c=>c.name===item.take);assert(clip,'missing clip '+item.take);assert(clip.duration>0);const mixer=new THREE.AnimationMixer(robot);mixer.clipAction(clip).play();for(const t of [0,.25,.5,.9]){mixer.setTime(clip.duration*t);robot.updateMatrixWorld(true);mesh.skeleton.update();robot.traverse(n=>assert(n.matrixWorld.elements.every(Number.isFinite),'invalid matrix '+n.name));for(let i=0;i<mesh.geometry.attributes.position.count;i+=167){const v=mesh.getVertexPosition(i,new THREE.Vector3());assert(v.toArray().every(Number.isFinite),'invalid skin '+clip.name);}samples++;}mixer.stopAllAction();mixer.uncacheRoot(robot);}
const extras=JSON.parse(fs.readFileSync(url('accessories.json'),'utf8'));assert.equal(extras.length,2);assert.equal(extras.flatMap(x=>x.children).filter(x=>x.name.includes('Antenna beacon')).length,2);
const mats=JSON.parse(fs.readFileSync(url('materials.json'),'utf8'));for(const m of Object.values(mats))for(const p of Object.values(m.maps))assert(fs.existsSync(url(p)),p);
const knowledge=JSON.parse(fs.readFileSync(url('knowledge.json'),'utf8'));assert(knowledge.pages.length>0);
console.log(`PASS: ${meta.length} animations / ${samples} sampled poses; skeleton, skin, accessories, textures, knowledge.`);
