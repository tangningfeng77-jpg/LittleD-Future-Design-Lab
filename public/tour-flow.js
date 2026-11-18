import {splitSpeechText} from './speech-segments.js';
export const welcomeText = '您好，欢迎来到浙江大学未来设计实验室！我是小 D，接下来，我会带你了解未来设计实验室。参观过程中，有什么好奇的，随时都可以问我。我们先从实验室的整体介绍开始吧！\n\n在这里，我们把设计与人工智能结合起来，探索新技术怎样走进生活、帮助产业解决实际问题。我们的研究涵盖智慧农业、公安政务、时尚产业、智慧物流、数字商业运营和未来教育六大领域。我将带你看一个视频，具体了解一下这六大场景。';
export const isTourGreeting = text => /^(?:啊|呀|哎|诶|喂|嗯)*(?:(?:你好|您好)[啊呀哇哦噢]*)?小[dp迪弟地滴][啊呀哇哦噢]*(?:你好|您好)?$/.test(String(text).normalize('NFKC').toLowerCase().replace(/[\s，。！？、,.!?～~]/g,''));
export const welcomeInstructions = `你是小D，正在进行参观开场。这一轮是固定欢迎语朗读，不是自由问答。以与日常对话相同的音色，用自然、亲切、清晰的迎宾语气，中等语速，句末自然停顿。只逐字朗读下面的欢迎语，不增删、不改写、不解释、不加开头结尾、不调用工具。D读作英文字母D。读完即停止，应用会播放视频。固定欢迎语：\n${welcomeText}`;
export const normalizeScript = text => String(text).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'').replace(/小(?:迪|弟|地|滴)/g,'小d');
export const afterVideoText='这就是实验室六大领域的整体介绍。接下来，您对哪个领域更感兴趣？也可以直接问我想了解的问题。';
// Only validated audio from the current Bailian model/voice is cached.
const memory=new Map();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function cacheKey(text,voice,model){return JSON.stringify(['bailian-fixed-v5-semantic',model,voice,text]);}
async function database(){return new Promise((resolve,reject)=>{const open=version=>{const req=version?indexedDB.open('little-d-fixed-speech',version):indexedDB.open('little-d-fixed-speech');req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('speech'))req.result.createObjectStore('speech');};req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('speech')){const next=db.version+1;db.close();open(next);return;}db.onversionchange=()=>db.close();resolve(db);};req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('语音缓存正在更新'));};open();});}
async function savedAudio(key,value){let db;try{db=await database();return await new Promise((resolve,reject)=>{const tx=db.transaction('speech',value?'readwrite':'readonly');const req=value?tx.objectStore('speech').put(value,key):tx.objectStore('speech').get(key);let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}catch{return null;}finally{db?.close();}}
export const splitScript=splitSpeechText;
async function generatePiece(text,voice,job){return new Promise((resolve,reject)=>{const socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/realtime');let transcript='',chunks=[],settled=false;const timer=setTimeout(()=>finish(Error('百炼固定语音生成超时')),10000);const send=e=>socket.send(JSON.stringify({...e,event_id:crypto.randomUUID()}));function finish(error){if(settled)return;settled=true;clearTimeout(timer);job?.cancelCallbacks?.delete(cancel);socket.close();error?reject(error):resolve({text,transcript,chunks});}
 const cancel=()=>finish(Error('已取消旧语音'));if(job){job.cancelCallbacks??=new Set();job.cancelCallbacks.add(cancel);if(job.cancelled){cancel();return;}}
 socket.onmessage=e=>{try{const event=JSON.parse(e.data);if(event.type==='session.created')send({type:'session.update',session:{modalities:['text','audio'],instructions:'你是小D。当前是固定语料的一个连续片段。用日常对话同一个音色，自然亲切、中等语速，逐字朗读本片段，不添加任何开头结尾，不解释、不概括、不调用工具。D读作英文字母D。本片段全文：\n'+text,tools:[],turn_detection:null,input_audio_transcription:null,temperature:0,seed:1314,repetition_penalty:1,audio:{output:{voice,format:{type:'pcm',sample_rate:24000}}}}});
 else if(event.type==='session.updated'){send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:'仅逐字朗读以下原文，读完停止：\n'+text}]}});send({type:'response.create'});}
 else if(['response.audio.delta','response.output_audio.delta'].includes(event.type))chunks.push(event.delta);
 else if(['response.audio_transcript.delta','response.output_audio_transcript.delta'].includes(event.type))transcript+=event.delta;
 else if(event.type==='response.done'){if(event.response?.status!=='completed'||!chunks.length)return finish(Error('百炼未返回固定语音'));if(normalizeScript(transcript)!==normalizeScript(text))return finish(Error('百炼固定语料需重新生成'));finish();}
 else if(event.type==='error'||event.type==='relay.error'||event.code)finish(Error(event.error?.message||event.message||'百炼暂不可用'));}catch(err){finish(err);}};
 socket.onerror=()=>finish(Error('百炼语音连接失败'));socket.onclose=()=>{if(!settled)finish(Error('百炼语音连接中断'));};});}
