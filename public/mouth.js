export function paintMouth(ctx,emotion,openness,color){
 const w=ctx.canvas.width,h=ctx.canvas.height;ctx.clearRect(0,0,w,h);
 const sad=[2,3,6,8].includes(emotion),surprised=emotion===4;
 const cx=w/2,cy=h*.49,half=surprised?24:58,open=Math.min(.8,Math.max(0,openness));
 ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=11;
 if(surprised){ctx.beginPath();ctx.ellipse(cx,cy,19+open*5,20+open*12,0,0,Math.PI*2);ctx.stroke();return;}
 const bend=sad?-13:16;
 if(open<.08){ctx.beginPath();ctx.moveTo(cx-half,cy-4);ctx.quadraticCurveTo(cx,cy+bend,cx+half,cy-4);ctx.stroke();return;}
 const depth=6+open*27;
 ctx.beginPath();ctx.moveTo(cx-half,cy-4);ctx.quadraticCurveTo(cx,cy+bend*.75,cx+half,cy-4);ctx.quadraticCurveTo(cx,cy+bend+depth,cx-half,cy-4);ctx.fill();
}
