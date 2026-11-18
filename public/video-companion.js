import * as THREE from 'three';
const smooth=t=>t*t*(3-2*t);
// The original walk advances its root by 1.5 units and snaps back on Idle.
// Keep its steps, but let the presentation parent alone control travel.
export function makeInPlaceWalk(clip,idle){
 const result=clip.clone();
 for(const track of result.tracks){
  if(track.name!=='root.position')continue;
  const neutral=idle?.tracks.find(t=>t.name===track.name)?.values||track.values;
  for(let i=0;i<track.values.length;i+=3){track.values[i]=neutral[0];track.values[i+2]=neutral[2];}
 }
 return result;
}
// Move an independent parent, so the FBX walk animation cannot overwrite travel.
export class VideoCompanion {
 constructor({robot,camera,scene,contact,perform,emote}){
  Object.assign(this,{robot,camera,contact,perform,emote});
  this.root=new THREE.Group();this.root.name='LittleD presentation position';
  this.home=robot.position.clone();this.baseScale=.87;this.root.scale.setScalar(this.baseScale);this.root.position.copy(this.home);scene.add(this.root);this.root.add(robot);robot.position.set(0,0,0);
  this.amount=0;this.mode='center';this.head=robot.getObjectByName('head');this.nextCue=0;
 }
 move(to){
  this.transition?.resolve();this.watching=false;this.mode=to?'moving-out':'moving-home';this.perform('walk');
  return new Promise(resolve=>{this.transition={from:this.amount,to,at:performance.now(),duration:1900,resolve};});
 }
 moveToCorner(){return this.move(1);}
 returnToCenter(){if(this.amount===0&&!this.transition){this.watching=false;this.mode='center';return Promise.resolve();}return this.move(0);}
 watch(){this.mode='watching';this.watching=true;this.watchAt=performance.now();this.nextCue=0;this.perform('Idle');this.emote(1);}
 beforeAnimation(){if(this.headBase&&this.head){this.head.quaternion.copy(this.headBase);this.headBase=null;}}
 update(now){
  if(this.transition){const tr=this.transition,t=Math.min(1,(now-tr.at)/tr.duration);this.amount=THREE.MathUtils.lerp(tr.from,tr.to,smooth(t));
   if(t>=1){this.transition=null;this.mode=tr.to?'corner':'center';this.perform('Idle');this.emote(0);tr.resolve();}}
  if(this.amount>0){
   this.camera.updateMatrixWorld();
   const ray=new THREE.Vector3(.79,-.90,.5).unproject(this.camera).sub(this.camera.position);
   const corner=this.camera.position.clone().addScaledVector(ray,-this.camera.position.y/ray.y);
   const homeDepth=-this.home.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
   const cornerDepth=-corner.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
   this.root.position.copy(this.home).lerp(corner,this.amount);
   this.root.scale.setScalar(this.baseScale*THREE.MathUtils.lerp(1,.52*cornerDepth/homeDepth,this.amount));
   // No lateral swivel during travel; both journeys go straight to their endpoint.
   this.root.rotation.y=this.watching?-.16:0;
  }else{this.root.position.copy(this.home);this.root.scale.setScalar(this.baseScale);this.root.rotation.y=0;}
  if(this.contact){this.contact.visible=this.amount<.98;this.contact.position.x=this.root.position.x;this.contact.position.z=this.root.position.z;this.contact.material.opacity=1-this.amount;}
  if(this.watching){
   const elapsed=(now-this.watchAt)/1000;
   if(now>=this.nextCue){const beat=Math.floor(elapsed/16)%3;this.perform(beat===1?'EmoThumbsUp':'Idle',beat===1);this.nextCue=now+16000;}
   // Add a subtle look towards the film and a short nod every 12 seconds.
   if(this.head){this.headBase=this.head.quaternion.clone();const t=elapsed%12,nod=t<1.2?Math.sin(t/1.2*Math.PI)*.075:0;this.head.rotation.y-=.11;this.head.rotation.x+=nod;}
  }
  const canvas=document.getElementById('stage');if(canvas){canvas.dataset.companion=this.mode;canvas.dataset.cornerAmount=this.amount.toFixed(3);}
 }
}