let synthesisActive=0,backgroundActive=0;const synthesisQueue=[];
function pumpSynthesis(){
 while(synthesisQueue.length&&synthesisQueue[0].job?.cancelled)synthesisQueue.shift().reject(Error('已取消旧语音'));
 while(synthesisActive<2){const foreground=synthesisQueue.findIndex(t=>!t.job?.background);const index=foreground>=0?foreground:backgroundActive<1?0:-1;if(index<0||!synthesisQueue.length)return;
  const task=synthesisQueue.splice(index,1)[0],background=!!task.job?.background;synthesisActive++;if(background)backgroundActive++;
  generatePiece(task.text,task.voice,task.job).then(task.resolve,task.reject).finally(()=>{synthesisActive--;if(background)backgroundActive--;pumpSynthesis();});
 }
}
function limitedGenerate(text,voice,job){return new Promise((resolve,reject)=>{synthesisQueue.push({text,voice,job,resolve,reject});pumpSynthesis();});}
export function requestFixedSpeech(text,voice,model,{background=false}={}){const key=cacheKey(text,voice,model);if(memory.get(key)?.cancelled)memory.delete(key);if(memory.has(key)){const existing=memory.get(key);if(!background){existing.background=false;pumpSynthesis();}return existing;}const job={pieces:[],done:false,error:null,cached:false,background};memory.set(key,job);job.promise=(async()=>{const saved=await savedAudio(key);if(saved?.pieces?.length&&normalizeScript(saved.pieces.map(p=>p.transcript).join(''))===normalizeScript(text)&&saved.pieces.every(p=>p.chunks?.length)){job.pieces=saved.pieces;job.cached=true;job.done=true;return;}
 for(const piece of splitScript(text)){let result,error;for(let attempt=0;attempt<(job.background?1:2);attempt++){if(job.cancelled)throw Error('已取消旧语音');try{result=await limitedGenerate(piece,voice,job);break;}catch(e){error=e;}}if(!result)throw error;job.pieces.push(result);}
 job.done=true;await savedAudio(key,{pieces:job.pieces});})().catch(error=>{job.error=error;job.done=true;if(memory.get(key)===job)memory.delete(key);});return job;}
