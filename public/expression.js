// Speech-driven cues use the assistant's own words, scheduled on the playback clock.
export function inferExpression(text,excluded=new Set()){
 const rules=[
  ['sympathy',/(很抱歉|对不起|别难过|很遗憾|理解你的感受|陪着你)/,2,'EmoDontKnow'],
  ['uncertain',/(我不确定|我还不知道|我不知道|暂时无法确认|资料不足|没有找到.*资料)/,3,'EmoDontKnow'],
  ['greeting',/(你好[呀啊]?|嗨[！!，,]|很高兴认识|欢迎你|再见|下次见)/,1,'EmoHello'],
  ['joy',/(太棒了|太好了|真棒|恭喜|好消息|成功了|做得很好|你肯定能行|一定可以|加油|做得到|非常开心|哈哈)/,1,'EmoThumbsUp'],
  ['warm',/(谢谢你|感谢你|喜欢你|喜欢和你|很高兴|一起加油)/,9,'EmoThumbsUp'],
  ['wonder',/(真神奇|太神奇|好神奇|没想到|令人惊讶|哇[！!，,])/,4,'EmoTalk1'],
  ['explain',/(我建议|可以先|第一步|首先|接下来|举个例子|我们可以|简单来说)/,0,'EmoTalk1']
 ];
 for(const [kind,pattern,emotion,animation] of rules)if(!excluded.has(kind)&&pattern.test(text))return {kind,emotion,animation};
 return null;
}
export class SpeechDirector{
 constructor({perform,emote}){this.perform=perform;this.emote=emote;this.begin();}
 begin(){this.queue=[];this.seen=new Set();this.offset=0;this.lastAt=-Infinity;this.count=0;this.active=true;this.priority=-1;}
 text(full,at){if(!this.active)return;const fresh=full.slice(this.offset);if(/^[哇啊嗯]/.test(fresh)&&fresh.length<8&&!/(太棒了|太好了|恭喜)/.test(fresh))return;const cue=inferExpression(fresh,this.seen);if(cue&&!this.seen.has(cue.kind)){this.seen.add(cue.kind);this.offset=full.length;this.cue(cue,at);}else if(fresh.length>180)this.offset=Math.max(this.offset,full.length-80);}
 cue(cue,at=0,explicit=false){if(!this.active)return;const priority={sympathy:3,uncertain:3,joy:3,greeting:2,warm:2,wonder:1,explain:0}[cue.kind]??2;if(!explicit&&(this.count>=3||at-this.lastAt<2.8)){if(priority>this.priority&&Number.isInteger(cue.emotion)){this.queue.push({emotion:cue.emotion,at});this.queue.sort((a,b)=>a.at-b.at);this.priority=priority;}return;}this.priority=priority;if(explicit)this.queue=this.queue.filter(c=>c.at<at);this.queue.push({...cue,at});this.queue.sort((a,b)=>a.at-b.at);this.lastAt=at;this.count++;}
 tick(time){if(!this.active)return;while(this.queue.length&&this.queue[0].at<=time){const cue=this.queue.shift();if(Number.isInteger(cue.emotion))this.emote(cue.emotion);if(cue.animation)this.perform(cue.animation);}}
 end(){this.queue=[];this.active=false;}
 cancel(){this.end();this.emote(0);}
}
