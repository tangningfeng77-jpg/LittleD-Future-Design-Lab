const clean=s=>String(s||'').replace(/[\s，。！？、,.!?]/g,'');
export class DialogueContext{
 constructor(){this.scene='';this.nextStep='';this.recent=[];}
 observe(text,scene){if(scene)this.scene=scene;if(/还有.*(了解|知道|想问)|别的.*(了解|知道|问题)/.test(text)){this.nextStep='接下来可以换一个场景看看。';return;}const hints=String(text).match(/(?:想不想让我带你了解一下|想不想让我|接下来|您想|你想|我们可以继续|可以继续|可以从|值得先看|更值得注意|不妨)[^。！？]*[。！？]?/g);if(hints?.length)this.nextStep=hints.at(-1);}
 remember(role,text,scene){if(!text)return;if(scene)this.scene=scene;this.recent.push({role,text:String(text).slice(-700)});this.recent=this.recent.slice(-8);if(role==='assistant')this.observe(text,scene);}
 resolve(text){const short=clean(text);if(!/^(可以|可以啊|可以呀|好|好的|好啊|好呀|行|行啊|嗯|嗯好|对|是的|没问题|继续|继续吧|说吧|讲吧|接着说|接着讲|往下说|往下讲|你继续|那就继续)$/.test(short))return{text,continued:false};
  if(!this.nextStep){const last=this.recent.filter(r=>r.role==='assistant').at(-1);if(last)return{text:`访客同意继续。请承接上一轮${this.scene||'当前主题'}的讲解，围绕刚才的知识关联自然往下说明，不重新欢迎或重复总览。上一轮回答：${last.text}`,continued:true};return{text,continued:false};}if(/深入.*项目|项目探索/.test(this.nextStep))return{text,continued:true,action:'project'};
  if(/回到六个|换一个场景|换个场景|切换场景/.test(this.nextStep))return{text,continued:true,action:'menu'};
  const topic=this.nextStep.replace(/^想不想让我(?:带你)?(?:了解一下|了解|介绍一下)?/,'').replace(/^(接下来)?(您想|你想|我们)?(可以)?(先)?(看看|看|了解|听听|讲解|讲)?/,'').replace(/[。！？]$/,'');
  return{text:`请直接回答这个具体问题：${topic}。访客刚才说可以，是接受你对这个问题的讲解邀请。逐一解释问题中提到的每个环节及其联系，不能只讲其中一半。不要说好的、咱们接着聊、我们先看或重复领域总览。`,continued:true,topic};
 }
 context(){return JSON.stringify({phase:this.scene||this.recent.length?'continuous_qa':'arrival',scene:this.scene,nextStep:this.nextStep,recent:this.recent});}
}
