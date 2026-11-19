// 讲解幻灯片（第四轮）：好设计项目以“节目”的方式在展示屏上逐页播放，小D 逐页口播；
// 点一下小D 或说“停”暂停，“继续”“下一页”“上一页”控制。幻灯片由本机服务按项目档案生成（api/gd?op=deck）。
import {requestFixedSpeech} from './tour-flow.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const wait = ms => new Promise(r => setTimeout(r, ms));

export class DeckPlayer {
  constructor(voice, st) {
    this.voice = voice; this.st = st;
    this.deck = null; this.index = 0; this.token = 0; this.playing = false; this.paused = false;
    this.onEnd = null;
  }

  get active() { return !!this.deck && !!this.st.screen?.isOpen && this.st.screen.state.pages[0]?.deck === this.deck.id; }

  model() { return this.voice.providerModel || 'qwen3.8-omni-flash-realtime'; }

  async load(id) {
    const r = await (await fetch('api/gd?op=deck&id=' + encodeURIComponent(id), {signal: AbortSignal.timeout(120000)})).json();
    if (!r.deck) throw Error(r.error || '幻灯片暂时生成不了');
    // 提前合成整套口播，翻页时不卡顿
    try { const v = this.voice.config().voice; for (const s of r.deck.slides) requestFixedSpeech(s.narration, v, this.model(), {background: true}); } catch {}
    return r.deck;
  }

  render() {
    const d = this.deck, s = d.slides[this.index], root = el('div', 'gd-deck');
    root.dataset.page = this.index;
    if (this.index === 0 && d.cover) { const bg = el('div', 'gd-deck-cover'); bg.style.backgroundImage = `url("${d.cover}")`; root.append(bg); }
    else if (s.image || d.cover) {
      root.classList.add('has-side');
      const side = el('figure', 'gd-deck-side' + (s.caption ? ' is-figure' : ''));
      const img = el('div', 'gd-deck-img'); img.style.backgroundImage = `url("${s.image || d.cover}")`; side.append(img);
      if (s.caption) side.append(el('figcaption', null, s.caption));
      root.append(side);
    }
    const body = el('div', 'gd-deck-body');
    if (this.index === 0) body.append(el('div', 'gd-deck-kicker', `${d.year} 中国好设计${d.award}`));
    body.append(el('h2', 'gd-deck-title', this.index === 0 ? d.name : s.title));
    const ul = el('ul', 'gd-deck-points');
    const firstPoints = () => { const unitKey = String(d.unit || '').slice(0, 4); return [d.unit, ...s.points.filter(p => !p.includes(d.name.slice(0, 6)) && !(unitKey && p.includes(unitKey)) && !/获.*奖/.test(p))].slice(0, 2); };
    (this.index === 0 ? firstPoints() : s.points).filter(Boolean).slice(0, 3).forEach((p, i) => { const li = el('li', null, p); li.style.setProperty('--i', i); ul.append(li); });
    body.append(ul);
    const foot = el('div', 'gd-deck-foot');
    const dots = el('div', 'gd-deck-dots');
    d.slides.forEach((_, i) => dots.append(el('i', i === this.index ? 'on' : '')));
    foot.append(dots, el('span', 'gd-deck-hint', this.paused ? '已暂停 · 说“继续”或按 →' : `${this.index + 1} / ${d.slides.length}`));
    root.append(body, el('div', 'gd-deck-progress'), foot);
    this.st.screen.showNode(root, {label: '好设计馆 · 节目', title: d.name, deck: d.id});
    this.progress = root.querySelector('.gd-deck-progress');
    this.onState?.();
  }

  // 逐字朗读本页口播，等它说完；被打断返回 false
  async speak(text, token) {
    const v = this.voice;
    v.interrupt?.({keepChoices: true});
    if (token !== this.token) return false;
    v.visualMode = 'off'; v.guidanceSpokenForTurn = true; v.replyText = text;
    v.log?.('小D', text);
    v.queueReplySentence(text); v.finishReplySpeech();
    const limit = Date.now() + Math.max(8000, text.length * 330);
    const started = Date.now();
    if (this.progress) { this.progress.style.transition = 'none'; this.progress.style.width = '0'; }
    await wait(300);
    if (this.progress) { this.progress.style.transition = `width ${Math.max(4, text.length * .24)}s linear`; this.progress.style.width = '100%'; }
    while (token === this.token && v.replySpeechActive && Date.now() < limit) await wait(150);
    if (Date.now() - started < 1200) await wait(1200);
    return token === this.token;
  }

  // 导览里用：播完返回 true，被打断或换节目返回 false
  playToEnd(id) {
    return new Promise(resolve => {
      this.play(id, {onEnd: () => resolve(true)}).catch(() => resolve(false));
      this.onCancel = () => resolve(false);
    });
  }

  cancelWaiter() { const c = this.onCancel; this.onCancel = null; c?.(); }

  async play(id, {onEnd} = {}) {
    this.cancelWaiter();
    const token = ++this.token;
    this.onEnd = onEnd; this.paused = false;
    this.voice.status?.('正在准备节目…');
    const deck = await this.load(id);
    if (token !== this.token) return;
    this.deck = deck; this.lastDeck = deck; this.index = 0;
    const st = this.st;
    if (st.focus.current?.id !== deck.id) { st.focus.previous = st.focus.current; st.focus.current = {id: deck.id, name: deck.name, page: deck.page}; }
    this.run(token);
  }

  async run(token) {
    this.playing = true;
    try {
      while (token === this.token && this.index < this.deck.slides.length) {
        this.render();
        this.voice.status?.(`节目 · ${this.deck.name} · ${this.index + 1}/${this.deck.slides.length}`);
        if (!(await this.speak(this.deck.slides[this.index].narration, token))) return;
        await wait(700);
        if (token !== this.token) return;
        this.index++;
      }
      if (token === this.token) { this.index = this.deck.slides.length - 1; this.playing = false; this.onCancel = null; this.onEnd?.(this.deck); }
    } finally { if (token === this.token) this.playing = false; }
  }

  pause() {
    if (!this.deck || this.paused) return false;
    this.token++; this.paused = true; this.playing = false; this.cancelWaiter();
    this.voice.interrupt?.({keepChoices: true});
    if (this.active) this.render();
    this.voice.status?.('节目已暂停 · 说“继续”或按 →');
    this.onState?.();
    return true;
  }

  resume() { if (!this.deck) return false; this.paused = false; this.run(++this.token); return true; }
  replay() { if (!this.deck) return false; this.paused = false; this.run(++this.token); return true; }
  restartDeck() { if (!this.deck) return false; this.index = 0; this.paused = false; this.run(++this.token); return true; }
  goto(i) { if (!this.deck || !(i >= 0)) return false; this.index = Math.min(this.deck.slides.length - 1, i); this.paused = false; this.run(++this.token); return true; }
  next() { if (!this.deck) return false; this.index = Math.min(this.deck.slides.length - 1, this.index + 1); this.paused = false; this.run(++this.token); return true; }
  prev() { if (!this.deck) return false; this.index = Math.max(0, this.index - 1); this.paused = false; this.run(++this.token); return true; }
  stop() { const had = !!this.deck; this.token++; this.playing = false; this.paused = false; this.deck = null; this.cancelWaiter(); if (had) this.onState?.(); }
}
