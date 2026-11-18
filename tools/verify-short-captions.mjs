import assert from 'node:assert/strict';
import {splitSpeechText} from '../public/speech-segments.js';
const samples=[
 '智慧农业的核心思路是先感知、再理解、最后执行：用传感器和图像数据了解农田、温室或养殖环境的状态，再通过模型判断生长情况、资源消耗和风险点。',
 '接下来，您对哪个领域更感兴趣？',
 'IDM-VTON技术可以保持服装细节，并让人物在虚拟试衣中更自然。',
 '系统先感知环境。模型再判断需求。最后执行灌溉。',
 '产水率的设计目标是98.5%，预计每天处理30吨水；具体结果以实测为准。',
 '第一句。\n\n第二句，带有自然停顿。',
 '他问：“您想了解哪个领域？”我们可以接着聊。'
];
for(const text of samples){const pieces=splitSpeechText(text);assert.equal(pieces.join(''),text,'segmentation must preserve the full answer');assert(pieces.every(p=>p.trim().length));}
assert.equal(splitSpeechText(samples[0]).length,1,'a long complete sentence must wrap rather than be chopped mid-sentence');
assert.equal(splitSpeechText(samples[1]).length,1,'keep the introductory comma inside its full question');
assert.equal(splitSpeechText(samples[3]).length,3,'present short complete sentences separately');
assert(splitSpeechText(samples[4])[0].includes('98.5%'),'preserve numbers, units and terms');
assert(splitSpeechText(samples[6])[0].endsWith('？”'),'keep closing quotation marks with the spoken sentence');
console.log('PASS: only semantic sentence boundaries; short sentences stay separate; no cuts at commas or arbitrary character limits; full wording, numeric terms and closing quotes preserved.');
const {RobotVoice}=await import('../public/voice.js');
const voice=new RobotVoice({}),spoken=[];voice.queueReplySentence=t=>spoken.push(t);
voice.appendSubtitle('他问：“您想了解哪个领域？');assert.equal(spoken.length,0,'wait for a following closing quote rather than cutting it off');
voice.appendSubtitle('”我们可以接着聊。');voice.appendSubtitle('',true);assert.deepEqual(spoken,['他问：“您想了解哪个领域？”','我们可以接着聊。']);
console.log('PASS: streaming transcript chunks preserve complete sentences and quotation boundaries.');
