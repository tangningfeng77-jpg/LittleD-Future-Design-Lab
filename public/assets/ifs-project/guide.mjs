export const connections=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const open=[[0,48],[-16,28],[-29,17],[-39,2],[-46,-10],[-18,3],[-22,-22],[-22,-41],[-21,-57],[-2,-1],[-3,-29],[-3,-50],[-3,-65],[14,3],[17,-22],[18,-41],[18,-54],[28,12],[33,-6],[35,-22],[36,-35]];
const closed=[[0,48],[-16,28],[-27,13],[-20,0],[-3,5],[-18,3],[-22,-13],[-18,-19],[-13,2],[-2,-1],[-3,-18],[2,-22],[5,-1],[14,3],[17,-15],[22,-16],[22,4],[28,12],[33,-5],[38,-5],[33,14]];
const ease=t=>t*t*(3-2*t);
export class GestureGuide {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.type='down';this.since=performance.now();
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Paint the hand opaquely offscreen, then apply transparency once. Overlap
    // between fingers and palm must not turn into darker skeletal-looking joints.
    this.handCanvas=document.createElement('canvas');this.handCanvas.width=560;this.handCanvas.height=720;
    this.handContext=this.handCanvas.getContext('2d');
  }
  set(type){this.type=type;this.since=performance.now()-3800*.18;}
  hand(x,y,scale=1,rotation=0,mirror=1,grip=0){
    // Position/scale animations share a single cached open-hand rendering.
    // Only the closing fist needs a fresh high-resolution silhouette each frame.
    if(this.renderedGrip!==grip){
    const ctx=this.handContext;ctx.clearRect(0,0,560,720);ctx.save();ctx.scale(4,4);ctx.translate(70,90);
    const points=open.map((p,i)=>p.map((v,k)=>v+(closed[i][k]-v)*grip));
    // A pearl-white, softly shaded silhouette. No photograph or backdrop is
    // composited: all pixels outside the hand remain transparent.
    const skin=ctx.createLinearGradient(-37,-56,31,63);
    skin.addColorStop(0,'#ffffff');skin.addColorStop(.32,'#f4f7f8');skin.addColorStop(.64,'#c9d1d5');skin.addColorStop(1,'#88959d');
    ctx.lineCap='round';ctx.lineJoin='round';
    const finger=(indices,width)=>{
      const p=indices.map(i=>points[i]);
      ctx.beginPath();ctx.moveTo(...p[0]);
      ctx.bezierCurveTo(...p[1],...p[2],...p[3]);
      ctx.strokeStyle='#f7fbff';ctx.lineWidth=width+1;ctx.stroke();
      ctx.strokeStyle=skin;ctx.lineWidth=width;ctx.stroke();
      if(grip<.55){
        ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.globalAlpha=.45;
        ctx.beginPath();ctx.moveTo(p[2][0]-2,p[2][1]);ctx.lineTo(p[3][0]-2,p[3][1]+4);ctx.stroke();ctx.globalAlpha=1;
      }
    };
    finger([5,6,7,8],12);finger([9,10,11,12],13);finger([13,14,15,16],12);finger([17,18,19,20],10);
    // Rounded, filled palm and wrist silhouette with a soft thenar mound.
    ctx.beginPath();ctx.moveTo(-13,67);ctx.lineTo(17,67);ctx.quadraticCurveTo(16,49,24,38);
    ctx.bezierCurveTo(34,27,36,12,29,7);ctx.quadraticCurveTo(18,-2,14,0);
    ctx.quadraticCurveTo(0,-7,-7,-2);ctx.quadraticCurveTo(-23,-5,-26,8);
    ctx.bezierCurveTo(-35,17,-28,35,-21,43);ctx.quadraticCurveTo(-12,52,-13,67);ctx.closePath();
    ctx.fillStyle=skin;ctx.fill();ctx.strokeStyle='#f5faff99';ctx.lineWidth=.8;ctx.stroke();
    const mound=ctx.createRadialGradient(-14,24,1,-14,24,24);mound.addColorStop(0,'#ffffff88');mound.addColorStop(1,'#ffffff00');
    ctx.fillStyle=mound;ctx.beginPath();ctx.ellipse(-12,25,17,22,-.4,0,Math.PI*2);ctx.fill();
    finger([1,2,3,4],14);
    ctx.strokeStyle='#53677340';ctx.lineWidth=.65;
    ctx.beginPath();ctx.moveTo(-12,11);ctx.bezierCurveTo(-3,8,13,10,24,15);
    ctx.moveTo(-12,14);ctx.bezierCurveTo(-2,23,1,31,-5,39);
    ctx.moveTo(-8,50);ctx.quadraticCurveTo(4,53,14,49);ctx.stroke();
    if(grip>.25){
      ctx.globalAlpha=grip*.55;ctx.strokeStyle='#4b606e';ctx.lineWidth=.75;
      for(const [a,b] of [[-18,-7],[-2,-9],[14,-6],[27,0]]){
        ctx.beginPath();ctx.moveTo(a-3,b);ctx.quadraticCurveTo(a+1,b+3,a+5,b);ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
    // Fade the wrist out into the scene, matching the reference's floating hand.
    ctx.globalCompositeOperation='destination-in';
    const fade=ctx.createLinearGradient(0,-70,0,70);
    fade.addColorStop(0,'#ffffff');fade.addColorStop(.62,'#ffffff');fade.addColorStop(1,'#ffffff00');
    ctx.fillStyle=fade;ctx.fillRect(-70,-90,140,180);
    ctx.restore();
    this.renderedGrip=grip;
    }
    const target=this.ctx;target.save();target.translate(x,y);target.rotate(rotation);target.scale(scale*mirror,scale);
    target.drawImage(this.handCanvas,-70,-90,140,180);target.restore();
  }
  arrow(x1,y1,x2,y2){
    const c=this.ctx,angle=Math.atan2(y2-y1,x2-x1);c.save();c.strokeStyle='#ffffff';c.lineWidth=1.25;c.globalAlpha*=1.5;
    c.setLineDash([]);c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
    c.beginPath();c.moveTo(x2-7*Math.cos(angle-.5),y2-7*Math.sin(angle-.5));c.lineTo(x2,y2);c.lineTo(x2-7*Math.cos(angle+.5),y2-7*Math.sin(angle+.5));c.stroke();c.restore();
  }
  draw(now){
    const c=this.ctx;c.clearRect(0,0,this.canvas.width,this.canvas.height);if(!this.type)return;
    c.save();c.scale(this.canvas.width/320,this.canvas.height/180);
    const t=this.reduced ? .68 : ((now-this.since)%3800)/3800;
    const p=ease(Math.max(0,Math.min(1,(t-.18)/.48)));
    // Fade before resetting: never demonstrate an accidental reverse action.
    c.globalAlpha=(t<.1?t/.1:t>.82?(1-t)/.18:1)*.6;
    const type=this.type;
    if(type==='down'||type==='lift'){
      const lift=type==='lift';this.hand(150,lift?125-p*64:56+p*64,.82,lift?-Math.PI/2:Math.PI/2,lift?-1:1);
      this.arrow(236,lift?136:45,236,lift?45:136);
    }else if(type==='expand'||type==='contract'){
      const gap=type==='expand'?44+p*48:92-p*48;
      this.hand(160-gap,92,.7,0,-1);this.hand(160+gap,92,.7);
      if(type==='expand'){this.arrow(123,155,58,155);this.arrow(197,155,262,155);}
      else {this.arrow(58,155,123,155);this.arrow(262,155,197,155);}
    }else if(type==='push'){
      this.hand(155,98,.64+p*.43);this.arrow(245,133,245,58);
      c.strokeStyle='#ffffff';c.beginPath();c.ellipse(155,92,44+p*22,48+p*22,0,0,Math.PI*2);c.globalAlpha*=.5;c.stroke();
    }else if(type==='fist'){
      // Close in place and hold. No backward movement or shrinking is shown.
      this.hand(158,98,.95,0,1,p);
    }
    c.restore();
  }
}
