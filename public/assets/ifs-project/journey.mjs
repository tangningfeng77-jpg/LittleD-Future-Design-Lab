export const stages = {
  opening: { gesture:'down', film:'v1', next:'intakeExplore', scene:'p2', chapter:'01 / 潜入水源', instruction:'向下轻压，跟随水流潜入', detail:'单手张开 · 先停稳，再向下移动' },
  intakeExplore: { gesture:'expand', film:'v2', next:'intakeReturn', scene:'p2', chapter:'02 / 看见微观', instruction:'双手展开，看看水里有什么', detail:'双手张开靠近 · 停稳后向两侧展开' },
  intakeReturn: { gesture:'push', film:'v3', next:'filtration', scene:'p4', chapter:'04 / 进入过滤', instruction:'向前推送，让水进入过滤罐', detail:'单手张开停稳 · 向摄像头轻推' },
  filtration: { gesture:'push', film:'v4', next:'ifsDevice', scene:'p6', chapter:'05 / 前往 iFS', instruction:'向前推送，前往 iFS 处理组件', detail:'收回手停稳 · 再向摄像头轻推' },
  ifsDevice: { gesture:'expand', film:'v5', next:'greenFruit', scene:'p12', chapter:'06 / 深入组件', instruction:'双手展开，深入组件内部', detail:'双手张开靠近 · 停稳后向两侧展开' },
  greenFruit: { gesture:'lift', film:'v9', next:'ripeFruit', scene:'p14', chapter:'10 / 等待成熟', instruction:'向上托起，见证番茄成熟', detail:'手掌舒展朝上 · 从低处缓缓抬起' },
  ripeFruit: { gesture:'fist', film:'v10', next:'complete', scene:'harvest', chapter:'11 / 收获成果', instruction:'握拳，收获番茄', detail:'单手握拳 · 短暂停稳即可采摘' }
};
export const stageInstructions = Object.fromEntries(Object.entries(stages).map(([key,value])=>[key,value.instruction]));
export class GestureJourney {
  constructor(onChange = ()=>{}, onPlay = ()=>{}) {
    this.state='opening'; this.active=null; this.onChange=onChange; this.onPlay=onPlay;
  }
  trigger(gesture) {
    const transition=stages[this.state];
    if (this.active || !transition || transition.gesture!==gesture) return false;
    this.active={...transition,from:this.state}; this.state='playing';
    this.onChange(this); this.onPlay(this.active); return true;
  }
  finish(film) {
    if (!this.active || this.active.film!==film) return;
    this.state=this.active.next; this.active=null; this.onChange(this);
  }
  fail(film) {
    if (!this.active || this.active.film!==film) return;
    this.state=this.active.from; this.active=null; this.onChange(this);
  }
}

