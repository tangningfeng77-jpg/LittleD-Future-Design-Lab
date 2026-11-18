// Hidden output cues allow Bailian to pair an answer with images in the same generation.
export class VisualCueStream{
 constructor(){this.buffer='';}
 push(delta,flush=false){this.buffer+=delta||'';const events=[];
  while(this.buffer){const start=this.buffer.indexOf('[[');if(start<0){if(!flush&&this.buffer.endsWith('[')){if(this.buffer.length>1)events.push({text:this.buffer.slice(0,-1)});this.buffer='[';break;}events.push({text:this.buffer});this.buffer='';break;}
   if(start>0){events.push({text:this.buffer.slice(0,start)});this.buffer=this.buffer.slice(start);}
   const end=this.buffer.indexOf(']]');if(end<0){if(flush)this.buffer='';break;}
   const cue=this.buffer.slice(2,end);this.buffer=this.buffer.slice(end+2);
   if(cue.startsWith('图:')||cue.startsWith('图：'))events.push({ids:cue.slice(2).split(/[|,，、\s]+/).filter(Boolean).slice(0,2)});
  }return events;
 }
}
export function visualLibraryPrompt(catalog){if(!catalog)return'';return '\n可用的全部场景配图（供你理解回答与图像之间的语义关系，不要求用户问题原文命中标签）：'+JSON.stringify(catalog.images.map(i=>({id:i.id,scene:i.scene,title:i.title,tags:i.tags,meaning:i.description,kind:i.kind})))+'\n每次回答都要根据你实际正在解释的内容主动挑选配图，不限于场景总览和预设问法。图必须直接解释该段内容。先确认当前句子解释的具体对象、操作或机制，再选能直接展示这一对象或操作的图；不能只因为同属一个场景或出现“体验、观察、反馈”等词就配图。欢迎、介绍六领域名称、过渡及下一步引导不配图。把配图标记放在包含对应具体对象的那句话前，不提前放在泛泛概述前。找到合适图时，在对应句子前输出隐藏标记[[图:图片ID]]，比较两图时用[[图:左图ID|右图ID]]。例如讲真实试衣与量体用[[图:FAS-IMG-003]]，讲镜面反射用[[图:EDU-IMG-005]]。标记交给程序显示，不要口头解释或重复图片ID。图片为生成的场景示意，不是项目实拍。通常一轮一至两图；配图要跟随后续实际内容，不要只为总览和回答的第一句配图。例如先讲客流热区可选RET-IMG-003，转到门店陈列补货时可在该句前换RET-IMG-006。短回答只需一张最有帮助的图；话题明显改变时才换图。没有直接相关图片时不加标记。不要为了配图反复检索、调用工具或重复讲解。配图和正文在同一轮输出，直接使用上述隐藏标记；不要为了选图发起工具调用。';}
// If a later conversational turn omits a visual cue, match the actual spoken
// explanation against image labels as a conservative fallback, never the scene alone.
export function answerVisualFallback(catalog,text){
 if(!catalog)return[];const normalized=String(text).toLowerCase().replace(/试穿|合身/g,'试衣 量体').replace(/镜子|光学|光的反射/g,'镜面 反射').replace(/补充库存/g,'补货').replace(/警务文书/g,'警务 智能写作').replace(/纽扣/g,'钮扣');
 const generic=new Set(['番茄','服饰','课程','观察','体验','对比','运营','控制','反馈','运输','设备','部署','报告','商品','生产','面料']);
 const ranked=catalog.images.map(image=>{let score=0,specific=0;for(const tag of image.tags||[]){if(normalized.includes(tag.toLowerCase())){score+=generic.has(tag)?1:4;if(!generic.has(tag))specific++;}}
  // Core subject labels are useful even when a tag uses a longer phrase.
  for(const token of ['试衣','量体','镜面','反射','补货','缝线','质检','水质','土壤','阀门','滴灌','分选','回单','签收','调度','消防','电动车','智能写作','钮扣','机械花','舵机'])if(normalized.includes(token)&&(image.title+' '+image.tags.join(' ')).includes(token)){score+=3;specific++;}
  return{image,score,specific};}).filter(x=>x.specific&&x.score>=4).sort((a,b)=>b.score-a.score);
 return ranked.length?[ranked[0].image]:[];
}
