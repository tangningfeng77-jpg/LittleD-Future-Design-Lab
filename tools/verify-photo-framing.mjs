import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three/build/three.module.js';
import {fitPhotoFov} from '../public/photo-stage.js';
const source=new THREE.PerspectiveCamera(55,1.5,.05,60);source.position.set(0,1.65,6);source.lookAt(0,.95,0);source.updateMatrixWorld(true);
for(const aspect of [.7,1.18,1.5,1.9,2.5,3.2]){
 const c=source.clone();c.aspect=aspect;c.fov=fitPhotoFov(aspect);c.updateProjectionMatrix();c.updateMatrixWorld(true);
 for(const x of [-1,1])for(const y of [-1,1]){const p=new THREE.Vector3(x,y,.5).unproject(c),ray=p.sub(c.position);const wall=c.position.clone().addScaledVector(ray,(-1.15-c.position.z)/ray.z);const uv=wall.project(source);assert(Math.abs(uv.x)<1&&Math.abs(uv.y)<1,'viewport outside photograph at aspect '+aspect);}
 assert.equal(c.aspect,aspect,'camera must retain viewport aspect');
}
console.log('PASS: portrait, normal and ultrawide viewports stay inside the source image without edge extension.');
