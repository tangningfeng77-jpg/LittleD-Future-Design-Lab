import * as T from './vendor/three/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export function buildCinematicFarm(w){
 const texture=w.cinematicPlantTexture;const material=new T.MeshBasicMaterial({map:texture,alphaTest:.47,side:T.DoubleSide});
 const time={value:0},growth={value:w.growth};material.onBeforeCompile=shader=>{shader.uniforms.farmTime=time;shader.uniforms.farmGrowth=growth;shader.vertexShader='uniform float farmTime; uniform float farmGrowth;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat above=max(0.0,position.y+.54);transformed.x += sin(farmTime*.9+position.y*2.2)*above*above*.009;transformed.y = (position.y+.54)*(.23+farmGrowth*.77)-.54;');};
 const plant=w.add(new T.PlaneGeometry(3.6,3.6,40,48),material,V(.75,.54,.06));plant.rotation.y=.24;plant.castShadow=false;w.cinematicPlant=plant;w.farmUniforms={time,growth};
 for(const c of w.plant.children)if(!w.fruits.includes(c))c.visible=false;for(const r of w.roots)r.visible=false;w.root.children[0].visible=false;
 const soil=w.soil.clone();soil.repeat.set(6,1.2);const side=new T.MeshStandardMaterial({map:soil,color:0x4c3522,roughness:1,bumpMap:soil,bumpScale:.12});const face=w.add(new T.PlaneGeometry(22,1.55,1,8),side,V(0,-.775,-.12));face.receiveShadow=true;const top=w.add(new T.PlaneGeometry(22,12,24,24),new T.MeshStandardMaterial({map:w.soil,color:0x725234,roughness:.98,bumpMap:w.soil,bumpScale:.13}),V(0,-.008,-6.12));top.rotation.x=-Math.PI/2;w.cinematicSoil=face;
 // The crown and fruits stay independent from the photographic botanical layer.
 const positions=[V(.30,1.24,.31),V(-.14,1.46,.23),V(.48,1.58,.19)];for(let i=0;i<w.fruits.length;i++){w.fruits[i].position.copy(positions[i]);w.fruits[i].children[0].material.roughness=.32;w.fruits[i].children[0].material.clearcoat=.48;}
 w.originalFruit=w.mainFruit.position.clone();w.basket.g.position.set(1.95,.03,.6);w.basket.pos.copy(w.basket.g.position);w.groundDropY=.15;
 // Micro droplets are actual instances on the skin, so their highlights follow the camera.
 const dropMat=new T.MeshPhysicalMaterial({color:0xffe4c2,roughness:.11,metalness:.05,transparent:true,opacity:.35,clearcoat:1});const drops=new T.InstancedMesh(new T.SphereGeometry(1,6,4),dropMat,86),o=new T.Object3D(),radius=w.mainFruit.userData.r;for(let i=0;i<86;i++){const y=-.8+(i%13)/13*1.6,a=i*2.399,s=Math.sqrt(1-y*y),rr=radius*1.007;o.position.set(Math.cos(a)*s*rr,y*rr*.91,Math.sin(a)*s*rr);o.scale.setScalar(.0023+(i%5)*.0007);o.updateMatrix();drops.setMatrixAt(i,o.matrix)}w.mainFruit.add(drops);
}
export function updateCinematicFarm(w){if(!w.farmUniforms||w.stage!==5)return;w.farmUniforms.time.value=w.time;w.farmUniforms.growth.value=w.growth;if(w.cinematicSoil)w.cinematicSoil.material.color.setRGB(.31-w.moisture*.08,.22-w.moisture*.07,.13-w.moisture*.04);}
