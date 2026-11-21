// 主持人（第六轮）：小D 把整场参观串起来——开场 → 未来设计实验室 → 好设计馆 → 自由点播 → 收尾。
// 每一段讲完都在屏幕左侧给出“你可以问”的提示（编号问题 + 下一步），来宾可以说“问第几个”、直接问自己的问题，
// 或说“下一部分”；没人说话时，小D 等一会儿再主动往下讲。好设计馆段落边讲边在网页上高亮对应内容。
// 流程与提示问题都在 assets/tour/gooddesign-tour.json，现场可改。

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').normalize('NFKC').replace(/[\s，。！？、,.!?～~]/g, '');
const NUM = {一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 1: 1, 2: 2, 3: 3, 4: 4};
const NEXT = /^(下一部分|下一环节|下一个环节|往下走|接着往下|继续往下|继续下一部分|进入下一部分|我们继续|继续吧|好的继续|好继续|没问题了?|没有问题了?|没有了|就这些|可以了)$/;

export const deckFacts = d => !d ? '' : `${d.name}（${d.year || ''}${d.award || ''}，${d.unit || ''}）：` + d.slides.map(s => `${s.title}：${(s.points || []).join('；')}。${s.narration}`).join(' ');

export class Host {
  constructor(tour) {
    this.tour = tour;
    this.conf = {};
    this.cues = [];            // 当前编号问题
    this.actions = [];         // 当前可说的下一步
    this.asked = new Set();
    this.lastActivity = Date.now();
    this.waiting = null;
    this.act = -1;
    this.mount();
    this.loop();
  }

  setScript(script) { this.conf = script?.host || {}; this.script = script; this.renderActs(); }

  // 左上角：一个小小的进度标签（点开看全部环节）+ 2D/3D 切换；提示卡只在轮到来宾说话时展开，其余时间收成一个小标签
  mount() {
    const vp = document.querySelector('.viewport');
    this.topEl = el('div', 'gd-top');
    this.actsEl = el('ol', 'gd-acts'); this.actsEl.setAttribute('aria-label', '参观流程'); this.actsEl.title = '点开看全部环节';
    this.actsEl.onclick = () => this.actsEl.classList.toggle('open');
    this.topEl.append(this.actsEl);
    this.cueEl = el('aside', 'gd-cue'); this.cueEl.hidden = true; this.cueEl.setAttribute('aria-live', 'polite');
    this.cueEl.addEventListener('click', e => { if (e.target.closest('.gd-cue-head')) { this.manualCue = {open: this.cueEl.classList.contains('min'), until: Date.now() + 20000}; this.fold(); } });
    vp?.append(this.topEl, this.cueEl);
    setInterval(() => this.fold(), 400);
  }

  // 小D 在说、在播节目、展示屏开着时收起提示卡；来宾点开的，20 秒内不自动收
  fold() {
    const t = this.tour, v = t.voice, root = this.cueEl;
    if (!root || root.hidden) return;
    // 讲稿讲完、等来宾提问时展开提示卡（屏幕虽然开着，问题要看得见）
    const asking = !!(t.afterDeck && t.deck?.deck === t.afterDeck.deck) && !t.isTalking?.();
    const busy = !asking && (t.isTalking?.() || t.running || !!(t.deck?.deck && t.deck.active && !t.deck.paused) || !!v?.gd?.screen?.isOpen || t.guide?.isShowing);
    const m = this.manualCue && this.manualCue.until > Date.now() ? this.manualCue : null;
    const min = m ? !m.open : busy;
    if (min !== root.classList.contains('min')) root.classList.toggle('min', min);
  }

  renderActs() {
    const acts = this.conf.acts || ['开场', '未来设计实验室', '好设计馆', '自由点播', '收尾'];
    this.actsEl.replaceChildren(...acts.map((a, i) => { const li = el('li', i === this.act ? 'on' : i < this.act ? 'done' : '', a); li.dataset.n = `${i + 1}/${acts.length}`; return li; }));
    this.actsEl.hidden = this.act < 0;
  }

  setAct(i) { if (i !== this.act) { this.act = i; this.renderActs(); } }

  touch() { this.lastActivity = Date.now(); }

