export function terms(text){const s=String(text).toLowerCase().replace(/\bifs(?:膜)?/g,'ifs 离子精筛膜');return [...new Set([...(s.match(/[a-z0-9][a-z0-9.-]+/g)||[]),...(s.match(/[\u3400-\u9fff]+/g)||[]).flatMap(w=>w.length<2?[]:Array.from({length:w.length-1},(_,i)=>w.slice(i,i+2)))])].filter(x=>!['什么','介绍','一下','可以','我们','这个','相关','一下','图片','展示'].includes(x));}
export function searchKnowledge(knowledge,query,limit=4){const tokens=terms(query);if(!tokens.length)return[];return knowledge.pages.map(p=>{const title=(p.title+' '+p.path).toLowerCase(),body=p.text.toLowerCase(),caption=(p.imageText||'').toLowerCase();let hits=0,score=0;for(const t of tokens){const n=title.includes(t)?7:body.includes(t)?3:caption.includes(t)?1:0;if(n)hits++;score+=n}return{...p,rawScore:score,score:score/Math.sqrt(1+body.length/2500),coverage:hits/tokens.length}}).filter(p=>p.rawScore>=3&&p.coverage>=.2).sort((a,b)=>b.score-a.score).slice(0,limit);}
const subjectRules=[
 [/ifs|离子精筛|脱盐|膜分离|淡化|盐碱水|苦咸水|咸水|净水/i,/ifs|离子精筛|脱盐|膜组件|膜结构|膜材料|淡化设备|膜产线|膜相关产线|水处理设备/i],
 [/云衣|服装|时尚|面料|穿搭|钮扣|纽扣|试衣/i,/云衣|服装|时尚|面料|穿搭|钮扣|纽扣|试衣/i],
 [/凯鸿|物流|联运|货运|仓储|运输/i,/凯鸿|物流|联运|货运|仓储|运输/i],
 [/公安|警务|执法|交警|多模态感知|交通感知/i,/公安|警务|执法|交警|交通|车牌|监控|感知系统/i],
 [/门店|零售|商圈|客流|商业运营/i,/门店|零售|商圈|客流|商铺|商业运营/i],
 [/乐处|互动艺术|艺术装置|文旅|沉浸|泡泡|装置/i,/乐处|互动|艺术|装置|文旅|沉浸|泡泡/i],
 [/绿色设计|低碳|可持续|生态设计/i,/绿色设计|低碳|可持续|生态设计/i]
];
export function relevantImage(image,query){const label=(image.title+' '+image.description).toLowerCase();if(/现金流|投资测算|财务方案|预算表|收入预测/.test(label)&&!/预算|投资|收入|财务|现金流|成本/.test(query))return false;if(/卫星|地图|区位|选址|总平面/.test(label)&&!/卫星|地图|区位|选址|位置|建设|布局|哪里/.test(query))return false;const rules=subjectRules.filter(([q])=>q.test(query));if(!rules.length)return false;return rules.some(([,p])=>p.test(label));}
export function selectVisuals(knowledge,text,candidates=null){const pages=candidates||searchKnowledge(knowledge,text,4),tokens=terms(text).filter(t=>!['设计','智能','实验','验室','介绍','项目','技术','相关','系统','展示','可以','通过','我们','知识','这个','什么'].includes(t)),index=new Map((knowledge.images||[]).map(i=>[i.id,i]));const available=new Map();for(const p of pages)for(const id of p.images||[]){const image=index.get(id);if(!image||!relevantImage(image,text))continue;const label=(image.title+' '+image.description).toLowerCase(),score=tokens.reduce((n,t)=>n+(label.includes(t)?2:0),0);if(score>=4&&score>(available.get(id)?.score||0))available.set(id,{...image,score});}return [...available.values()].sort((a,b)=>b.score-a.score).slice(0,2);}
export class VisualNarrator{
 constructor({knowledge,present,clear}){Object.assign(this,{knowledge,present,clear});this.begin()}
 begin(){this.queue=[];this.seen=new Set();this.candidates=null;this.explicit=null;this.offset=0;this.lastAt=-Infinity;this.active=true;this.query='' }
 text(full,at){if(!this.active)return;const fresh=full.slice(this.offset);if(fresh.length<14||!/[。！？；，,.!?]/.test(fresh))return;const images=this.explicit||selectVisuals(this.knowledge,this.query||fresh,this.candidates);if(!images.length)return;if(at-this.lastAt<7)return;const novel=images.filter(i=>!this.seen.has(i.id));if(!novel.length)return;this.explicit=null;novel.forEach(i=>this.seen.add(i.id));this.queue.push({at,images:novel});this.lastAt=at;this.offset=full.length;}
 tick(time){while(this.active&&this.queue.length&&this.queue[0].at<=time)this.present(this.queue.shift().images)}
 cancel(){this.active=false;this.queue=[];this.explicit=null;this.clear()}
}
