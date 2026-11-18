import * as THREE from 'three';
const ease=t=>t*t*t*(t*(t*6-15)+10);
export class SmoothMotion {
 constructor(mixer,{onReturn=()=>{},fade=.58}={}){this.mixer=mixer;this.onReturn=onReturn;this.fade=fade;this.actions=new Map();this.target=null;this.transition=null;}
 play(clip,{once=false,speed=1,restart=false}={}){
  let next=this.actions.get(clip);if(next===this.target&&!restart){if(this.once!==once){next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,Infinity);next.paused=false;this.once=once;this.returned=false;}next.setEffectiveTimeScale(speed);return next;}
  const start=new Map([...this.actions.values()].map(a=>[a,a.getEffectiveWeight()]));
  if(!next){next=this.mixer.clipAction(clip);this.actions.set(clip,next);}
  const wasActive=next.enabled&&next.isRunning()&&(start.get(next)||0)>.001;
  if(!wasActive||restart)next.reset();
  next.enabled=true;next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,Infinity);next.clampWhenFinished=true;next.setEffectiveTimeScale(speed);next.setEffectiveWeight(start.get(next)||0);next.play();
  if(!this.target){next.setEffectiveWeight(1);this.transition=null;}else this.transition={start,time:0,duration:this.fade};
  this.target=next;this.once=once;this.returned=false;return next;
 }
 update(dt){
  if(this.transition){const tr=this.transition;tr.time+=dt;const t=ease(Math.min(1,tr.time/tr.duration));for(const a of this.actions.values()){const from=tr.start.get(a)||0;a.setEffectiveWeight(from+((a===this.target?1:0)-from)*t);}if(t>=1){for(const a of this.actions.values())if(a!==this.target)a.stop();this.transition=null;}}
  this.mixer.update(dt);
  if(this.once&&!this.returned&&this.target){const remaining=(this.target.getClip().duration-this.target.time)/Math.max(.01,this.target.getEffectiveTimeScale());if(remaining<=this.fade*.9){this.returned=true;this.onReturn();}}
 }
}
