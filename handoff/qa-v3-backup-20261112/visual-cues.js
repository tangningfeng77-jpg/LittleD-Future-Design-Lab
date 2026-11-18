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
export function visualLibraryPrompt(catalog){if(!catalog)return'';return '\n可用的全部场景配图（供你理解回答与图像之间的语义关系，不要求用户问题原文命中标签）：'+JSON.stringify(catalog.images.map(i=>({id:i.id,scene:i.scene,title:i.title,tags:i.tags,meaning:i.description,kind:i.kind})))+'\n每次回答都要根据你实际正在解释的内容主动挑选配图，不限于场景总览和预设问法。图必须直接解释该段内容。找到合适图时，在对应句子前输出隐藏标记[[图:图片ID]]，比较两图时用[[图:左图ID|右图ID]]。例如讲真实试衣与量体用[[图:FAS-IMG-003]]，讲镜面反射用[[图:EDU-IMG-005]]。标记交给程序显示，不要口头解释或重复图片ID。图片为生成的场景示意，不是项目实拍。通常一轮一至两图；配图要跟随后续实际内容，不要只为总览和回答的第一句配图。例如先讲客流热区可选RET-IMG-003，转到门店陈列补货时可在该句前换RET-IMG-006。短回答只需一张最有帮助的图；话题明显改变时才换图。没有直接相关图片时不加标记。不要为了配图反复检索、调用工具或重复讲解。配图和正文在同一轮输出，直接使用上述隐藏标记；不要为了选图发起工具调用。';}