  // ---------- 提示卡 ----------
  show(title, questions = [], actions = []) {
    this.cues = questions.filter(Boolean).slice(0, 3);
    this.actions = actions.filter(Boolean).slice(0, 3);
    const key = JSON.stringify([title, this.cues, this.actions]);
    if (key === this.lastCue) return;
    this.lastCue = key;
    if (!this.cues.length && !this.actions.length) { this.cueEl.hidden = true; return; }
    const root = this.cueEl; root.replaceChildren();
    const head = el('button', 'gd-cue-head'); head.type = 'button';
    head.append(el('h3', null, title), el('span', 'gd-cue-n', this.cues.length ? `${this.cues.length} 个问题` : '下一步'));
    root.append(head);
    if (this.cues.length) {
      const ul = el('ol', 'gd-cue-q');
      this.cues.forEach((q, i) => { const b = el('button', null); b.type = 'button'; b.append(el('b', null, String(i + 1)), el('span', null, q)); b.onclick = () => this.ask(i); ul.append(el('li')); ul.lastChild.append(b); });
      root.append(ul);
    }
    if (this.actions.length) {
      const row = el('div', 'gd-cue-a');
      for (const a of this.actions) { const b = el('button', null, a.label); b.type = 'button'; b.onclick = () => { this.touch(); a.run(); }; row.append(b); }
      root.append(row);
    }
    root.append(el('p', 'gd-cue-tip', this.cues.length ? '说“问第一个”，或直接问您想问的' : '直接说出来就可以'));
    root.hidden = false;
    this.tour.controls?.publish();
  }

  ask(i) {
    const q = this.cues[i];
    if (!q) return false;
    this.asked.add(q); this.touch();
    this.tour.voice.respond(q);
    return true;
  }

  // 主持口令：问第几个、下一部分、去看好设计馆、换一个场景、结束参观
  handle(c) {
    const m = c.match(/^(我想问|问一下|问|我问)?第?([一二两三四1-4])(个|条)?(问题)?$/);
    if (m && this.cues.length && (m[1] || m[4] || !this.tour.guide.isShowing)) { return this.ask(NUM[m[2]] - 1); }
    if (this.cues.some(q => clean(q) === c)) this.asked.add(this.cues.find(q => clean(q) === c));
    if ((NEXT.test(c) || /^(继续|接着讲|往下讲|继续讲)$/.test(c)) && this.waiting) { this.touch(); this.waiting.resolve(true); return true; }
    if (/^(跳到下一部分|跳过|跳过这一段|下一部分)$/.test(c) && this.tour.running) { this.touch(); return this.skip(); }
    const action = this.actions.find(a => (a.say || []).some(s => clean(s) === c) || clean(a.label) === c);
    if (action) { this.touch(); action.run(); return true; }
    if (/^(结束参观|今天就到这里|参观结束|就到这里吧?|谢谢小d|谢谢你小d|再见)$/i.test(c)) { this.closing(); return true; }
    return false;
  }

