import {GestureJourney,stages} from './journey.mjs?v=clip-audio-2';
import {CameraHands} from './hands.mjs?v=clip-audio-2';
import {MotionRecognizer} from './motion.mjs';
import {GestureGuide,connections} from './guide.mjs';
import {WaitingAudio} from './waiting-audio.mjs?v=video3';

const $=id=>document.getElementById(id);
const video=$('story-video'),still=$('still'),start=$('start-experience');
let frozen=null;
const guide=new GestureGuide($('guide-canvas')),motion=new MotionRecognizer();
const sound=new WaitingAudio(),canvas=$('hand-canvas'),ctx=canvas.getContext('2d');
const journey=new GestureJourney(updateStage,playClip);
const prepareOnly=new URLSearchParams(location.search).get('prepare')==='1';
let started=!prepareOnly,hands=[],lastHandsAt=0,lastDraw=0,playGeneration=0;
let resumePlay=null;
let preferNative=!!video.canPlayType('video/mp4; codecs="hvc1"');
const camera=new CameraHands(onHands,(status,message,progress)=>{
  parent.postMessage({type:'ifs-device-status',status,message},location.origin);
  $('tracking-status').textContent=message;
  if(status==='ready')void refreshCameraPicker();
  $('camera-toggle').textContent=status==='ready'?'关闭摄像头':status==='loading'?'取消加载':'启用摄像头';
  $('model-progress').hidden=status!=='loading';
  if(typeof progress==='number')$('model-progress').value=progress;
  if(status==='error')notice(message);
});
async function refreshCameraPicker(){
  $('hand-camera-name').textContent='当前摄像头：'+(camera.deviceName||'系统默认');
  const picker=$('hand-camera-picker');if(picker.dataset.device===camera.deviceId)return;
  const devices=await navigator.mediaDevices.enumerateDevices().catch(()=>[]);
  picker.replaceChildren(new Option('系统默认摄像头',''));
  for(const d of devices.filter(d=>d.kind==='videoinput'))picker.append(new Option(d.label||'摄像头',d.deviceId));
  picker.value=camera.deviceId||'';picker.dataset.device=camera.deviceId||'';
}
$('hand-camera-picker').onchange=()=>{hands=[];lastHandsAt=0;void camera.selectDevice($('hand-camera-picker').value).then(()=>{camera.suspended=!!journey.active;});};
function notice(message){$('notice').textContent=message;$('notice').hidden=!message;}
function updateStage(){
  document.body.dataset.started=String(started);
  document.body.dataset.mode=!started?'prepared':journey.active?'playback':journey.state==='complete'?'finished':'gesture';
  document.body.dataset.state=journey.state;
  camera.suspended=!!journey.active;
  if(started&&!journey.active&&journey.state!=='complete')void camera.resume();
  motion.reset(stages[journey.state]?.gesture,performance.now());
  guide.set(stages[journey.state]?.gesture);
  $('action-progress').style.strokeDashoffset=188.5;
  const stage=stages[journey.state];
  if(stage){
    if(started)void sound.prepare(stage.next).catch(()=>{});
    $('instruction').textContent=stage.instruction;
    $('gesture-detail').textContent=stage.detail;
    $('gesture-status').textContent='跟随示范，先停稳手掌';
  }
  if(journey.state==='complete'){started=false;sound.stop();parent.postMessage({type:'ifs-complete'},location.origin);}
}
function onHands(detected){
  hands=detected;lastHandsAt=performance.now();
  document.body.dataset.tracking=String(hands.length>0);
  $('hand-information').textContent=hands.length?'实时识别 '+hands.length+' 只手 · 蓝色点线为手部关节':'暂未检测到手 · 可展开取景确认摄像头方向';
  if(!started||journey.active||journey.state==='complete')return;
  const signal=motion.update(hands,performance.now());
  document.body.dataset.gestureProgress=String(signal.progress);document.body.dataset.detectedHands=String(hands.length);
  document.body.dataset.ready=String(signal.ready);
  $('action-progress').style.strokeDashoffset=188.5*(1-signal.progress);
  $('gesture-status').textContent=!hands.length?'尚未识别到手掌，请将手掌完整放入摄像头画面':signal.ready?'已识别 '+hands.length+' 只手 · 按示范移动':'已识别 '+hands.length+' 只手 · 请短暂停稳，再按示范移动';
  if(signal.action)journey.trigger(signal.action);
}
function freeze(){
  if(video.readyState<2||!video.videoWidth)return;
  const frame=document.createElement('canvas');
  frame.width=video.videoWidth;frame.height=video.videoHeight;
  frame.getContext('2d').drawImage(video,0,0);
  // 视频放在对象存储（跨域）时，画布不能导出成图片；这时直接把画布本身当定格画面显示，
  // 不能让这里报错，否则后面的摄像头和手势识别都不会启动。
  try{still.src=frame.toDataURL('image/png');still.hidden=false;frozen?.remove();frozen=null;}
  catch{frame.className='scene';frame.setAttribute('aria-hidden','true');frozen?.remove();frozen=frame;still.after(frame);}
}
async function playClip(transition){
  if(!started)return;
  const generation=++playGeneration;
  hands=[];notice('');
  video.pause();video.classList.remove('active');
  let usingNative=preferNative;
  let loadAttempt=0;
  function beginPlayback(){
    const attempt=++loadAttempt;
    return video.play().catch(error=>{if(attempt===loadAttempt)handlePlayError(error);});
  }
  const movieUrl=()=>`assets/video/story-${transition.film}${usingNative?'':'-compatible'}.mp4?v=3hq`;
  video.src=movieUrl();
  video.muted=false;video.volume=1;video.preload='auto';video.load();
  const loading=setTimeout(()=>notice('正在加载视频…'),800);
  let stall;
  const fail=()=>{
    if(generation!==playGeneration)return;
    ++playGeneration;clearTimeout(loading);clearTimeout(stall);
    video.pause();video.classList.remove('active');
    journey.fail(transition.film);if(started)void sound.hold(journey.state);
    resumePlay=null;start.hidden=true;
    notice('视频未能播放，请重新做一次手势重试。');
  };
  const arm=()=>{clearTimeout(stall);stall=setTimeout(()=>{if(!document.hidden)fail();else arm();},45000);};
  video.onerror=()=>{
    if(generation!==playGeneration)return;
    // Some browsers advertise HEVC but cannot decode it on the current hardware.
    if(usingNative && [3,4].includes(video.error?.code)){
      usingNative=false;preferNative=false;
      video.src=movieUrl();video.load();arm();
      void beginPlayback();
    }else fail();
  };
  video.onwaiting=arm;video.onstalled=arm;
  video.onplaying=()=>{
    sound.stop();
    void sound.unlock().then(()=>{if(!resumePlay)start.hidden=true;});
    clearTimeout(loading);clearTimeout(stall);notice('');
    video.classList.add('active');still.hidden=true;frozen?.remove();frozen=null;
  };
  video.onended=()=>{
    if(generation!==playGeneration)return;
    clearTimeout(loading);clearTimeout(stall);
    if(started&&transition.next!=='complete')void sound.hold(transition.next);
    freeze();
    video.classList.remove('active');
    // Release the decoder and buffered movie before returning to gesture recognition.
    video.removeAttribute('src');video.load();
    journey.finish(transition.film);if(!camera.running&&!camera.starting&&journey.state!=='complete')void camera.start();
  };
  arm();
  try{
    // Prepare the following waiting sound BEFORE playback, never after it ends.
    await sound.prepare(transition.next);
    if(generation!==playGeneration||!started)return;
    await beginPlayback();
  }
  catch(error){handlePlayError(error);}
  function handlePlayError(error){
    if(generation!==playGeneration)return;
    if(error.name==='NotAllowedError'){
      clearTimeout(stall);clearTimeout(loading);
      start.textContent='点击播放声音';start.hidden=false;
      resumePlay=()=>{start.hidden=true;arm();void beginPlayback();};
    }else if(error.name==='NotSupportedError' && usingNative){
      usingNative=false;preferNative=false;
      video.src=movieUrl();video.load();arm();
      void beginPlayback();
    }else fail();
  }
}
start.addEventListener('click',()=>{
  if(!started)return;
  void sound.unlock().then(()=>{if(!journey.active)void sound.hold(journey.state);});
  if(resumePlay){const action=resumePlay;resumePlay=null;action();return;}
  start.hidden=true;
});
function unlockSound(){
  if(!started)return;
  void sound.unlock().then(()=>{if(!resumePlay)start.hidden=true;});
}
document.addEventListener('pointerdown',unlockSound,{passive:true});
document.addEventListener('keydown',unlockSound);
$('camera-toggle').addEventListener('click',()=>{camera.running||camera.starting?camera.stop():camera.start();});
function fullscreen(){(document.fullscreenElement?document.exitFullscreen():$('experience').requestFullscreen())?.catch(()=>{});}
$('fullscreen').addEventListener('click',fullscreen);
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='f')fullscreen();});
document.addEventListener('visibilitychange',()=>{
  if(!started){sound.stop();video.pause();return;}
  if(document.hidden){sound.stop();camera.suspended=true;video.pause();}
  else{
    camera.suspended=!!journey.active;
    motion.reset(stages[journey.state]?.gesture,performance.now());
    if(journey.active&&!resumePlay)video.play().catch(()=>{start.textContent='继续播放';start.hidden=false;resumePlay=()=>{start.hidden=true;video.play().catch(()=>notice('请再次点击播放'));};});
    else if(started&&!journey.active)void sound.hold(journey.state);
  }
});
window.addEventListener('pagehide',()=>{camera.stop();sound.stop();video.pause();});
function draw(now){
  requestAnimationFrame(draw);
  if(!started||journey.active||journey.state==='complete'||document.hidden||now-lastDraw<50)return;
  lastDraw=now;if(now-lastHandsAt>550)hands=[];
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if($('hand-camera-preview').checked&&camera.video.readyState>=2){ctx.save();ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.drawImage(camera.video,0,0,canvas.width,canvas.height);ctx.restore();}
  for(const hand of hands){
    const points=hand.points.map(p=>({x:(1-p.x)*canvas.width,y:p.y*canvas.height}));
    ctx.strokeStyle='#83dcff';ctx.lineWidth=3;ctx.beginPath();
    for(const [a,b] of connections){ctx.moveTo(points[a].x,points[a].y);ctx.lineTo(points[b].x,points[b].y);}ctx.stroke();
    ctx.fillStyle='#b9f4ff';for(const point of points){ctx.beginPath();ctx.arc(point.x,point.y,4,0,Math.PI*2);ctx.fill();}
  }
  guide.draw(now);
}
document.body.dataset.started=String(started);document.body.dataset.embedded=String(parent!==window);start.hidden=true;
updateStage();requestAnimationFrame(draw);
function beginProject(){
  if(started&&journey.active)return;
  started=true;resumePlay=null;journey.state='opening';journey.active=null;
  updateStage();void sound.unlock().catch(()=>{});journey.trigger(stages.opening.gesture);
}
function resetProject(){
  started=false;++playGeneration;resumePlay=null;
  video.onended=video.onerror=video.onwaiting=video.onstalled=video.onplaying=null;
  video.pause();video.muted=true;video.removeAttribute('src');video.load();sound.stop();
  journey.state='opening';journey.active=null;start.hidden=true;updateStage();
}
window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin)return;
  if(e.data?.type==='ifs-start')beginProject();
  if(e.data?.type==='ifs-camera-start')void camera.selectDevice(camera.selectedDeviceId);
  if(e.data?.type==='ifs-camera-stop'){camera.stop();resetProject();}
  if(e.data?.type==='ifs-reset')resetProject();
});
void camera.start();
if(new URLSearchParams(location.search).get('autostart')==='1')beginProject();
if(started){
  void sound.prepare('opening').then(()=>{if(started&&journey.state==='opening')return sound.hold('opening');}).catch(()=>{});
  void sound.unlock().catch(()=>{});
}
setTimeout(()=>{
  if(started&&sound.context?.state==='suspended'&&!resumePlay){
    start.textContent='启用声音';start.hidden=false;
  }
},1800);
