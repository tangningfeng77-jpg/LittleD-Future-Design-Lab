import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VideoCompanion} from '../public/video-companion.js';
globalThis.document={getElementById:()=>({dataset:{}})};
const scene=new THREE.Scene(),robot=new THREE.Group(),head=new THREE.Bone();head.name='head';robot.add(head);robot.position.set(0,0,1.9);scene.add(robot);
const camera=new THREE.PerspectiveCamera(45,16/9,.05,60);camera.position.set(0,1.6,5.6);camera.lookAt(0,.95,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
const events=[];const companion=new VideoCompanion({robot,camera,scene,perform:(...a)=>events.push(a),emote(){}});
const outgoing=companion.moveToCorner();companion.update(companion.transition.at+2000);await outgoing;assert.equal(companion.amount,1);assert.equal(companion.root.position.y,0,'the robot must remain above the floor rather than clipping through it');
const projected=companion.root.position.clone().project(camera);assert(Math.abs(projected.x-.79)<.001);assert(Math.abs(projected.y+.90)<.001);
companion.watch();for(let n=0;n<100;n++){companion.beforeAnimation();companion.update(companion.watchAt+100+n*16);}assert(Math.abs(head.rotation.y)<.15,'watching head tilt must not accumulate across frames');
const incoming=companion.returnToCenter();companion.beforeAnimation();companion.update(companion.transition.at+2000);await incoming;assert.equal(companion.amount,0);assert(companion.root.position.distanceTo(companion.home)<.0001);assert.equal(companion.root.scale.x,companion.baseScale);assert.equal(companion.mode,'center');assert(events.some(e=>e[0]==='walk'));
console.log('PASS: walk to lower-right at ground level; stable nonaccumulating watching pose; walk back restores exact center and scale.');

// Check the real FBX root motion; a plain parent-position test missed this drift.
const {readFileSync}=await import('node:fs');
const {FBXLoader}=await import('../public/vendor/three/examples/jsm/loaders/FBXLoader.js');
const {makeInPlaceWalk}=await import('../public/video-companion.js');
THREE.TextureLoader.prototype.load=()=>new THREE.Texture();globalThis.window={URL:{createObjectURL:()=>''}};
const bytes=readFileSync(new URL('../public/assets/Rob13.fbx',import.meta.url));
const model=new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const walk=model.animations.find(c=>c.name.endsWith('_walk')),idle=model.animations.find(c=>c.name.endsWith('_Idle'));
const fixed=makeInPlaceWalk(walk,idle),rootTrack=fixed.tracks.find(t=>t.name==='root.position');
const baseline=idle.tracks.find(t=>t.name==='root.position').values;
for(let i=0;i<rootTrack.values.length;i+=3){assert.equal(rootTrack.values[i],baseline[0]);assert.equal(rootTrack.values[i+2],baseline[2]);}
assert.equal(fixed.duration,walk.duration);assert.notDeepEqual(fixed.tracks.find(t=>t.name==='root.position').values,walk.tracks.find(t=>t.name==='root.position').values,'fix must not mutate the original FBX clip');
const mixer=new THREE.AnimationMixer(model),step=mixer.clipAction(fixed);step.play();
for(let n=0;n<180;n++){mixer.update(1/60);assert(Math.abs(model.getObjectByName('root').position.z-baseline[2])<.00001,'looping walking steps must not drift or snap back at the destination');}
console.log('PASS: actual FBX walk retains its steps with zero root drift, including across animation loops.');