export function cancelPendingSpeech(){
 for(const [key,job]of memory)if(!job.background&&!job.done){job.cancelled=true;for(const cancel of job.cancelCallbacks||[])cancel();if(memory.get(key)===job)memory.delete(key);}
 for(let i=synthesisQueue.length-1;i>=0;i--)if(synthesisQueue[i].job?.cancelled)synthesisQueue.splice(i,1)[0].reject(Error('已取消旧语音'));
 pumpSynthesis();
}
export class TourFlow {
 constructor(voice){
  this.voice=voice;this.state='idle';this.started=false;this.welcomeDelivered=false;this.guidanceDelivered=false;this.token=0;
  const panel=document.createElement('section');panel.className='tour-player';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','实验室介绍视频');
  panel.innerHTML='<video playsinline preload="auto" disablepictureinpicture disableremoteplayback src="./assets/tour/1111.mp4"></video><button class="tour-skip" type="button">结束视频</button>';
  document.body.append(panel);this.panel=panel;this.video=panel.querySelector('video');this.video.muted=true;
  panel.querySelector('button').onclick=()=>this.finishVideo('skipped');
  this.video.onended=()=>this.finishVideo('completed');
  this.video.onerror=()=>{if(this.state==='video')this.failure('视频暂时无法播放。');};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.state==='video')this.finishVideo('skipped');});
 }
 shouldStart(text){return !this.started&&isTourGreeting(text);}
 get conversationContext(){if(!this.started)return '本次参观尚未进行欢迎介绍。除首次开场问候由应用衔接外，其余均是正常对话，直接回答访客当前问题。';return '开场欢迎已使用，不再主动重复欢迎或播放视频。当前正常连续问答。'+(this.welcomeDelivered?'此前已介绍实验室六大领域。':'')+(this.videoResult==='completed'?'访客已看完介绍视频。':'')+(this.guidanceDelivered?'你已经问过访客还有什么想了解的，请回应访客的选择和问题。':'');}
 get busy(){return ['preparing','speaking','moving','video','returning'].includes(this.state);}
 get model(){return this.voice.providerModel||'qwen3.8-omni-flash-realtime';}
 get followup(){return this.voice.config().afterVideoGuidance??afterVideoText;}
 prepare(){if(this.prepared)return;this.prepared=true;const voice=this.voice.config().voice;for(const text of [welcomeText,this.followup])if(text.trim())requestFixedSpeech(text,voice,this.model);this.video.load();}
 start(){if(this.started||this.busy)return false;this.started=true;this.voice.interrupt();this.voice.sceneChoices?.reset();this.resumeAutoMic=true;this.voice.stopCapture();this.voice.stopVision();this.voice.handVisuals?.clear();this.video.pause();this.video.currentTime=0;this.startedAt=performance.now();this.firstAudioAt=null;this.voice.update();this.speak(welcomeText,'welcome');return true;}
 async speak(text,phase){
  const token=++this.token;this.phase=phase;this.state='preparing';this.voice.status(phase==='welcome'?'小D正在准备欢迎介绍…':'小D正在准备引导…');
  try{
   await this.voice.audio();const job=requestFixedSpeech(text,this.voice.config().voice,this.model);this.lastJob=job;let index=0,started=false;
   while(token===this.token){
    if(job.error)throw job.error;
    while(index<job.pieces.length){
     if(!started){started=true;this.state='speaking';this.firstAudioAt=performance.now();this.voice.recordFixedReply?.(text);this.voice.log('小D',text);this.voice.director?.begin();this.voice.status(phase==='welcome'?'小D正在介绍实验室…':'小D正在询问你想了解的内容…');}
     if(token!==this.token)return;await this.voice.playSentence(job.pieces[index++]);
    }
    if(job.done&&index===job.pieces.length)break;await sleep(35);
   }
   if(token!==this.token)return;
   if(phase==='welcome'){
    this.welcomeDelivered=true;this.state='moving';this.voice.status('小D正在移到右下角…');
    await this.voice.presentation?.moveToCorner();if(token!==this.token)return;this.state='video';await this.playVideo();
   }else{this.guidanceDelivered=true;this.state='done';this.voice.sceneChoices?.show();this.voice.update();await this.restoreListening();}
  }catch(error){if(token===this.token)this.failure(error.message);}
 }
 async playVideo(){
  this.panel.hidden=false;document.body.classList.add('tour-watching');this.voice.presentation?.watch();this.video.pause();this.video.currentTime=0;this.video.muted=true;this.video.controls=false;
  try{await this.video.play();if(this.state!=='video'){this.stopVideo();return;}this.video.muted=false;this.voice.status('小D陪你看视频，播放结束后继续交流。');}
  catch(error){this.failure('视频自动播放失败：'+error.message);}
 }
 stopVideo(){this.video.pause();this.video.muted=true;this.video.removeAttribute('autoplay');this.panel.hidden=true;document.body.classList.remove('tour-watching');}
 async finishVideo(result='skipped'){
  if(this.state!=='video')return;const token=++this.token;this.videoResult=result;this.state='returning';this.stopVideo();this.voice.stopAudio();this.voice.status('小D正在回到中央…');
  await this.voice.presentation?.returnToCenter();if(token!==this.token)return;
  this.resumeAutoMic=true;if(this.followup.trim())this.speak(this.followup,'followup');else{this.state='done';this.voice.sceneChoices?.show();await this.restoreListening();}
 }
 async restoreListening(){
  if(!this.resumeAutoMic||this.busy||this.restoringMic)return;const token=this.token;this.restoringMic=true;
  try{await this.voice.ensureConnected();if(token!==this.token||this.busy)return;await this.voice.capture();if(token!==this.token||this.busy)return;this.voice.send({type:'input_audio_buffer.clear'});this.voice.autoTalking=false;this.voice.sent=0;document.getElementById('autoMic').checked=true;this.resumeAutoMic=false;this.voice.status('等待你说话…');}
  catch(error){this.voice.status('麦克风恢复失败，请点击连接 AI：'+error.message);}finally{this.restoringMic=false;}
 }
 failure(message){this.token++;this.state='error';this.stopVideo();this.voice.stopAudio();this.voice.presentation?.returnToCenter();this.resumeAutoMic=true;this.voice.status(message+' 可以继续提问。');this.restoreListening();}
 cancel(){this.token++;this.state='idle';this.stopVideo();this.voice.presentation?.returnToCenter();this.voice.setSpeaking(false);}
}
