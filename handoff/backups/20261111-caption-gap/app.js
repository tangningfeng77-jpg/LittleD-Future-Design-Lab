import {VideoCompanion,makeInPlaceWalk} from './video-companion.js';
import {HoldingPose} from './holding-pose.js?v=precise-20261104';
import {HandVisuals} from './hand-visuals.js?v=stable-final-20261104';
import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RobotVoice} from './voice.js?v=bailian-conversation-20261106-7';
import {SpeechDirector} from './expression.js';
import {paintMouth} from './mouth.js';
import {SmoothMotion} from './motion.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createPhotoStage} from './photo-stage.js';
import {applyShellFinish,accessoryFinish,applyVisorFinish} from './material-finish.js';
const $=id=>document.getElementById(id);
const read=async name=>{const r=await fetch('./assets/'+name);if(!r.ok)throw Error(name+' 加载失败');return r.json();};
let config=await read('robot-config.json');try{config={...config,...JSON.parse(localStorage.getItem('little-d-config')||'{}')};}catch{}
const save=()=>localStorage.setItem('little-d-config',JSON.stringify(config));
config.emotion=0;
const renderer=new THREE.WebGLRenderer({canvas:$('stage'),antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xcbd8c5);const camera=new THREE.PerspectiveCamera(34,1,.01,100);camera.position.set(.8,1.4,3.5);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.8,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=1;controls.maxDistance=8;
// Neutral photographic studio lighting, generated locally; no hall assets.
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
scene.background=new THREE.Color(0xe2e6e3);scene.fog=new THREE.Fog(0xe2e6e3,7,16);
scene.add(new THREE.HemisphereLight(0xe4f0ff,0x7894bb,.48));
const keyLight=new THREE.DirectionalLight(0xfff4e6,2.7);keyLight.position.set(-.7,5.5,2.7);keyLight.castShadow=true;keyLight.shadow.mapSize.set(2048,2048);keyLight.shadow.camera.left=-3;keyLight.shadow.camera.right=3;keyLight.shadow.camera.top=4;keyLight.shadow.camera.bottom=-3;keyLight.shadow.camera.near=.1;keyLight.shadow.camera.far=15;keyLight.shadow.normalBias=.012;keyLight.shadow.bias=-.0001;keyLight.shadow.radius=7;keyLight.shadow.blurSamples=12;scene.add(keyLight);
const fillLight=new THREE.DirectionalLight(0x8fc6ff,.85);fillLight.position.set(4,2,1);scene.add(fillLight);
const rimLight=new THREE.DirectionalLight(0xffeedb,2.5);rimLight.position.set(-2,2.8,.2);scene.add(rimLight);
const photoStage=await createPhotoStage({scene,camera,controls,renderer});
// Small contact patch on the same calibrated ground as the photographed ring.
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const sc=shadowCanvas.getContext('2d'),grad=sc.createRadialGradient(64,64,3,64,64,62);grad.addColorStop(0,'rgba(21,39,65,.28)');grad.addColorStop(.4,'rgba(21,39,65,.10)');grad.addColorStop(1,'rgba(21,39,65,0)');sc.fillStyle=grad;sc.fillRect(0,0,128,128);
const contact=new THREE.Mesh(new THREE.PlaneGeometry(1.35,1.0),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.set(0,.004,1.9);scene.add(contact);
const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
const aoCamera=camera.clone();aoCamera.layers.set(3);
const ambientOcclusion=new GTAOPass(scene,aoCamera,512,512,undefined,{radius:.12,samples:8,thickness:.3},{samples:8,radius:4});ambientOcclusion.blendIntensity=.55;composer.addPass(ambientOcclusion);composer.addPass(new OutputPass());
let viewWidth=0,viewHeight=0,qualityTier=0,frameTime=0,frameCount=0,qualityAt=performance.now()+4000;
let presentation;let holdingPose;let motion,robot,mixer,action,activeClip,body,eyes,mouth,speech,voice,paused=false,speaking=false;const glowMaterials=[];
let transientEmotion=null,mouthOpen=0,lastMouthDraw=0,gestureUntil=0,nextBlink=performance.now()+4000,blinkStart=-Infinity;
const mouthCanvas=document.createElement('canvas');mouthCanvas.width=256;mouthCanvas.height=128;const mouthContext=mouthCanvas.getContext('2d');const mouthTexture=new THREE.CanvasTexture(mouthCanvas);mouthTexture.colorSpace=THREE.SRGBColorSpace;
const director=new SpeechDirector({perform:name=>gesture(name),emote:index=>emotion(index,false)});
const handVisuals=new HandVisuals(scene,camera);handVisuals.onPresentationChange=visible=>{if(robot&&motion&&!document.body.classList.contains('editing')){gestureUntil=0;play(byName(visible?'Idle':speaking?'EmoTalk1':'Idle'));}};
const textureLoader=new THREE.TextureLoader();
function tex(name,color=true){const t=textureLoader.load('./assets/'+name);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(color)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
const translation={Dance0:'舞蹈 01',Dance1:'舞蹈 02',EmoAngry:'生气',EmoCry:'哭泣',EmoThumbsUp:'点赞',EmoWin:'胜利',EmoDontKnow:'不知道',EmoNo:'拒绝',EmoHello:'打招呼',EmoLaught:'大笑',EmoLookingFor:'寻找',EmoTalk1:'说话',Idle:'待机',walk:'行走',run:'奔跑',walkBack:'后退',strafeLeft:'左侧移',strafeRight:'右侧移',jump:'跳跃',jumpForward:'向前跳',runJump:'跑跳',fallFront:'向前倒下',fallBack:'向后倒下',riseFromFront:'俯卧起身',riseFromBack:'仰卧起身',GetHitFront:'正面受击',GetHitLeft:'左侧受击',GetHitRight:'右侧受击',turn90Left:'左转90°',turn90Right:'右转90°',turn180left:'左转180°',turn180Right:'右转180°',walk_TurnLeft90:'行走左转',walk_TurnRight90:'行走右转',run_TurnLeft90:'奔跑左转',run_TurnRight90:'奔跑右转'};
const key=clip=>clip.name.split('R_13_').pop();
function play(clip,once=false){if(!motion||!clip)return;if(handVisuals.presenting&&key(clip)!=='Idle'&&!document.body.classList.contains('editing'))clip=byName('Idle');const name=key(clip),conversational=!document.body.classList.contains('editing');const pace=conversational?(name==='EmoTalk1'?.78:name==='Idle'?.88:.9):1;action=motion.play(clip,{once:once||!$('loop').checked,speed:config.speed*pace});activeClip=clip;paused=false;$('pause').textContent='暂停';$('currentAction').textContent=translation[name]||name;document.querySelectorAll('#animations button').forEach(b=>b.classList.toggle('active',b.dataset.clip===clip.name));}
function byName(name){return robot?.animations.find(c=>key(c)===name);}
function gesture(name){if(!robot||handVisuals.presenting)return;const clip=byName(name);if(!clip)return;gestureUntil=performance.now()+Math.min(clip.duration,4.5)*1000;play(clip,true);$('expressionState').dataset.gesture=name;$('expressionState').textContent='随话语表达 · '+(translation[name]||name);}
function setSpeaking(value){if(!robot||speaking===value)return;speaking=value;mouth.visible=true;speech.visible=false;if(value){if(performance.now()>gestureUntil)play(byName('EmoTalk1'));}else{director.end();if(performance.now()>gestureUntil)play(byName('Idle'));setTimeout(()=>{if(!speaking){emotion(0,false);$('expressionState').textContent='动作和表情随对话自然变化';}},1600);}}
function appearance(){if(!body)return;body.material.color.set(config.shell);for(const m of glowMaterials){m.emissive.set(config.glow);m.emissiveIntensity=config.intensity;}}
function emotion(index,persist=true){if(!Number.isInteger(index)||index<0||index>9)return;if(persist){config.emotion=index;transientEmotion=null;save();}else transientEmotion=index;$('expressionState').dataset.emotion=String(index);if(eyes?.material.map)eyes.material.map.offset.x=index/10;document.querySelectorAll('#emotions button').forEach((b,i)=>b.classList.toggle('active',index===i));}
function monogram(){const outer=[[-.061,-.076],[-.061,.076]],inner=[[-.034,-.05],[-.034,.05]];for(let i=0;i<=24;i++){const a=Math.PI*i/24;outer.push([-.008+.078*Math.sin(a),.076*Math.cos(a)]);inner.push([-.008+.052*Math.sin(a),.05*Math.cos(a)]);}const p=[],idx=[],n=outer.length;for(const v of [...outer,...inner])p.push(v[0],v[1],0);for(let i=0;i<n;i++){let j=(i+1)%n;idx.push(i,j+n,j,i,i+n,j+n);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;}
function roundedBox(){const g=new THREE.BoxGeometry(1,1,1,4,4,4),p=g.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),c=v.clone().clampScalar(-.42,.42);v.sub(c).normalize().multiplyScalar(.08).add(c);p.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();return g;}
function accessory(n,mats){let o;if(n.mesh){const g=n.mesh==='10202'?roundedBox():n.mesh==='10207'?new THREE.SphereGeometry(.5,24,16):monogram();const d=mats[n.material]||{},c=d.colors?._Color||[.1,.7,.6];const e=d.colors?._EmissionColor||[0,0,0];const m=new THREE.MeshPhysicalMaterial({color:new THREE.Color(...c.slice(0,3)),emissive:new THREE.Color(...e.slice(0,3)),...accessoryFinish(n.material),side:THREE.DoubleSide});o=new THREE.Mesh(g,m);}else if(n.text){const c=document.createElement('canvas');c.width=256;c.height=96;const x=c.getContext('2d');x.fillStyle='#f6eed6';x.font='70px sans-serif';x.fillText(n.text,0,72);o=new THREE.Mesh(new THREE.PlaneGeometry(.08,.03),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,side:THREE.DoubleSide}));}else o=new THREE.Group();o.name=n.name;if(n.position.length)o.position.fromArray(n.position);if(n.quaternion.length)o.quaternion.fromArray(n.quaternion);if(n.scale.length)o.scale.fromArray(n.scale);for(const child of n.children)o.add(accessory(child,mats));return o;}
try{
 const [mats,extras,clipMeta]=await Promise.all([read('materials.json'),read('accessories.json'),read('animations.json')]);
 const names=new Set(Object.values(mats).flatMap(m=>Object.values(m.maps)));
 const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.endsWith('Rob13.fbx')||url.startsWith('blob:')||url.startsWith('data:'))return url;const name=url.split(/[\\/]/).pop();return names.has(name)?'./assets/'+name:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';});
 robot=await new FBXLoader(manager).loadAsync('./assets/Rob13.fbx');scene.add(robot);robot.updateMatrixWorld(true);
 body=robot.getObjectByName('Rob13_Body');eyes=robot.getObjectByName('Eyes');mouth=robot.getObjectByName('MouthEmo');speech=robot.getObjectByName('MouthSpeach');
 const maps=mats.LittleD_Shell.maps;
 const shellMat=new THREE.MeshPhysicalMaterial({map:tex(maps._MainTex),normalMap:tex(maps._BumpMap,false),normalScale:new THREE.Vector2(.48,-.48),emissiveMap:tex(maps._EmissionMap),metalness:.06,roughness:.34,clearcoat:.58,clearcoatRoughness:.20,ior:1.46,specularIntensity:.9});
 applyShellFinish(shellMat,tex(maps._MetallicGlossMap,false));body.material=shellMat;body.castShadow=true;body.receiveShadow=true;glowMaterials.push(shellMat);
 for(const [n,src] of [[eyes,'Rob13Emo_eyes'],[mouth,'Rob13Emo_mouth'],[speech,'Rob13Emo_speak']]){const t=tex(mats[src].maps._MainTex);n.material=new THREE.MeshStandardMaterial({map:t,emissiveMap:t,color:0x111111,emissive:config.glow,emissiveIntensity:config.intensity,alphaMap:t,transparent:true,alphaTest:.08,depthWrite:false,side:THREE.DoubleSide});n.renderOrder=3;glowMaterials.push(n.material);}speech.visible=false;
 // Keep the original mouth mesh, with a clean curved mouth instead of a waveform.
 const uv=mouth.geometry.attributes.uv;let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;for(let i=0;i<uv.count;i++){u0=Math.min(u0,uv.getX(i));u1=Math.max(u1,uv.getX(i));v0=Math.min(v0,uv.getY(i));v1=Math.max(v1,uv.getY(i));}for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)-u0)/(u1-u0),(uv.getY(i)-v0)/(v1-v0));uv.needsUpdate=true;
 mouth.material=new THREE.MeshBasicMaterial({map:mouthTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const glass=robot.getObjectByName('Rob13_Glass');glass.material=new THREE.MeshPhysicalMaterial({color:0x12212c,roughness:.17,metalness:.015,clearcoat:.85,clearcoatRoughness:.12,ior:1.46,specularIntensity:.7,envMapIntensity:.75,transparent:true,opacity:.19,depthWrite:false,side:THREE.FrontSide});
 applyVisorFinish(glass.material);glass.renderOrder=2;
 for(const n of extras){const bone=robot.getObjectByName(n.name.includes('Chest')?'hip':'head');const group=new THREE.Group();group.name=n.name;bone.add(group);bone.updateWorldMatrix(true,false);const local=new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(robot.matrixWorld);local.decompose(group.position,group.quaternion,group.scale);for(const c of n.children){const part=accessory(c,mats);part.position.x*=-1;part.quaternion.y*=-1;part.quaternion.z*=-1;part.scale.x*=-1;group.add(part);}}
 photoStage.attachRobot(robot);handVisuals.attach(robot);holdingPose=new HoldingPose(robot);
 const allowed=new Set(clipMeta.map(c=>c.take));robot.animations=robot.animations.filter(c=>allowed.has(c.name));const neutralIdle=byName('Idle');robot.animations=robot.animations.map(c=>key(c)==='walk'?makeInPlaceWalk(c,neutralIdle):c);mixer=new THREE.AnimationMixer(robot);motion=new SmoothMotion(mixer,{onReturn:()=>{gestureUntil=0;play(byName(speaking?'EmoTalk1':'Idle'));}});
 for(const clip of robot.animations.slice().sort((a,b)=>key(a).localeCompare(key(b)))){const b=document.createElement('button');b.textContent=translation[key(clip)]||key(clip);b.title=clip.name;b.dataset.clip=clip.name;b.onclick=()=>play(clip);$('animations').append(b);}
 $('search').oninput=()=>document.querySelectorAll('#animations button').forEach(b=>b.hidden=!(b.textContent+b.title).toLowerCase().includes($('search').value.toLowerCase()));
 robot.traverse(n=>{if(n.isMesh||n.isBone||n.name.startsWith('LittleD_')){const l=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.checked=n.visible;c.onchange=()=>n.visible=c.checked;l.append(c,document.createTextNode(' '+n.name));$('hierarchy').append(l);}});
 
 appearance();emotion(config.emotion);play(byName('Idle'));$('assetStatus').textContent='自然表达 · 实时陪伴';
 presentation=new VideoCompanion({robot,camera,scene,contact,perform:(name,once=false)=>play(byName(name),once),emote:index=>emotion(index,false)});
 window.robotStudio={robot,mixer,play:name=>play(byName(name)),get config(){return config;},setEmotion:emotion,director,handVisuals,presentation};
}catch(e){$('fatal').hidden=false;$('fatal').textContent='机器人加载失败：'+e.message;console.error(e);}
const emotionNames=['平静','开心','难过','怀疑','惊讶','宕机','嫌弃','生气','哭泣','喜爱'];for(let i=0;i<10;i++){const b=document.createElement('button');b.textContent=emotionNames[i];b.onclick=()=>emotion(i);$('emotions').append(b);}emotion(config.emotion);
function fill(){for(const k of ['shell','glow','intensity','speed','voice','instructions'])$(k).value=config[k];$('speedValue').value=config.speed+'×';$('memory').value=config.memory||'';}fill();
for(const k of ['shell','glow','intensity','speed'])$(k).oninput=()=>{config[k]=['speed','intensity'].includes(k)?Number($(k).value):$(k).value;appearance();if(action)action.timeScale=config.speed;$('speedValue').value=config.speed+'×';save();};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'继续':'暂停';};$('loop').onchange=()=>{if(activeClip)play(activeClip);};$('timeline').oninput=()=>{if(action){action.time=Number($('timeline').value)*activeClip.duration;mixer.update(0);}};
$('reset').onclick=()=>{if(robot){robot.position.set(0,0,1.9);robot.rotation.set(0,0,0);play(byName('Idle'));emotion(0);}};
$('cameraReset')?.addEventListener('click',()=>photoStage.reset());
$('export')?.addEventListener('click',()=>{save();const u=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='little-d-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});
$('import')?.addEventListener('change',async e=>{try{const c=JSON.parse(await e.target.files[0].text());if(!/^#[0-9a-f]{6}$/i.test(c.shell)||!/^#[0-9a-f]{6}$/i.test(c.glow)||!Number.isFinite(c.speed)||c.speed<.1||c.speed>2||!Number.isFinite(c.intensity)||c.intensity<0||c.intensity>3||!Number.isInteger(c.emotion)||c.emotion<0||c.emotion>9||typeof c.instructions!=='string'||typeof c.voice!=='string')throw Error('配置格式或数值不正确');config={...config,...c};fill();appearance();emotion(config.emotion);if(action)action.timeScale=config.speed;save();voice?.update();}catch(e){$('aiStatus').textContent='导入失败：'+e.message;}});
voice=new RobotVoice({config:()=>({...config,instructions:config.instructions+'\n当前画面更新：小D站在用户提供照片重建的未来设计实验室迎宾空间中，地面有蓝白发光圆环，后墙写有未来设计实验室 / FUTURE DESIGN LAB。这里是有限视角的照片投影空间，并非完整可导航的展厅；不能编造照片之外的布局、展品或路线。'}),setSpeaking,play:name=>gesture(name),director,handVisuals,presentation});await voice.init();
 window.robotStudio.voice=voice;
$('applyAI')?.addEventListener('click',()=>{config.voice=$('voice').value;config.instructions=$('instructions').value;save();voice.update();});$('saveMemory')?.addEventListener('click',()=>{config.memory=$('memory').value;save();voice.update();});
$('knowledge')?.addEventListener('click',()=>window.open('./assets/lab-knowledge/knowledge.json','_blank','noopener'));
const clock=new THREE.Clock();function frame(){requestAnimationFrame(frame);const rawDt=clock.getDelta(),dt=Math.min(rawDt,.1);
if(performance.now()>qualityAt){frameTime+=Math.min(rawDt,.2);frameCount++;if(frameCount>=90){const fps=frameCount/frameTime;$('stage').dataset.fps=String(Math.round(fps));if(fps<38&&qualityTier===0){qualityTier=1;renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));composer.setPixelRatio(renderer.getPixelRatio());keyLight.shadow.mapSize.set(1024,1024);keyLight.shadow.map?.dispose();keyLight.shadow.map=null;keyLight.shadow.mapPass?.dispose();keyLight.shadow.mapPass=null;viewWidth=0;}else if(fps<27&&qualityTier===1){qualityTier=2;ambientOcclusion.enabled=false;}frameTime=0;frameCount=0;qualityAt=performance.now()+2000;}}const w=renderer.domElement.clientWidth,h=renderer.domElement.clientHeight;if(viewWidth!==w||viewHeight!==h){viewWidth=w;viewHeight=h;renderer.setSize(w,h,false);composer.setSize(w,h);ambientOcclusion.setSize(Math.ceil(w*(qualityTier ? .5 : .8)),Math.ceil(h*(qualityTier ? .5 : .8)));camera.aspect=w/h;camera.updateProjectionMatrix();}presentation?.beforeAnimation();if(motion&&!paused)motion.update(dt);if(action)$('timeline').value=action.time/activeClip.duration;if($('rainbow').checked){const c=new THREE.Color().setHSL((performance.now()/2000)%1,1,.5);for(const m of glowMaterials)m.emissive.copy(c);}else appearance();if(speech)speech.visible=false;
 if(eyes){const now=performance.now();if(now>=nextBlink){blinkStart=now;nextBlink=now+4200+Math.random()*2600;}const t=(now-blinkStart)/170;eyes.scale.y=t>=0&&t<=1?1-.93*Math.sin(t*Math.PI):1;}
 const audioTime=voice?.ctx?.currentTime||0;voice?.tickSpeech();director.tick(audioTime);voice?.visualNarrator?.tick(audioTime);handVisuals.update(dt,performance.now());holdingPose?.update(dt,handVisuals,performance.now());presentation?.update(performance.now());
 const targetOpen=speaking?Math.min(.65,(voice?.getLevel()||0)*3.8):0;mouthOpen=THREE.MathUtils.damp(mouthOpen,targetOpen,12,dt);
 if(performance.now()-lastMouthDraw>33){paintMouth(mouthContext,transientEmotion??config.emotion,mouthOpen,config.glow);mouthTexture.needsUpdate=true;lastMouthDraw=performance.now();}controls.update();photoStage.update(performance.now(),w,h);aoCamera.copy(camera);aoCamera.layers.set(3);composer.render(dt);}frame();
window.addEventListener('keydown',e=>{if(!document.body.classList.contains('editing')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const k=e.key.toLowerCase();const map={'1':'EmoAngry','2':'EmoCry','3':'EmoThumbsUp','4':'EmoWin','5':'EmoDontKnow','6':'EmoHello','7':'EmoLaught','8':'EmoLookingFor','9':'Dance0','0':'Dance1','t':'EmoTalk1','u':'fallFront','i':'fallBack','h':'GetHitFront','q':'strafeLeft','e':'strafeRight','w':e.shiftKey?'run':'walk','s':'walkBack','a':'turn90Left','d':'turn90Right',' ':'jump'};if(map[k]){e.preventDefault();if(!e.repeat)play(byName(map[k]));}if(k==='backspace')$('reset').click();});

$('toggleEditor')?.addEventListener('click',()=>{document.body.classList.toggle('editing');$('toggleEditor').textContent=document.body.classList.contains('editing')?'收起编辑':'编辑外观';});
$('sidebarToggle')?.addEventListener('click',()=>document.body.classList.add('sidebar-open'));
document.addEventListener('click',e=>{if(document.body.classList.contains('sidebar-open')&&!e.target.closest('.right,.sidebar-toggle'))document.body.classList.remove('sidebar-open');});
