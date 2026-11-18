import assert from 'node:assert/strict';
import {RobotVoice} from '../public/voice.js';
import {isTourGreeting} from '../public/tour-flow.js';
const voice=new RobotVoice({}),sent=[];let intros=0;
voice.tour={started:false,state:'idle',busy:false,shouldStart(text){return !this.started&&isTourGreeting(text);},start(){this.started=true;intros++;},restoreListening(){}};
voice.status=()=>{};voice.log=()=>{};voice.ensureConnected=async()=>{};voice.interrupt=()=>{voice.tour.busy=false;};voice.search=()=>{};voice.update=()=>{};voice.send=e=>sent.push(e);voice.visualNarrator={};
const confirm=()=>{voice.event({type:'session.updated',session:{instructions:'本轮编号：'+voice.pendingTurn.id}});if(voice.pendingTurn?.phase==='item')voice.event({type:'conversation.item.created',item:{role:'user',content:[{type:'input_text',text:voice.pendingTurn.text}]}});};
await voice.respond('我叫小林');assert.equal(sent.length,0,'must wait for current context acknowledgement');confirm();assert.equal(intros,0);assert.equal(sent.at(-1).type,'response.create');sent.length=0;
await voice.respond('你好小弟',{spoken:true});assert.equal(intros,1);assert.equal(sent.length,0);
await voice.respond('你好小D');confirm();assert.equal(intros,1);assert.equal(sent.at(-1).type,'response.create');assert.equal(sent[0].item.content[0].text,'你好小D');sent.length=0;
await voice.respond('我对时尚产业感兴趣',{spoken:true});confirm();assert.equal(sent.length,2,'recognized text is confirmed before requesting the answer');assert.equal(sent[0].type,'conversation.item.create');assert.equal(sent[1].type,'response.create');
voice.tour.busy=true;voice.tour.state='speaking';await voice.respond('先停一下，解释刚才那个概念');confirm();assert.equal(voice.tour.busy,false);assert.equal(sent.at(-1).type,'response.create');
console.log('PASS: normal questions stay normal; first exact greeting triggers once; repeat greeting is normal; spoken input is confirmed once before answering; questions can interrupt intro and continue conversation.');

globalThis.WebSocket={OPEN:1};const remembered=new RobotVoice({});remembered.ready=true;remembered.ws={readyState:1};let inserted;remembered.send=e=>inserted=e;const acknowledged=remembered.recordFixedReply('已完成欢迎介绍');await Promise.resolve();assert.equal(inserted.item.role,'assistant');assert.equal(inserted.item.content[0].type,'output_text');remembered.event({type:'conversation.item.created',item:{role:'assistant',content:[{type:'output_text',text:'已完成欢迎介绍'}]}});await acknowledged;assert.equal(remembered.pendingFixedAck,null);console.log('PASS: the fixed spoken reply is recorded and acknowledged as an ordinary assistant turn.');
