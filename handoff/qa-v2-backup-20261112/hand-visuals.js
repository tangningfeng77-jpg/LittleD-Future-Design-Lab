import * as T from 'three';
export class HandVisuals{
 constructor(scene,camera){this.scene=scene;this.camera=camera;this.loader=new T.TextureLoader();this.cache=new Map();this.onPresentationChange=()=>{};this.presenting=false;this.viewerOpen=false;this.slots=['left','right'].map(side=>{
 const group=new T.Group();scene.add(group);group.visible=false;
 const back=new T.Mesh(new T.BoxGeometry(.79,.57,.025),new T.MeshPhysicalMaterial({color:0x102b38,metalness:.3,roughness:.45,transparent:true,opacity:0}));group.add(back);
 const picture=new T.Mesh(new T.PlaneGeometry(.75,.49),new T.MeshBasicMaterial({transparent:true,opacity:0,toneMapped:false}));picture.position.z=.025;group.add(picture);
 const ring=new T.Mesh(new T.TorusGeometry(.17,.003,6,64),new T.MeshBasicMaterial({color:0x87dfff,transparent:true,opacity:0}));ring.rotation.x=-Math.PI/2;ring.position.y=-.34;group.add(ring);
 const beam=new T.Mesh(new T.ConeGeometry(.14,.32,24,1,true),new T.MeshBasicMaterial({color:0x67cffa,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));beam.position.y=-.43;beam.rotation.z=Math.PI;group.add(beam);
 const button=document.createElement('button');button.className='visual-zoom-target';button.hidden=true;button.title='点击放大查看资料原图';button.setAttribute('aria-label','放大查看资料图片');button.addEventListener('click',()=>this.openViewer(side));document.body.append(button);
 return{side,group,back,picture,ring,beam,button,alpha:0,target:0,request:0,expires:0};});
 this.announcement=document.createElement('div');this.announcement.setAttribute('aria-live','polite');this.announcement.className='visual-announcement';document.body.append(this.announcement);
 this.viewer=document.createElement('div');this.viewer.className='lab-image-viewer';this.viewer.hidden=true;this.viewer.setAttribute('role','dialog');this.viewer.setAttribute('aria-modal','true');this.viewer.setAttribute('aria-label','资料原图');
 this.closeButton=document.createElement('button');this.closeButton.textContent='关闭 ×';this.closeButton.className='lab-image-close';this.closeButton.addEventListener('click',()=>this.closeViewer());this.viewerImage=document.createElement('img');this.viewerCaption=document.createElement('p');this.viewer.append(this.closeButton,this.viewerImage,this.viewerCaption);this.viewer.addEventListener('click',e=>{if(e.target===this.viewer)this.closeViewer()});document.body.append(this.viewer);document.addEventListener('keydown',e=>{if(e.key==='Escape')this.closeViewer()});
 }
 attach(robot){this.robot=robot;this.slots[0].bone=robot.getObjectByName('hand_L');this.slots[1].bone=robot.getObjectByName('hand_R');}
 openViewer(side){const slot=this.slots.find(s=>s.side===side);if(!slot?.image||slot.alpha<.2)return;this.viewerImage.src=slot.image.fullUrl||slot.image.url;this.viewerImage.alt=slot.image.title;this.viewerCaption.textContent=[slot.image.title,slot.image.kind,slot.image.pages?'来源页 '+slot.image.pages:''].filter(Boolean).join(' · ');this.viewer.hidden=false;this.viewerOpen=true;this.previousFocus=document.activeElement;this.closeButton.focus();}
 closeViewer(){if(!this.viewerOpen)return;this.viewer.hidden=true;this.viewerOpen=false;for(const s of this.slots)if(s.target)s.expires=performance.now()+120000;this.previousFocus?.focus?.();}
 async show(images){
  this.closeViewer();const selected=images.slice(0,2);this.announcement.textContent=selected.map(i=>i.title+'；'+i.kind).join('。');
  await Promise.all(this.slots.map(async(slot,i)=>{const image=selected[i],ticket=++slot.request;slot.pending=null;
   if(!image){slot.target=0;return;}
   if(slot.image?.id===image.id&&slot.target){slot.expires=performance.now()+120000;return;}
   try{let texture=this.cache.get(image.url);if(!texture){texture=await this.loader.loadAsync(image.url);texture.colorSpace=T.SRGBColorSpace;this.cache.set(image.url,texture);
     if(this.cache.size>16)for(const [url,old]of this.cache){if(url!==image.url&&!this.slots.some(s=>s.picture.material.map===old||s.pending?.texture===old)){old.dispose();this.cache.delete(url);break;}}
    }
    if(ticket!==slot.request)return;
    slot.pending={image,texture};slot.target=0;
   }catch(e){if(ticket===slot.request)slot.target=0;console.warn('资料图片未能加载',image.id);}
  }));
 }

 clear(){this.closeViewer();for(const s of this.slots){s.request++;s.pending=null;s.target=0;}}
 update(dt,now){if(!this.robot)return;this.robot.updateWorldMatrix(true,true);this.camera.updateMatrixWorld();const q=this.camera.getWorldQuaternion(new T.Quaternion()),canvas=document.getElementById('stage'),rect=canvas?.getBoundingClientRect?.()||{left:0,top:0,width:960,height:640};const active=this.slots.filter(s=>s.target||s.pending||s.alpha>.01);const presenting=active.length>0;if(presenting!==this.presenting){this.presenting=presenting;this.onPresentationChange(presenting)}
 const depth=T.MathUtils.clamp(this.robot.getWorldPosition(new T.Vector3()).project(this.camera).z,-.8,.999);
 for(const s of this.slots){if(s.pending&&s.alpha<.04){const {image,texture}=s.pending;s.pending=null;s.aspect=texture.image.width/texture.image.height;s.picture.material.map=texture;s.picture.material.needsUpdate=true;s.image=image;s.target=1;s.expires=now+120000;s.button.setAttribute('aria-label','放大查看：'+image.title);}
 s.supportWeight=T.MathUtils.damp(s.supportWeight||0,(s.target||s.pending)?1:0,5,dt);if(this.viewerOpen&&s.target)s.expires=now+120000;s.alpha=T.MathUtils.damp(s.alpha,s.target,7,dt);s.group.visible=s.alpha>.005;s.button.hidden=s.alpha<.3;if(!s.group.visible)continue;
 // Screen-space layout projected into 3D: frontal and independent of waving hand bones.
 const narrow=rect.width/rect.height<1.05;const width=active.length===1?.36:.34;let cx=(s.side==='left'?-1:1)*(active.length===1?.59:.56),cy=.08,boxW=width,boxH=.52;
 if(narrow){cx=0;cy=s.side==='left'?.51:-.38;boxW=.78;boxH=.33;}
 let center=new T.Vector3(cx,cy,depth).unproject(this.camera);const left=new T.Vector3(cx-boxW,cy,depth).unproject(this.camera),right=new T.Vector3(cx+boxW,cy,depth).unproject(this.camera);const lower=new T.Vector3(cx,cy-boxH,depth).unproject(this.camera),upper=new T.Vector3(cx,cy+boxH,depth).unproject(this.camera);const maxW=left.distanceTo(right),maxH=lower.distanceTo(upper),aspect=s.aspect||1.5,fitW=Math.min(maxW,maxH*aspect),fitH=fitW/aspect;
 if(!narrow)center=new T.Vector3(cx,-.32+fitH/maxH*boxH,depth).unproject(this.camera);s.supportPoint=center.clone().addScaledVector(new T.Vector3(1,0,0).applyQuaternion(q),(s.side==='left'?1:-1)*fitW*.43).addScaledVector(new T.Vector3(0,1,0).applyQuaternion(q),-fitH/2-.045);s.group.position.copy(center);s.group.quaternion.copy(q);s.group.scale.setScalar(1);s.back.scale.set((fitW+.035)/.79,(fitH+.035)/.57,1);s.picture.scale.set(fitW/.75,fitH/.49,1);s.ring.position.y=-fitH/2-.09;s.beam.position.y=-fitH/2-.2;s.back.material.opacity=.94*s.alpha;s.picture.material.opacity=s.alpha;s.ring.material.opacity=.22*s.alpha;s.beam.material.opacity=.025*s.alpha;
 const origin=center.clone().project(this.camera);const pxW=fitW/maxW*boxW*rect.width,pxH=fitH/maxH*boxH*rect.height;s.button.style.left=(rect.left+(origin.x+1)*rect.width/2-pxW/2)+'px';s.button.style.top=(rect.top+(1-origin.y)*rect.height/2-pxH/2)+'px';s.button.style.width=pxW+'px';s.button.style.height=pxH+'px';}
 }
}
