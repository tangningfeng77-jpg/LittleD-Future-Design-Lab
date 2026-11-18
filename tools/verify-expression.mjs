import assert from 'node:assert/strict';
import {SpeechDirector,inferExpression} from '../public/expression.js';
const events=[];const d=new SpeechDirector({perform:a=>events.push(['action',a]),emote:e=>events.push(['emotion',e])});
d.text('你好呀，我是小D。',10);d.tick(9.9);assert.equal(events.length,0);d.tick(10);assert.deepEqual(events,[['emotion',1],['action','EmoHello']]);
d.text('你好呀，我是小D。你好，很高兴认识你。',11);d.tick(11);assert.equal(events.length,2,'stream deltas must not retrigger greeting');
d.text('你好呀，我是小D。你好，很高兴认识你。太棒了，做得很好！',14);d.tick(14);assert.equal(events.at(-1)[1],'EmoThumbsUp');
d.cue({animation:'EmoLookingFor'},20,true);d.cancel();const count=events.length;d.tick(25);assert.equal(events.length,count,'interrupt must discard pending gestures');
assert.equal(inferExpression('我不确定这份资料是否完整。').emotion,3);assert.equal(inferExpression('别难过，我陪着你。').emotion,2);assert.equal(inferExpression('首先，我们可以从基础开始。').animation,'EmoTalk1');assert.equal(inferExpression('今天的日期是星期三。'),null);
d.begin();d.text('普通回答，不需要强烈的动作。',30);d.tick(30);assert.equal(d.queue.length,0);
console.log('PASS: playback-clock timing, streamed deduplication, greeting/encouragement/uncertainty/sympathy, interrupt cancellation.');

const gentle=[];const streamed=new SpeechDirector({perform:a=>gentle.push(['action',a]),emote:e=>gentle.push(['emotion',e])});streamed.text('哇，',40);streamed.tick(40);streamed.text('哇，太棒了！你肯定能行！',40.8);streamed.tick(40.8);assert.equal(gentle.findLast(x=>x[0]==='emotion')[1],1,'encouragement should soften a brief surprised expression');assert.equal(gentle.filter(x=>x[0]==='action').length,1,'short clauses should not twitch between gestures');
