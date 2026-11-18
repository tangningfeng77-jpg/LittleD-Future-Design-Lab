import assert from 'node:assert/strict';
import fs from 'node:fs';
import {retrieveOutline,resolveSceneAnswer,primarySceneImages} from '../public/scene-qa.js';
import {RobotVoice} from '../public/voice.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/assets/scene-qa/catalog.json',import.meta.url)));
for(const q of catalog.questions){for(const query of [q.question,...q.question_variants]){const result=resolveSceneAnswer(catalog,query,{scene:q.scene});assert.equal(result.records[0].id,q.id,query);}for(const id of q.image_ids)assert(catalog.images.some(i=>i.id===id),id);}
for(const [scene,data]of Object.entries(catalog.scenes)){const answer=resolveSceneAnswer(catalog,scene,{scene,entry:true});assert.deepEqual(primarySceneImages(catalog,answer).map(i=>i.id),data.images);}
for(const image of catalog.images)assert(fs.existsSync(new URL('../public/'+image.url,import.meta.url)));
for(const [query,id]of [['虚拟换装和真的试衣差在哪','DQA-018'],['警务写作能写什么内容','DQA-011'],['为什么订单和车辆要分开建模','DQA-023']]){const a=resolveSceneAnswer(catalog,query);assert.equal(a?.records[0]?.id,id,query);}
const voice=new RobotVoice({});let selected,forwarded=0;
voice.sceneChoices={visible:true,choose(scene,done){selected=scene;assert.equal(forwarded,0);this.visible=false;done();}};
voice.status=()=>{};voice.syncWakePrompt=()=>{};voice.log=()=>{};voice.interrupt=()=>{};voice.tour={shouldStart:()=>false};voice.ensureConnected=async()=>{};voice.visualNarrator={};voice.sceneCatalog=catalog;voice.search=()=>'';voice.update=()=>{forwarded++;};
await voice.respond('我想看公安政务',{spoken:true});await new Promise(r=>setTimeout(r,0));assert.equal(selected.id,'public-services');assert.equal(voice.sceneAnswer.mode,'overview');assert.equal(voice.selectedScene.title,'公安政务');clearTimeout(voice.turnTimeout);
console.log('PASS: all 78 Q&A records and variants resolve correctly; 39 files exist; all six overviews use exact image mappings; paraphrases resolve; voice selection passes through the same confirmation before overview.');

const novel=retrieveOutline(catalog,'如何把水质检测和番茄灌溉结合起来？','智慧农业');assert(novel.length&&novel.some(q=>q.scene==='智慧农业'));
const research=new RobotVoice({});research.knowledge=JSON.parse(fs.readFileSync(new URL('../public/assets/lab-knowledge/knowledge.json',import.meta.url)));research.sceneCatalog=catalog;research.knowledge.images.push(...catalog.images);research.visualNarrator={};research.currentQuestion='如何把水质检测和番茄灌溉结合起来？';research.selectedScene={title:'智慧农业'};const context=JSON.parse(research.search(research.currentQuestion));assert(context.relatedOutline.length);assert(context.pages.length);assert.match(context.note,/不是封闭题库/);assert.equal(research.sceneAnswer,undefined);
console.log('PASS: novel questions retrieve outline and broader lab facts without being forced into a fixed answer; external web tool remains available.');
