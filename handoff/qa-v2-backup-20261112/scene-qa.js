import {terms} from './lab-knowledge.js';
const qaTerms=s=>terms(String(s).replace(/为什么|是不是|能不能|怎么样|是什么|有什么|怎样|怎么|哪些|什么|多少|是否|区别|差在哪|分开|区分|要|和|与|的|了|呢|吗/g,' '));
const clean=s=>String(s).replace(/[\s，。？！、,.?!]/g,'').toLowerCase();
export const sceneAnswerRules='六大场景选择后的问答已经开放。以本轮场景大纲为依据自然组织语言，不必逐字背诵。首次选中场景先用三至五个短句概述定义与核心链路，再给出一至两个浅层、容易理解的可追问方向。不要连续追问、层层深入或一次列出所有子问题。后续直接回答访客的问题，可在确有帮助时只补充一个追问。不得把规划说成建成，把生成示意图说成项目实拍或效果证明。大纲是优先参考资料而非封闭题库，不要求逐字照读。对未命中题目的新问题仍需理解意图，综合相关大纲、已知事实及联网结果作答。问题涉及最新信息、公开事实核实或大纲以外的具体内容时调用search_web；不要把大纲中的历史状态当成当前最新状态。联网失败时只陈述有依据的已知内容，不编造。图片由当前问题的明确映射约束，优先一张主图；场景概述用两张总览图。图片在讲解开始后由程序配合左右手平滑呈现；不要为配图反复做挥手动作。';
export function resolveSceneAnswer(catalog,query,{scene=null,entry=false}={}){
 if(!catalog)return null;
 if(entry&&catalog.scenes[scene]){const s=catalog.scenes[scene];return{mode:'overview',scene,definition:s.definition,topics:s.topics.split('｜').slice(0,2),images:s.images,records:[]};}
 const tokens=qaTerms(query),q=clean(query);
 const ranked=catalog.questions.map(r=>{const variants=[r.question,...r.question_variants],exact=variants.some(v=>clean(v)===q);let score=exact?10:Math.max(...variants.map(v=>{const t=qaTerms(v);const hits=tokens.filter(x=>t.includes(x)).length;return hits/Math.max(1,Math.sqrt(tokens.length*t.length));}));if(r.scene===scene)score+=.06;return{r,score,exact};}).filter(x=>x.exact||x.score>=.3).sort((a,b)=>b.score-a.score);
 if(!ranked.length)return null;
 const best=ranked[0];return{mode:'question',scene:best.r.scene,records:[best.r],images:best.r.image_ids.slice(0,2),score:best.score};
}
export function sceneAnswerContext(catalog,answer){if(!answer)return null;const images=answer.images.map(id=>catalog.images.find(i=>i.id===id)).filter(Boolean);return{phase:answer.mode,scene:answer.scene,definition:answer.definition,followUpTopics:answer.topics,answers:answer.records,images, note:'仅按这些图片ID和含义展示。一般使用第一张主图；概述时使用两张总览图。回答以事实大纲为依据，不把生成图当成项目证明。'};}
export function primarySceneImages(catalog,answer){if(!answer)return[];return answer.images.slice(0,answer.mode==='overview'?2:1).map(id=>catalog.images.find(i=>i.id===id)).filter(Boolean);}

// Broader retrieval supports novel questions without declaring a forced FAQ match.
export function retrieveOutline(catalog,query,scene=null){
 if(!catalog)return[];const tokens=qaTerms(query);if(!tokens.length)return[];
 return catalog.questions.map(r=>{const heading=qaTerms([r.question,...r.question_variants,r.intent].join(' '));const body=qaTerms(r.answer+' '+r.points);let score=0,hits=0;for(const t of tokens){if(heading.includes(t)){score+=3;hits++;}else if(body.includes(t)){score++;hits++;}}
 return{r,score:score/Math.sqrt(Math.max(1,tokens.length))+(r.scene===scene?.1:0),hits};}).filter(x=>x.hits>=2&&x.score>=1).sort((a,b)=>b.score-a.score).slice(0,4).map(x=>x.r);
}
export function taggedOutlineImages(catalog,query,records){
 if(!catalog)return[];const text=String(query).replace(/镜子/g,'镜面').replace(/云医|云依/g,'云衣');const tokens=qaTerms(text),ids=new Set(records.slice(0,2).flatMap(r=>r.image_ids));
 return catalog.images.filter(i=>ids.has(i.id)).map(i=>{const score=i.tags.reduce((sum,tag)=>{const ts=qaTerms(tag);const hit=ts.filter(t=>tokens.includes(t)).length;return sum+(text.toLowerCase().includes(tag.toLowerCase())?3:ts.length&&hit>=2&&hit/ts.length>=.5?hit:0);},0);return{...i,score};}).filter(i=>i.score>=3).sort((a,b)=>b.score-a.score).slice(0,2);
}