  // ---------- 随时根据场面更新提示 ----------
  loop() {
    setInterval(() => {
      const t = this.tour, v = t.voice;
      if (!v || this.waiting?.custom) return;
      if (this.waiting) { this.setAct(2); return; }          // 段落之间的提示由 runRoute 设置
      if (t.running) { this.setAct(2); if (!(t.deck.deck && t.deck.active)) this.show(`小D 正在讲：${this.segTitle || '好设计馆'}`, [], [{label: '停一下', say: [], run: () => t.interruptAll()}, {label: '跳到下一部分', say: ['跳到下一部分', '跳过'], run: () => this.skip()}]); return; }
      if (t.isTalking()) return;                             // 说话时不换提示，避免干扰
      const d = t.deck, lab = v.sceneCatalog;
      if (this.closingUntil > Date.now()) return;
      if (t.attracting || (!v.awakened && !d.deck && !t.guide.isShowing && !v.tour?.started && !v.gd?.screen?.isOpen && !v.selectedScene)) {
        this.setAct(-1);
        this.show('欢迎参观', [], [{label: '说“你好，小D”开始参观', say: [], run: () => v.respond('你好，小D')}, {label: '看全部展项', say: ['全部展项', '还有什么', '节目单'], run: () => t.showGuide()}]);
        return;
      }
      if (d.deck && d.active && t.afterDeck?.deck === d.deck) {
        this.setAct(3);
        const nx = t.afterDeck.next;
        this.show('讲完了 · 接着问', (d.deck.questions || []).filter(q => !this.asked.has(q)), [
          ...(nx ? [{label: `下一个：${nx.title}`, say: ['下一个', '看下一个'], run: () => t.startProgramme(nx)}] : []),
          {label: '看完整档案', say: ['看完整档案', '看原网页'], run: () => t.command('看原网页', '看原网页')},
          {label: '回到全部展项', say: ['回到全部展项', '退出', '回到节目单'], run: () => t.showGuide({say: false})}]);
        return;
      }
      if (d.deck && d.active) {
        this.setAct(t.running ? 2 : 3);
        const qs = (d.deck.questions || []).filter(q => !this.asked.has(q));
        this.show(d.paused ? '已暂停 · 你可以问' : '关于这个节目，你可以问', qs, [
          {label: d.paused ? '继续讲' : '下一页', say: ['继续', '下一页'], run: () => d.paused ? d.resume() : d.next()},
          {label: '看完整档案', say: ['看完整档案', '看原网页'], run: () => t.command('看原网页', '看原网页')},
          {label: '回到全部展项', say: ['回到全部展项', '退出', '回到节目单'], run: () => t.showGuide({say: false})}]);
        return;
      }
      if (t.guide.isShowing) {
        this.setAct(t.running ? 2 : 3);
        this.show('选一个展项', [], [
          {label: '说“第几个”或名字；别的问题也可以直接问', say: [], run: () => {}},
          {label: '换频道：实验室 · 政府 · 企业 · 方法', say: [], run: () => t.showGuide({say: false})},
          {label: '结束参观', say: ['结束参观'], run: () => this.closing()}]);
        return;
      }
      const scene = v.selectedScene?.title;
      if (scene && lab?.questions) {
        this.setAct(1);
        const pool = lab.questions.filter(q => q.scene === scene && !this.asked.has(q.question));
        const nx = t.afterScene?.scene === v.selectedScene ? t.afterScene.next : null;
        this.show(`关于${scene}，你可以问`, pool.slice(0, 3).map(q => q.question), [
          ...(nx ? [{label: `下一个：${nx.title}`, say: ['下一个', '看下一个', '下一个场景'], run: () => t.startProgramme(nx)}]
            : [{label: '换一个场景', say: ['换一个场景', '换个场景'], run: () => v.sceneChoices?.show()}]),
          ...(nx ? [{label: '看全部展项', say: ['全部展项', '看全部展项', '还有什么', '节目单'], run: () => t.showGuide({channel: t.afterScene?.it?.channel})}] : []),
          {label: '去看好设计馆', say: ['去看好设计馆', '看看好设计馆', '好设计馆'], run: () => this.bridge()}]);
        return;
      }
      if (v.tour?.started || v.sceneChoices?.visible) {
        this.setAct(v.tour?.state === 'video' || v.tour?.state === 'speaking' ? 0 : 1);
        const pool = (lab?.questions || []).filter(q => q.scene === '实验室概况' && !this.asked.has(q.question));
        this.show('你可以问', (this.script?.labCues?.welcome || []).concat(pool.map(q => q.question)).filter(q => !this.asked.has(q)).slice(0, 3), [
          {label: '说一个场景名，比如智慧农业', say: [], run: () => v.sceneChoices?.show()},
          {label: '去看好设计馆', say: ['去看好设计馆', '看看好设计馆'], run: () => this.bridge()}]);
        return;
      }
      this.setAct(3);
      // 第九轮：刚回答过的项目，直接给“播放节目”的入口和顺着问的问题
      const found = (v.gd?.list || []).filter(p => p?.id && /^\d{4}-/.test(p.id)).slice(0, 2);
      const cur = v.gd?.focus?.current, prev = v.gd?.focus?.previous;
      if (found.length) {
        const name = p => String(p.name || '').split('/')[0].slice(0, 14);
        const qs = [cur?.name ? `${name(cur)}是怎么做的？` : `${name(found[0])}解决了什么问题？`, '还有类似的项目吗？', prev && cur ? '这两个有什么关系？' : '它用到了哪些设计方法？'];
        this.show('顺着这个话题，你可以', qs.filter(q => !this.asked.has(q)), [
          ...found.map(p => ({label: `播放「${name(p)}」`, say: [`播放${name(p)}`], run: () => t.playDeck(p.id)})),
          {label: '看全部展项', say: ['全部展项', '还有什么', '节目单'], run: () => t.showGuide()}]);
        return;
      }
      this.show('你可以问', ['好设计馆里有没有农业方面的项目？', '这两个有什么关系？'].filter(q => q !== '这两个有什么关系？' || (v.gd?.focus?.previous)), [
        {label: '看全部展项', say: ['全部展项', '还有什么', '节目单'], run: () => t.showGuide()},
        {label: '结束参观', say: ['结束参观'], run: () => this.closing()}]);
    }, 1000);
  }

