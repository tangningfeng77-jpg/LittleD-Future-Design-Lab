import * as T from './vendor/three/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const random=i=>{const n=Math.sin(i*127.1+4.7)*43758.5453;return n-Math.floor(n)};
// One instanced draw per material keeps the riverbank alive without hundreds of objects.
export function naturalEnvironment(w){
 const river=w.stage===2||w.stage===3;const ground=w.root.children[0];ground.visible=!river;
 if(!river){ground.material.color.set(w.stage===1?0xb2a28a:0x7e7956);ground.material.bumpScale=.11;}
 w.naturalTime={value:0};w.naturalMoving=[];
 if(river){const water=new T.MeshPhysicalMaterial({color:0x275d63,metalness:.04,roughness:.21,transparent:true,opacity:.23,clearcoat:.8,side:T.DoubleSide});water.onBeforeCompile=shader=>{shader.uniforms.flowTime=w.naturalTime;shader.vertexShader='uniform float flowTime; varying vec2 bankUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbankUv=uv; transformed.z += sin(position.x*3.2+flowTime*.85)*.018 + sin(position.y*5.1-flowTime*1.2)*.012;');shader.fragmentShader='varying vec2 bankUv;\n'+shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a *= smoothstep(0.0,.15,bankUv.x)*smoothstep(0.0,.15,1.0-bankUv.x)*(1.0-smoothstep(.38,.72,bankUv.y));\n#include <opaque_fragment>');};const surface=w.add(new T.PlaneGeometry(24,20,64,48),water,V(0,-.12,0));surface.rotation.x=-Math.PI/2;surface.castShadow=false;
 }
 const rockGeo=new T.IcosahedronGeometry(1,2),a=rockGeo.attributes.position;for(let i=0;i<a.count;i++){const k=.88+random(Math.round(a.getX(i)*77+a.getY(i)*127+a.getZ(i)*39))* .2;a.setXYZ(i,a.getX(i)*k,a.getY(i)*k,a.getZ(i)*k)}rockGeo.computeVertexNormals();const rockMat=new T.MeshStandardMaterial({color:0x6e7566,map:w.soil,roughness:.96,bumpMap:w.soil,bumpScale:.12});const rocks=new T.InstancedMesh(rockGeo,rockMat,70);const dummy=new T.Object3D();
 for(let i=0;i<70;i++){const side=i%2?1:-1,x=side*(3+random(i+9)*6),z=-4+random(i+90)*12,r=.09+random(i+22)*.31;dummy.position.set(x,river?-.03:-.06,z);dummy.scale.set(r*1.5,r*.6,r);dummy.rotation.set(random(i),random(i+3)*6,random(i+6)*.3);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix)}rocks.castShadow=false;rocks.receiveShadow=true;w.root.add(rocks);
 const grassGeo=new T.PlaneGeometry(.045,.36,1,4);grassGeo.translate(0,.18,0);const pos=grassGeo.attributes.position;for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setX(i,pos.getX(i)*(1-y/.4));pos.setZ(i,y*y*.6)}grassGeo.computeVertexNormals();const grassMat=new T.MeshStandardMaterial({color:0x425b2b,roughness:.87,side:T.DoubleSide});grassMat.onBeforeCompile=shader=>{shader.uniforms.windTime=w.naturalTime;shader.vertexShader='uniform float windTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(windTime*1.35+instanceMatrix[3].x*.8+instanceMatrix[3].z)*position.y*position.y*.45;');};
 const grass=new T.InstancedMesh(grassGeo,grassMat,520);for(let i=0;i<520;i++){const side=i%2?1:-1;dummy.position.set(side*(2.8+random(i+10)*5),river?-.025:-.04,-3+random(i+80)*11);dummy.rotation.set(0,random(i+7)*6.28,random(i+40)*.3-.15);dummy.scale.setScalar(.7+random(i+56)*.8);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix)}grass.castShadow=false;w.root.add(grass);
 // A few taller reeds anchor the waterline and sway at a different pace.
 if(river){const reeds=new T.Group();reeds.position.set(-3.15,-.08,.8);w.root.add(reeds);const material=new T.MeshStandardMaterial({color:0x657744,roughness:.9});for(let i=0;i<14;i++){const h=.5+random(i+67)*.8;const stem=w.add(new T.CylinderGeometry(.008,.014,h,5),material,V(random(i)*.7,h/2,random(i+3)*.4),reeds);stem.rotation.z=(random(i+2)-.5)*.18;}w.naturalMoving.push(reeds)}
 w.scene.fog.color.set(0x708b81);w.scene.fog.density=.009;
}
export function naturalBasin(w,x,z,{salt=false,r=.53,h=1.85}={}){
 const g=new T.Group();g.position.set(x,0,z);w.root.add(g);const small=h<1,depth=small?.33:.54,rr=small?r*1.8:r*1.65;const stone=new T.MeshStandardMaterial({color:0x777b68,map:w.soil,roughness:.92,bumpMap:w.soil,bumpScale:.07});const rim=w.add(new T.TorusGeometry(rr,.065,10,64),stone,V(0,.13,0),g);rim.rotation.x=Math.PI/2;const lining=w.add(new T.CylinderGeometry(rr,rr*.9,depth,48,1,true),stone,V(0,.13-depth/2,0),g);const floor=w.add(new T.CircleGeometry(rr*.91,48),new T.MeshStandardMaterial({color:0x263d36,roughness:.85}),V(0,.14-depth,0),g);floor.rotation.x=-Math.PI/2;
 const mat=new T.MeshPhysicalMaterial({color:salt?0xa98348:0x3b9aaf,roughness:.18,metalness:.12,transparent:true,opacity:.86,clearcoat:1});const liquid=w.add(new T.CircleGeometry(rr*.94,48),mat,V(0,.16-depth,0),g);liquid.rotation.x=-Math.PI/2;liquid.castShadow=false;const setLevel=f=>{liquid.position.y=.15-depth+Math.min(1,Math.max(0,f))*(depth-.04)};
 const stand=w.add(new T.BoxGeometry(.055,.5,.045),w.darkMetal,V(rr*.8,.2,-rr*.45),g);const plate=w.add(new T.BoxGeometry(.45,.17,.025),w.darkMetal,V(rr*.8,.47,-rr*.45),g);
 return{g,shell:lining,liquid,setLevel,pos:V(x,h/2,z),h,r:rr};
}
export function softenNaturalEquipment(w){
 // No exhibition plinth, lighting gantry or instrument cabinets in the landscape.
 if(w.stage===3){const group=w.membraneLayerGroup;group.children.forEach(o=>{if(o.geometry?.type==='PlaneGeometry'&&o.geometry.parameters.width<1.8)o.visible=false});}
 if(w.stage===4){w.valveWheel.children.forEach(o=>{if(o.material?.color)o.material.color.set(0x426c60)});w.pipe([[.7,.0,-.35],[.7,1.6,-.35],[.7,2.1,-.15]],.035,false);}
 if(w.stage===5){w.soilMaterial.color.set(0x887751);w.groundDropY=.1;
  const smallGeo=w.leafGeo();for(const l of w.leaves){l.leaf.scale.set(.72,.78,1);for(let i=0;i<4;i++){const side=i%2?1:-1,leaf=w.add(smallGeo,w.leafMat,V(.12+(i>>1)*.095,.05+(i>>1)*.055,side*.09),l.group);leaf.scale.set(.35,.37,.6);leaf.rotation.set(side*.75,side*.65,-.8+side*.2);leaf.castShadow=false;}}
  // Lateral shoots break up the straight silhouette; they share the existing botanical material.
  for(let i=0;i<3;i++){const y=.5+i*.45;w.add(new T.TubeGeometry(new T.CatmullRomCurve3([V(0,y,0),V(-.12,y+.12,-.03),V(-.25,y+.28,-.06)]),12,.009,7,false),w.stemMat,V(),w.plant)}
 }

}
export function updateNatural(w,dt){if(w.naturalTime)w.naturalTime.value=w.time;for(const [i,o]of(w.naturalMoving||[]).entries())o.rotation.z=Math.sin(w.time*.8+i)*.025;}
