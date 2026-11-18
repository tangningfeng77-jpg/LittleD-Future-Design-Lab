// Temporal gestures use palm geometry, not a single pose label.
// All thresholds are relative to image/palm size, not metric webcam depth.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=value=>Math.max(0,Math.min(1,value));
export function feature(hand) {
  const p=hand.points;
  const center={x:(p[0].x+p[5].x+p[9].x+p[17].x)/4,y:(p[0].y+p[5].y+p[9].y+p[17].y)/4};
  const scale=(distance(p[0],p[9])+distance(p[5],p[17]))/2;
  const extended=[[5,6,8],[9,10,12],[13,14,16],[17,18,20]].filter(([base,mid,tip])=>distance(p[tip],p[0])>distance(p[mid],p[0])*1.12 && distance(p[tip],p[base])>distance(p[mid],p[base])*1.35).length;
  return {...center,scale,id:hand.id,open:hand.pose==='open'||(hand.pose!=='fist'&&extended>=2),fist:hand.pose==='fist'};
}
export class MotionRecognizer {
  constructor(){this.reset(null,0);}
  reset(gesture,now=0){
    this.gesture=gesture; this.after=now+500; this.anchor=null; this.base=null;
    this.grip=null; this.ready=false; this.progress=0; this.lastSeen=0; this.fistCandidate=null;
  }
  clear(){this.anchor=null;this.base=null;this.grip=null;this.ready=false;this.progress=0;this.fistCandidate=null;}
  update(hands,now){
    const result=(action=null)=>({action,ready:this.ready,progress:this.progress,gripped:!!this.grip});
    if(!this.gesture||now<this.after) return result();
    // A stable fist is sufficient, including when it first enters the frame.
    // No open-hand prerequisite, target position, depth change or pull is needed.
    if(this.gesture==='fist'){
      if(this.lastSeen&&now-this.lastSeen>900)this.clear();
      this.lastSeen=now;
      const fist=hands.find(h=>h.pose==='fist'&&h.id===this.fistCandidate?.id)||hands.find(h=>h.pose==='fist');
      if(!fist){this.clear();return result();}
      if(this.fistCandidate?.id!==fist.id)this.fistCandidate={id:fist.id,since:now};
      this.ready=true;this.grip=fist.id;this.progress=clamp((now-this.fistCandidate.since)/180);
      if(this.progress>=1){this.reset(null,now);return {action:'fist',ready:true,progress:1,gripped:true};}
      return result();
    }
    const pair=['expand','contract'].includes(this.gesture);
    let all=hands.map(feature).filter(h=>h.scale>.035&&h.x>.035&&h.x<.965&&h.y>.04&&h.y<.96);
    if(this.base) all=all.filter(h=>this.base.ids.includes(h.id));
    if(pair) all=all.filter(h=>h.open).sort((a,b)=>a.id-b.id);
    else {all=all.filter(h=>h.open);all=all.slice(0,1);}
    if(all.length<(pair?2:1)) {this.clear();return result();}
    if(this.lastSeen&&now-this.lastSeen>900) this.clear();
    this.lastSeen=now;
    const h=all[0], other=all[1];
    const snapshot={x:h.x,y:h.y,scale:h.scale,ids:all.map(h=>h.id),gap:pair?Math.abs(h.x-other.x):0,otherX:other?.x,otherY:other?.y,time:now};
    if(!this.base){
      if(!h.open||(pair&&Math.abs(h.y-other.y)>.25)) {this.anchor=null;return result();}
      if(pair&&(this.gesture==='expand'?snapshot.gap>.78:snapshot.gap<.3)){this.anchor=null;return result();}
      if(!this.anchor||this.anchor.ids.join()!==snapshot.ids.join()||distance(this.anchor,snapshot)>.06||Math.abs(snapshot.scale/this.anchor.scale-1)>.25||(pair&&(Math.abs(snapshot.gap-this.anchor.gap)>.07||Math.abs(other.y-this.anchor.otherY)>.04))) this.anchor=snapshot;
      if(now-this.anchor.time>=220){this.base=snapshot;this.ready=true;}
      return result();
    }
    const b=this.base;
    if(now-b.time>5000){this.clear();return result();}
    if(this.gesture==='down'||this.gesture==='lift'){
      const sign=this.gesture==='down'?1:-1, travel=(h.y-b.y)*sign;
      if(Math.abs(h.x-b.x)>.22||travel<-.075){this.clear();return result();}
      this.progress=clamp(travel/Math.max(.09,Math.min(.18,b.scale*.95)));
    }else if(this.gesture==='push'){
      if(distance(h,b)>.2||h.scale/b.scale<.82){this.clear();return result();}
      this.progress=clamp((h.scale/b.scale-1)/.27);
    }else if(pair){
      const sign=this.gesture==='expand'?1:-1, side=b.x<b.otherX?-1:1;
      const first=(h.x-b.x)*side*sign, second=(other.x-b.otherX)*-side*sign;
      if(Math.abs(h.y-b.y)>.18||Math.abs(other.y-b.otherY)>.18||h.scale/b.scale>1.65){this.clear();return result();}
      // Allow an asymmetric outward movement; both hands need not travel identically.
      if(first<-.04||second<-.04){this.clear();return result();}
      this.progress=clamp((first+second)/.10);
    }
    if(this.progress>=1&&now-b.time>=180){
      const action=this.gesture; this.reset(null,now);return {action,ready:true,progress:1,gripped:false};
    }
    return result();
  }
}

