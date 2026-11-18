import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchKnowledge,selectVisuals,VisualNarrator} from '../public/lab-knowledge.js';
const knowledge=JSON.parse(fs.readFileSync(new URL('../public/assets/lab-knowledge/knowledge.json',import.meta.url)));
assert.equal(knowledge.images.length,478);assert(knowledge.pages.length>=80);
for(const i of knowledge.images)assert(fs.existsSync(new URL('../public/'+i.url.slice(2),import.meta.url)),i.id);
for(const query of ['iFS 离子精筛膜 盐碱水 淡化','云衣 服装生成','凯鸿物流 联运','公安 多模态感知','数字门店 客流','乐处空间 互动艺术']){const pages=searchKnowledge(knowledge,query);assert(pages.length,query);assert(pages.some(p=>p.images.length),query+' images');const visuals=selectVisuals(knowledge,query,pages);if(/iFS|云衣|凯鸿/.test(query))assert(visuals.length,query+' relevant visual');console.log(query,'→',pages[0].title,visuals.map(i=>i.id).join(','));}
assert.equal(searchKnowledge(knowledge,'zxqvvv123unknown987').length,0);assert.equal(selectVisuals(knowledge,'今天天气真好，我们一起聊天吧。').length,0);
const shown=[],n=new VisualNarrator({knowledge,present:x=>shown.push(x),clear:()=>shown.push('clear')});n.text('iFS离子精筛膜用于盐碱水淡化，我们来看看相关结构。',10);n.tick(9);assert.equal(shown.length,0);n.tick(10);assert.equal(shown.length,1);n.text('iFS离子精筛膜用于盐碱水淡化，我们来看看相关结构。',11);n.tick(11);assert.equal(shown.length,1);n.cancel();n.tick(100);assert.equal(shown.at(-1),'clear');assert.equal(n.queue.length,0);
console.log('PASS: all assets, six domains, relevance, unknown fallback, playback timing, stream deduplication and interrupt.');
assert.equal(selectVisuals(knowledge,'请介绍绿色设计。').length,0,'broad design words must not trigger random gallery images');
const membrane=selectVisuals(knowledge,'iFS离子精筛膜');assert(membrane.length);assert(membrane.every(i=>!/卫星|地图|区位|预算|泡泡/.test(i.title)),'membrane question must not show maps, budgets or art');
const fashion=selectVisuals(knowledge,'云衣 服装生成');assert(fashion.every(i=>/服装|面料|云衣|时尚/.test(i.title+i.description)),'fashion must stay on topic');
console.log('PASS: wrong-topic regressions: broad green design, membrane vs maps/art, fashion isolation.');
