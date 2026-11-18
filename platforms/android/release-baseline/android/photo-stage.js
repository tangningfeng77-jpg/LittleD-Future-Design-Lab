import * as THREE from 'three';
// Camera-calibrated 2.5D room: separate floor and photographic rear layer.
// Aspect-preserving framing and bounded movement prevent unsupported edge views.
export function fitPhotoFov(aspect){return THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(55/2))*Math.min(1,1.5/aspect)));}
export async function createPhotoStage({scene,camera,controls,renderer}){
 const photo=await new THREE.TextureLoader().loadAsync('./assets/lab-background.png');photo.colorSpace=THREE.SRGBColorSpace;photo.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const reference=new THREE.PerspectiveCamera(55,1.5,.05,60);reference.position.set(0,1.65,6);reference.lookAt(0,.95,0);reference.updateMatrixWorld(true);
 const photoMatrix=new THREE.Matrix4().multiplyMatrices(reference.projectionMatrix,reference.matrixWorldInverse);
 const reflectionTarget=new THREE.WebGLRenderTarget(512,512,{type:THREE.HalfFloatType,depthBuffer:true});
 const reflected=new THREE.PerspectiveCamera();reflected.layers.set(2);
 const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),reflectionMatrix=new THREE.Matrix4();
 const uniforms={photo:{value:photo},photoMatrix:{value:photoMatrix},reflection:{value:reflectionTarget.texture},reflectionMatrix:{value:reflectionMatrix},reflectionTexel:{value:new THREE.Vector2(1/512,1/512)}};
 const vertex=`uniform mat4 photoMatrix;uniform mat4 reflectionMatrix;varying vec4 vPhoto;varying vec4 vReflection;varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;vPhoto=photoMatrix*world;vReflection=reflectionMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;}`;
 const fragment=`uniform sampler2D photo;uniform sampler2D reflection;uniform vec2 reflectionTexel;uniform bool reflective;varying vec4 vPhoto;varying vec4 vReflection;varying vec3 vWorld;
 void main(){vec2 uv=vPhoto.xy/vPhoto.w*.5+.5;
 if(vPhoto.w<=0.||uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)discard;
 vec3 base=texture2D(photo,uv).rgb;
 // Reconstruct a clean patch of the same wall beneath the new sharp sign.
 float wallMask=(1.-smoothstep(.145,.165,abs(uv.x-.5)))*(1.-smoothstep(.058,.071,abs(uv.y-.636)));
 vec2 wallUv=vec2(uv.x,.52+(uv.y-.636)*.35);base=mix(base,texture2D(photo,wallUv).rgb,wallMask);
 if(reflective){vec2 ruv=vReflection.xy/vReflection.w;vec4 r=vec4(0.);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)r+=texture2D(reflection,ruv+vec2(float(x),float(y))*reflectionTexel*2.2)/9.;float valid=step(0.,ruv.x)*step(ruv.x,1.)*step(0.,ruv.y)*step(ruv.y,1.);float fade=exp(-abs(vWorld.z-1.9)*.36);base=mix(base,r.rgb/max(r.a,.001),r.a*.36*valid*fade);}
 // Keep the room quieter than the foreground robot; retain sharp signage.
 float roomLuma=dot(base,vec3(.2126,.7152,.0722));
 base=mix(vec3(roomLuma),base,.88);
 // Both surfaces use the same photo-space grade at their shared boundary.
 // A smooth foreground lift preserves separation without a horizontal seam.
 float roomGain=mix(.94,.68,smoothstep(.30,.48,uv.y));
 base*=roomGain;
 gl_FragColor=vec4(base,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
 function mat(reflective=false){return new THREE.ShaderMaterial({uniforms:{...uniforms,reflective:{value:reflective}},vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide});}
 const surfaces=new THREE.Group();surfaces.name='Photo room · projected depth surfaces';scene.add(surfaces);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,32),mat(true));floor.rotation.x=-Math.PI/2;floor.position.set(0,0,4);floor.name='Calibrated photographic floor';surfaces.add(floor);
 const back=new THREE.Mesh(new THREE.PlaneGeometry(32,14),mat());back.position.set(0,7,-1.15);back.name='Rear wall · photographic depth';surfaces.add(back);
 // A single perspective photograph cannot supply reliable side/ceiling depth.
 // Keep those surfaces on the rear photographic layer instead of wrapping them.
 function photoPoint(u,v){const point=new THREE.Vector3(u*2-1,v*2-1,.5).unproject(reference);const ray=point.sub(reference.position);return reference.position.clone().addScaledVector(ray,(-1.125-reference.position.z)/ray.z);}
 await document.fonts.ready;
 const signCanvas=document.createElement('canvas');signCanvas.width=2048;signCanvas.height=512;const ctx=signCanvas.getContext('2d');ctx.textAlign='left';ctx.textBaseline='alphabetic';
 function tracked(text,y,font,tracking,color){ctx.font=font;const glyphs=[...text],width=glyphs.reduce((w,c)=>w+ctx.measureText(c).width,0)+(glyphs.length-1)*tracking;let x=(2048-width)/2;ctx.fillStyle=color;for(const ch of glyphs){ctx.fillText(ch,x,y);x+=ctx.measureText(ch).width+tracking;}}
 ctx.shadowColor='rgba(139,204,255,.42)';ctx.shadowBlur=3;tracked('未来设计实验室',230,'700 180px "Microsoft YaHei", "PingFang SC", sans-serif',22,'#164e7d');ctx.shadowBlur=0;tracked('FUTURE DESIGN LAB',380,'600 68px Arial, sans-serif',12,'#355f81');
 const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace;signTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const center=photoPoint(.5,.62);const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.4,1.1),new THREE.MeshBasicMaterial({map:signTexture,transparent:true,alphaTest:.015,depthWrite:false,toneMapped:false}));sign.position.copy(center);sign.name='Sharp architectural lettering · 未来设计实验室';scene.add(sign);
 const extrusion=sign.clone();extrusion.material=new THREE.MeshBasicMaterial({map:signTexture,color:0x527ba8,transparent:true,alphaTest:.015,depthWrite:false});extrusion.position.add(new THREE.Vector3(.009,-.013,-.008));extrusion.name='Raised sign edge';scene.add(extrusion);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(24,28),new THREE.ShadowMaterial({color:0x162f55,opacity:.35,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.002;shadow.receiveShadow=true;shadow.name='Shared floor shadow catcher';scene.add(shadow);shadow.layers.enable(3);
 // Image-derived colors and luminous panels illuminate the robot, rather than
 // only coloring a backdrop. The photo is perspective, not an HDR panorama.
 const envScene=new THREE.Scene();envScene.background=new THREE.Color(0xb5cbed);
 const picture=new THREE.Mesh(new THREE.PlaneGeometry(14,9.33),new THREE.MeshBasicMaterial({map:photo}));picture.position.set(0,3,-4);envScene.add(picture);
 for(const [p,s,color,intensity] of [[[0,5,0],[4,.1,3],0xe7f2ff,3.4],[[-4,2,2],[.1,4,3],0xffffff,2],[[4,2,2],[.1,4,3],0x9bcfff,2.8],[[0,.02,0],[8,.02,8],0xb9d4ff,.8]]){const card=new THREE.Mesh(new THREE.BoxGeometry(...s),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity)}));card.position.set(...p);envScene.add(card);}
 const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(envScene,.12);scene.environment=env.texture;scene.environmentIntensity=.85;pmrem.dispose();envScene.traverse(n=>{if(n.isMesh){n.geometry.dispose();n.material.dispose();}});
 scene.background=new THREE.Color(0xdbe7fa);scene.fog=null;
 const blueBounce=new THREE.PointLight(0x79b6ff,.65,5,2);blueBounce.position.set(1.7,.22,2.1);scene.add(blueBounce);scene.traverse(n=>{if(n.isLight)n.layers.enable(2);});
 function reset(){camera.fov=55;camera.near=.05;camera.far=60;camera.position.copy(reference.position);controls.target.set(0,.95,0);camera.updateProjectionMatrix();controls.update();}
 controls.enablePan=false;controls.enableZoom=false;controls.minDistance=4.75;controls.maxDistance=reference.position.distanceTo(new THREE.Vector3(0,.95,0));controls.minAzimuthAngle=-.028;controls.maxAzimuthAngle=.028;const polar=new THREE.Spherical().setFromVector3(reference.position.clone().sub(new THREE.Vector3(0,.95,0))).phi;controls.minPolarAngle=polar-.015;controls.maxPolarAngle=polar+.015;reset();
 let lastReflection=-Infinity;
 function update(now,width,height){const aspect=width/height;const fitted=fitPhotoFov(aspect);if(Math.abs(camera.fov-fitted)>.001){camera.fov=fitted;camera.updateProjectionMatrix();}if(now-lastReflection<200)return;lastReflection=now;const rw=Math.min(256,Math.round(width*.75)),rh=Math.min(256,Math.round(height*.75));if(reflectionTarget.width!==rw||reflectionTarget.height!==rh){reflectionTarget.setSize(rw,rh);uniforms.reflectionTexel.value.set(1/rw,1/rh);}
  camera.updateMatrixWorld(true);reflected.copy(camera);reflected.layers.set(2);reflected.position.y=-camera.position.y;const forward=new THREE.Vector3(0,0,-1).transformDirection(camera.matrixWorld),look=camera.position.clone().add(forward);look.y=-look.y;reflected.up.set(0,-1,0);reflected.lookAt(look);reflected.updateMatrixWorld(true);reflectionMatrix.copy(bias).multiply(reflected.projectionMatrix).multiply(reflected.matrixWorldInverse);
  const previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),background=scene.background;scene.background=null;renderer.setRenderTarget(reflectionTarget);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(scene,reflected);renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);scene.background=background;
 }
 function attachRobot(robot){robot.position.set(0,0,1.9);robot.traverse(n=>{n.layers.enable(2);n.layers.enable(3);});}
 return {reset,update,attachRobot,floor,shadow,reference};
}

