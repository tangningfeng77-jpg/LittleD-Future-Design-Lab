import fs from 'node:fs';import assert from 'node:assert/strict';import {WebSocket} from 'ws';import {RobotVoice} from '../public/voice.js';import {VisualCueStream} from '../public/visual-cues.js';import {resolveSceneAnswer} from '../public/scene-qa.js';
globalThis.WebSocket=WebSocket;
const catalog=JSON.parse(fs.readFileSync(new URL('../public/assets/scene-qa/catalog.json',import.meta.url))),knowledge=JSON.parse(fs.readFileSync(new URL('../public/assets/lab-knowledge/knowledge.json',import.meta.url)));knowledge.images.push(...catalog.images);
const voiceName=JSON.parse(fs.readFileSync(new URL('../public/assets/robot-config.json',import.meta.url))).voice;
const fixtures=[
 {question:'我不是要看服装效果图，我想知道做出来以后，怎么确认衣服真的合身？',expected:['FAS-IMG-003','FAS-IMG-007']},
 {question:'小朋友拿着镜子和手电做活动，这背后能学到什么？',expected:['EDU-IMG-002','EDU-IMG-005']},
 {question:'门店知道哪里顾客停得久以后，下一步具体该怎么做？',expected:['RET-IMG-006','RET-IMG-003']}
];
const reports=[];
for(const fixture of fixtures){const report=await new Promise((resolve,reject)=>{
 const v=new RobotVoice({config:()=>({instructions:'你是实验室讲解员小D。',voice:voiceName,memory:''}),director:{cue(){}}});v.knowledge=knowledge;v.sceneCatalog=catalog;v.currentQuestion=fixture.question;v.sceneAnswer=resolveSceneAnswer(catalog,fixture.question);v.visualNarrator={};v.ctx={currentTime:0};v.turnKnowledge=v.search(fixture.question);v.currentTurnId='semantic-live';
 const ws=v.ws=new WebSocket('ws://127.0.0.1:4173/realtime',{origin:'http://127.0.0.1:4173'});const start=Date.now();let text='',mode=null,firstMs=null,asked=false,calls=[],toolPending=false;const timer=setTimeout(()=>{ws.close();reject(Error('Live test timed out'));},60000);
 const finish=(err)=>{clearTimeout(timer);ws.close();if(err)return reject(err);const cues=new VisualCueStream().push(text,true),ids=cues.flatMap(e=>e.ids||[]),spoken=cues.map(e=>e.text||'').join('');resolve({question:fixture.question,firstMs,elapsedMs:Date.now()-start,ids,text:spoken,calls,pass:ids.some(id=>fixture.expected.includes(id))});};
 ws.on('message',data=>{const e=JSON.parse(data);if(e.type==='session.created')v.update({modalities:['text']});
 if(e.type==='session.updated'&&!asked){asked=true;v.send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:fixture.question}]}});v.send({type:'response.create'});}
 if(['response.text.delta','response.audio_transcript.delta','response.output_audio_transcript.delta'].includes(e.type)){if(!mode)mode=e.type;if(mode===e.type){if(firstMs===null)firstMs=Date.now()-start;text+=e.delta;}}
 if(e.type==='response.function_call_arguments.done'){calls.push(e.name);v.tool(e);toolPending=true;}
 if(e.type==='response.done'){if(toolPending){toolPending=false;v.awaitingTools=false;v.send({type:'response.create'});}else finish(e.response?.status==='completed'?null:Error('Provider reply failed'));}
 if(e.type==='error'||e.type==='relay.error'||e.code)finish(Error(e.error?.message||e.message||'Provider error'));
 });ws.on('error',()=>finish(Error('Local connection failed')));
});reports.push(report);console.log(JSON.stringify(report));}
fs.writeFileSync(new URL('../handoff/semantic-visuals-live-20261112.json',import.meta.url),JSON.stringify(reports,null,2));assert(reports.every(r=>r.pass),'Each novel answer must select a semantically relevant image');
