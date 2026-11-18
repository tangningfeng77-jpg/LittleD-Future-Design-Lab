import * as T from 'three';
const V=()=>new T.Vector3();
function aim(bone,child,point){bone.updateWorldMatrix(true,true);const from=child.getWorldPosition(V()).sub(bone.getWorldPosition(V())).normalize(),to=point.clone().sub(bone.getWorldPosition(V())).normalize();const rotation=new T.Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new T.Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));bone.updateWorldMatrix(true,true);}
export class HoldingPose{
 constructor(robot){this.robot=robot;this.weight=0;this.arms=['L','R'].map(side=>({side,upper:robot.getObjectByName('arm_'+side),lower:robot.getObjectByName('forearm_'+side),hand:robot.getObjectByName('hand_'+side)}));}
 update(dt,visuals,now){this.weight=T.MathUtils.damp(this.weight,visuals.presenting?1:0,6,dt);if(this.weight<.001)return;this.robot.updateWorldMatrix(true,true);
 for(const arm of this.arms){const slot=visuals.slots.find(s=>s.side===(arm.side==='L'?'right':'left'));if(!slot?.group.visible||!arm.upper||!arm.lower||!arm.hand)continue;const {upper,lower,hand}=arm,base=[upper.quaternion.clone(),lower.quaternion.clone(),hand.quaternion.clone()];const shoulder=upper.getWorldPosition(V()),elbow=lower.getWorldPosition(V()),wrist=hand.getWorldPosition(V()),a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist);let goal=slot.supportPoint.clone();goal.y+=Math.sin(now*.0012)*.004;
 const dir=goal.clone().sub(shoulder),distance=T.MathUtils.clamp(dir.length(),Math.abs(a-b)+.002,(a+b)*.97);dir.normalize();goal=shoulder.clone().addScaledVector(dir,distance);const bend=new T.Vector3(0,-1,.4);bend.addScaledVector(dir,-bend.dot(dir)).normalize();const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));const joint=shoulder.clone().addScaledVector(dir,along).addScaledVector(bend,height);
 aim(upper,lower,joint);aim(lower,hand,goal);
 // Preserve an open hand, rolled upward into a gentle presentation palm.
 const xAxis=new T.Vector3(0,arm.side==='L'?1:-1,0),yAxis=new T.Vector3(arm.side==='L'?1:-1,0,.30).normalize(),zAxis=xAxis.clone().cross(yAxis).normalize();const worldPalm=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(xAxis,yAxis,zAxis));hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(worldPalm));
 for(const [i,bone]of [upper,lower,hand].entries())bone.quaternion.copy(base[i].clone().slerp(bone.quaternion,this.weight*(slot.supportWeight??slot.alpha)));this.robot.updateWorldMatrix(true,true);
 }
 }
}