  // 实验室 → 好设计馆 的串场
  async bridge() {
    const t = this.tour, v = t.voice;
    v.sceneChoices?.hide?.();
    v.selectedScene = null;
    const line = this.script?.bridge?.say;
    t.cancel();
    const token = ++t.token;
    if (line && !(await t.speak(line, token))) return;
    t.run();
  }

  // ---------- 好设计馆环节：逐段讲解，每段后停下来答疑 ----------
  async runRoute(token) {
    const t = this.tour, route = t.routeConf, screen = t.voice.gd.screen;
    const segs = [this.script.intro, ...(route.segments || [])].filter(Boolean);
    this.setAct(2);
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      this.segTitle = `${i + 1}/${segs.length} ${seg.title}`;
      this.skipSeg = false;
      if (token !== t.token) return false;
      t.voice.status?.(`好设计馆 · ${i + 1}/${segs.length} · ${seg.title}`);
      if (seg.deck) {
        if (seg.intro && !(await t.speak(seg.intro, token))) return false;
        const it = t.guide.items.find(x => x.deck === seg.deck);
        if (it && t.hall) await Promise.race([t.hall.walkToItem(it), wait(9000)]);
        const played = await t.deck.playToEnd(seg.deck);
        if ((!played && !this.skipSeg) || token !== t.token) return false;
      } else if (seg.page) {
        t.hall?.walkHome();
        await t.open(seg.page);
        await wait(1200);                                   // 等网页加载
        for (const beat of seg.beats || []) {
          if (token !== t.token) return false;
          if (this.skipSeg) break;
          if (beat.focus) screen.focusText(beat.focus);
          if (!(await t.speak(beat.say, token))) return false;
          if (this.skipSeg) break;
          await wait(500);
        }
      }
      if (token !== t.token) return false;
      if (this.skipSeg) { this.skipSeg = false; screen.clearFocus(); continue; }   // 主动跳过：不停下答疑
      const last = i === segs.length - 1;
      const ok = await this.pause(seg, last ? (route.closing ? '看看为您推荐的节目' : '') : seg.next, token);
      screen.clearFocus();
      if (!ok) return false;
    }
    return true;
  }

  // 段落之间：显示提示，等来宾提问；说“下一部分”或一段时间没人说话就继续
  pause(seg, nextLabel, token) {
    const t = this.tour;
    return new Promise(resolve => {
      const done = v => { clearInterval(timer); this.waiting = null; this.facts = null; resolve(v); };
      this.waiting = {resolve: done};
      this.touch();
      this.facts = {title: seg.title, text: seg.deck ? deckFacts(t.deck.lastDeck) : (seg.beats || []).map(b => b.say).join('')};
      const show = () => this.show(`关于“${seg.title}”，你可以问`, (seg.ask || []).filter(q => !this.asked.has(q)), nextLabel ? [{label: `下一部分：${nextLabel}`, say: ['下一部分'], run: () => done(true)}] : []);
      this.lastCue = ''; show();
      let prompted = false;
      const timer = setInterval(async () => {
        if (token !== t.token) return done(false);
        if (t.isTalking()) { this.touch(); return; }
        show();
        const idle = Date.now() - this.lastActivity, waitMs = (this.conf.waitSeconds || 14) * 1000;
        if (idle > waitMs && !prompted) {
          prompted = true;
          if (this.conf.continueLine) await t.speak(this.conf.continueLine, token);
          done(token === t.token);
        }
      }, 600);
    });
  }

  // 讲解中跳到下一部分
  skip() {
    const t = this.tour;
    if (this.waiting) { this.waiting.resolve(true); return true; }
    if (!t.running) return false;
    this.skipSeg = true;
    if (t.deck.deck) t.deck.stop();
    t.voice.interrupt?.({keepChoices: true});
    return true;
  }

  // 收尾：总结致谢，回到待机
  async closing() {
    const t = this.tour, v = t.voice;
    t.cancel(); t.deck.stop();
    this.setAct(4);
    const c = this.script?.closing || {};
    this.closingUntil = Date.now() + 25000;
    this.show('参观即将结束', c.ask || [], [{label: '再看一个', say: ['再看一个', '全部展项', '节目单'], run: () => { this.closingUntil = 0; t.showGuide(); }}]);
    t.hall?.walkHome();
    v.gd?.screen?.close();
    if (c.say) await t.speak(c.say, ++t.token);
    setTimeout(() => { if (this.closingUntil && Date.now() >= this.closingUntil - 100 && !t.isTalking()) { this.closingUntil = 0; v.returnToWelcome?.(); } }, 25000);
  }
}
