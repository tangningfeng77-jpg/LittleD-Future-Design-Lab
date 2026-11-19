// 好设计导览、节目与控制的总调度。
// 第三阶段：导览里加一站“好设计”，按来宾路线逐段讲解。
// 第四轮：点按打断；节目（幻灯片）；节目单；待机显示节目单。
// 第五轮：节目单分频道（实验室 / 偏政府领导 / 偏企业 / 设计方法），路线即频道；三维展厅里小D 走到展板前开讲；
//        屏幕控制条、帮助卡、讲解员手机遥控；更多口令（从头讲、重讲这一页、跳到第几页、换频道、帮助）。
import {gdHandle, itemFacts} from './gooddesign.js';
import {affirm, negative} from './guide-flow.js';
import {SCENE_CHOICES} from './scene-choices.js';
import {DeckPlayer} from './gd-deck.js';
import {ProgrammeGuide, parseNumber} from './gd-guide.js';
import {Controls} from './gd-controls.js';

const clean = s => String(s || '').normalize('NFKC').replace(/[\s，。！？、,.!?～~]/g, '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROUTE_KEY = 'littled.gdRoute';
const ASK_STOP = /^(请|那)?(你)?(带我|给我|带我们|给我们)?(看看|看一看|介绍|介绍一下|介绍下|参观|参观一下|了解|了解一下|了解下|讲讲|讲一讲|讲下|说说|说下)(一下)?好设计馆?(吧|呢|好吗)?$|^好设计馆?(是什么|是干什么的|介绍一下)(呀|呢)?$/;
const ASK_GUIDE = /^(节目单|看看节目单|打开节目单|节目表|有哪些节目|有什么节目|还有哪些(节目|项目|内容)|还有什么(可以)?(看|讲)的?|都有什么(节目|项目|内容)?|看看有什么|有什么可以看的?|菜单|目录|频道)(呀|呢|吗)?$/;
const ASK_HELP = /^(帮助|怎么用|怎么玩|怎么操作|你能做什么|你会什么|我可以说什么|我能说什么|可以说什么|有哪些功能|有什么功能|使用说明|说明书)(呀|呢|吗)?$/;
const LINES = {
  guide: '这是节目单，分实验室、政府、企业和设计方法几个频道。想看哪个，说第几个或者名字就可以。',
  after: '这个项目就讲到这里。屏幕上是节目单，想接着看哪个，说第几个就可以。',
  help: '屏幕上是可以对我说的话。点一下我就会停下，再点一下接着讲。'
};

export class GdTour {
  constructor(voice) {
    this.voice = voice;
    this.script = null;
    this.running = false;
    this.offered = false;
    this.token = 0;
    this.greetTimer = null;
    this.attracting = false;
    this.guideShownAt = 0;
    this.route = this.initialRoute();
    const st = voice.gd;
    this.deck = new DeckPlayer(voice, st);
    this.deck.onState = () => this.controls?.sync();
    this.guide = new ProgrammeGuide(st);
    this.guide.onPick = it => { this.voice.log?.('你', `（点选）${it.title}`); this.startProgramme(it); };
    this.guide.onChange = () => this.controls?.sync();
    st.deck = this.deck;
    st.onKey = e => this.onKey(e);
    this.bindTap();
  }

  async load() {
    try { this.script = await (await fetch('./assets/tour/gooddesign-tour.json', {cache: 'no-store'})).json(); }
    catch { this.script = null; }
    if (this.script && !this.script.routes?.[this.route]) this.route = this.script.defaultRoute || Object.keys(this.script.routes || {})[0];
    this.mountRoutePicker();
    await this.guide.load();
    this.guide.channel = this.guide.channelForRoute(this.route) || this.guide.channel;
    this.controls = new Controls(this);
    this.initHall();
    this.warmLines();
    return !!this.script;
  }

  // 三维展厅：等机器人加载完成后搭建；网址加 ?space=photo 保留照片背景
  initHall() {
    if (new URLSearchParams(location.search).get('space') === 'photo') return;
    const tryBuild = async (n = 0) => {
      const studio = window.robotStudio;
      if (!studio?.scene || !studio.robot) { if (n < 120) setTimeout(() => tryBuild(n + 1), 500); return; }
      try {
        const {Hall} = await import('./gd-hall.js');
        this.hall = new Hall(studio, this.guide);
        this.hall.build(); this.hall.enable();
        this.voice.update?.();
      } catch (e) { console.warn('三维展厅加载失败', e); }
    };
    tryBuild();
  }

  get routeConf() { return this.script?.routes?.[this.route] || Object.values(this.script?.routes || {})[0] || {}; }

  initialRoute() {
    const fromUrl = new URLSearchParams(location.search).get('route');
    if (fromUrl) { try { localStorage.setItem(ROUTE_KEY, fromUrl); } catch {} return fromUrl; }
    try { return localStorage.getItem(ROUTE_KEY) || ''; } catch { return ''; }
  }

  setRoute(route) {
    if (!this.script?.routes?.[route]) return false;
    this.route = route; try { localStorage.setItem(ROUTE_KEY, route); } catch {}
    const sel = document.querySelector('.gd-route-select'); if (sel) sel.value = route;
    this.guide.channel = this.guide.channelForRoute(route) || this.guide.channel;
    this.warmLines();
    return true;
  }

  // 侧栏里给现场人员选路线（展厅模式下侧栏默认收起）
  mountRoutePicker() {
    const host = document.querySelector('.right');
    if (!host || !this.script) return;
    const box = document.createElement('details');
    box.innerHTML = '<summary>好设计导览路线</summary><label>来宾类型<select class="gd-route-select"></select></label><p>也可以在网址后加 ?route=government 或 ?route=enterprise。讲解员手机遥控：打开 remote.html，输入屏幕右下角的遥控码。</p>';
    const select = box.querySelector('select');
    for (const [id, r] of Object.entries(this.script.routes)) select.append(new Option(r.name, id, false, id === this.route));
    select.onchange = () => this.setRoute(select.value);
    host.append(box);
  }

  // 提前合成固定讲解，播放时不卡顿
  async warmLines() {
    try {
      const {requestFixedSpeech} = await import('./tour-flow.js');
      const v = this.voice.config().voice, model = this.voice.providerModel || 'qwen3.8-omni-flash-realtime';
      const r = this.routeConf, s = this.script || {};
      const lines = [s.offer, s.intro?.say, ...(r.steps || []).map(x => x.say), r.closing?.say, s.idle?.greeting, ...Object.values(LINES)].filter(Boolean);
      for (const t of lines) requestFixedSpeech(t, v, model, {background: true});
    } catch {}
  }

  offerText() {
    if (!this.script?.offer || !this.voice.gdEnabled) return '';
    this.offered = true;
    return this.script.offer;
  }

  // ---------- 打断与点选：点一下小D / 画面停下；点三维展厅里的展板开讲 ----------
  bindTap() {
    const host = document.querySelector('.viewport');
    if (!host) return;
    let down = null;
    host.addEventListener('pointerdown', e => { down = {x: e.clientX, y: e.clientY, t: performance.now()}; }, true);
    host.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
      if (moved > 8 || dt > 450) return;                          // 拖动旋转视角不算
      if (e.target.closest('.gd-screen, .gd-ctrl, button, a, input, select, textarea, .right, .scene-choice')) return;
      const panel = this.hall?.pick(e.clientX, e.clientY);
      if (panel && !this.isTalking()) { this.voice.log?.('你', `（点展板）${panel.title}`); this.ripple(e.clientX, e.clientY); this.startProgramme(panel); return; }
      this.interruptAll(e.clientX, e.clientY);
    }, true);
  }

  isTalking() {
    const v = this.voice;
    return !!(v.replySpeechActive || v.responseId || v.pendingTurn || v.tour?.busy || this.running || this.deck.playing);
  }

  interruptAll(x, y) {
    const v = this.voice;
    if (!this.isTalking()) {
      if (this.deck.paused && this.deck.active) { this.deck.resume(); return; }  // 暂停中再点一下：继续
      return;
    }
    if (v.tour?.state === 'video') { v.tour.finishVideo?.('skipped'); if (x != null) this.ripple(x, y); return; }  // 跳过视频，接着进入场景选择
    this.cancel();
    if (this.deck.playing) this.deck.pause();
    v.interrupt?.({keepChoices: true});
    v.status?.('已打断 · 可以直接提问');
    if (x != null) this.ripple(x, y);
    this.controls?.sync();
  }

  ripple(x, y) {
    const r = document.createElement('span');
    r.className = 'gd-tap-ripple'; r.style.left = x + 'px'; r.style.top = y + 'px';
    document.body.append(r); setTimeout(() => r.remove(), 700);
  }

  onKey(e) {
    const k = e.key;
    if (this.deck.deck && this.deck.active) {
      if (k === 'ArrowRight' || k === 'PageDown' || k === 'ArrowDown') { this.deck.next(); return true; }
      if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') { this.deck.prev(); return true; }
      if (k === ' ' || k === 'b' || k === 'B' || k === '.') { this.deck.paused ? this.deck.resume() : this.deck.pause(); return true; }
      if (k === 'r' || k === 'R') { this.deck.replay(); return true; }
      if (k === 'Escape' || k === 'm' || k === 'M') { this.showGuide({say: false}); return true; }
      return false;
    }
    if (this.guide.isShowing) {
      if (/^[1-9]$/.test(k)) { const it = this.guide.chan().items.find(x => x.no === +k); if (it) { this.startProgramme(it); return true; } }
      if (k === 'ArrowRight' || k === 'ArrowLeft') { const ids = this.guide.channels.map(c => c.id), i = ids.indexOf(this.guide.channel); this.guide.show({channel: ids[(i + (k === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length]}); return true; }
      if (k === 'Escape') { this.guide.hide(); return true; }
    }
    if (k === 'm' || k === 'M') { this.showGuide(); return true; }
    if (k === 'h' || k === 'H' || k === '?') { this.controls?.showHelp(); return true; }
    if ((k === 'b' || k === 'B' || k === '.' || (k === ' ' && !this.voice.gd?.screen?.isOpen)) && this.isTalking()) { this.interruptAll(); return true; }
    return false;
  }

  // ---------- 节目 ----------
  showGuide({say = true, channel, mark} = {}) {
    if (!this.guide.items.length) return false;
    this.deck.stop();
    this.guide.show({channel: channel || this.guide.channel || this.guide.channelForRoute(this.route), mark});
    this.guideShownAt = Date.now();
    if (say) this.speak(LINES.guide, ++this.token);
    this.hall?.walkHome();
    return true;
  }

  async startProgramme(it) {
    const v = this.voice;
    this.cancel(); this.stopAttract({keepScreen: true});
    this.guide.visible = false;
    this.guide.channel = it.channel || this.guide.channel;
    this.current = it;
    v.status?.(`小D 正在走向「${it.title}」…`);
    if (this.hall) await Promise.race([this.hall.walkToItem(it), wait(9000)]);
    if (it.kind === 'lab-scene') {
      const scene = SCENE_CHOICES.find(s => s.id === it.scene);
      this.deck.stop(); v.gd?.screen?.close();
      if (scene) return v.respond('我想了解' + scene.title + '。', {sceneEntry: scene});
    } else if (it.kind === 'lab-project') {
      this.deck.stop(); v.gd?.screen?.close(); return v.enterProject?.();
    } else if (it.kind === 'gd-intro') {
      if (it.route) this.setRoute(it.route);
      this.deck.stop(); return this.run();
    } else if (it.kind === 'deck') {
      return this.playDeck(it.deck, it);
    }
  }

  async playDeck(id, it) {
    try {
      await this.deck.play(id, {onEnd: () => {
        const ch = it?.channel && this.guide.chan(it.channel), next = ch ? ch.items[(ch.items.indexOf(it) + 1) % ch.items.length] : null;
        this.showGuide({say: false, channel: it?.channel, mark: next?.key});
        this.speak(LINES.after, ++this.token);
      }});
    } catch (e) { this.voice.status?.('节目暂时打不开：' + e.message); }
    this.controls?.sync();
  }

  // ---------- 讲解员手机遥控与控制条 ----------
  async remote(cmd, arg, fromRemote = false) {
    const v = this.voice, d = this.deck;
    if (fromRemote) v.log?.('遥控', {stop: '停止', toggle: '暂停/继续', next: '下一页', prev: '上一页', restart: '本页重讲', guide: '节目单', channel: '换频道', play: '播放节目', tour: '开始导览', welcome: '开场欢迎', idle: '回到待机', say: String(arg || ''), help: '帮助', close: '关闭屏幕', home: '回到中间'}[cmd] || cmd);
    this.stopAttract({keepScreen: cmd !== 'idle'});
    switch (cmd) {
      case 'stop': this.interruptAll(); break;
      case 'toggle': if (d.deck && d.active) { d.paused ? d.resume() : d.pause(); } else if (this.isTalking()) this.interruptAll(); break;
      case 'next': if (d.deck && d.active) d.next(); else if (this.guide.isShowing) this.onKey({key: 'ArrowRight'}); break;
      case 'prev': if (d.deck && d.active) d.prev(); else if (this.guide.isShowing) this.onKey({key: 'ArrowLeft'}); break;
      case 'restart': if (d.deck) d.replay(); break;
      case 'guide': this.showGuide({say: !fromRemote}); break;
      case 'channel': if (this.guide.chan(arg)?.id === arg) this.showGuide({say: false, channel: arg}); break;
      case 'play': { const it = this.guide.byKey(arg); if (it) this.startProgramme(it); break; }
      case 'tour': if (this.setRoute(arg)) { d.stop(); this.run(); } break;
      case 'welcome': d.stop(); v.gd?.screen?.close(); this.hall?.walkHome(); v.respond('你好，小D'); break;
      case 'idle': d.stop(); this.cancel(); v.interrupt?.({keepChoices: false}); this.hall?.walkHome(); v.returnToWelcome?.(); break;
      case 'say': if (typeof arg === 'string' && arg.trim()) v.respond(arg.trim()); break;
      case 'help': this.controls?.showHelp(); this.speak(LINES.help, ++this.token); break;
      case 'close': d.stop(); this.guide.visible = false; v.gd?.screen?.close(); break;
      case 'home': this.hall?.walkHome(); break;
    }
    this.controls?.sync();
  }

  // voice.respond 开头调用：返回 true 表示已处理（不再交给模型）
  async intercept(text, {sceneEntry} = {}) {
    if (!this.script || !this.voice.gdEnabled || sceneEntry || this.voice.tour?.state === 'video') { this.stopAttract(); return false; }
    if (this.running) this.cancel(); // 访客插话：停止后续剧本
    const c = clean(text);
    const handled = await this.command(c, text);
    this.stopAttract({keepScreen: handled});
    if (handled) { this.controls?.sync(); return true; }
    if ((this.offered && affirm(text)) || ASK_STOP.test(c)) {
      this.offered = false;
      this.voice.log('你', text);
      this.deck.stop();
      this.run();
      return true;
    }
    if (this.offered && negative(text)) this.offered = false;
    if (this.deck.playing) this.deck.pause();   // 来宾提问：节目停在当前页，先回答
    return false;
  }

  cancel() { this.token++; this.running = false; }

  // 口令：直接执行，不靠模型决定是否调用工具。返回 true 表示已处理完；
  // 对比之后把真实资料放进 pendingFacts 再交给模型讲解（返回 false）。
  async command(c, raw) {
    const st = this.voice.gd, screen = st?.screen;
    if (!screen) return false;
    const log = () => this.voice.log?.('你', raw);

    if (ASK_HELP.test(c)) { log(); this.controls?.showHelp(); this.speak(LINES.help, ++this.token); return true; }
    // 节目单与频道
    if (ASK_GUIDE.test(c)) { log(); this.showGuide(); return true; }
    const ch = /频道|路线|^(实验室|政府|企业|方法|设计方法)$/.test(c) ? (this.guide.pickChannel(c) || this.guide.pickChannel(c.replace(/(频道|路线)$/, ''))) : null;
    if (ch) { log(); if (ch.route) this.setRoute(ch.route); this.showGuide({say: false, channel: ch.id}); return true; }
    const recent = this.guide.isShowing || Date.now() - this.guideShownAt < 180000;
    if (recent && parseNumber(c)) { const it = this.guide.pick(c); if (it) { log(); this.startProgramme(it); return true; } }
    if (this.guide.isShowing) { const it = this.guide.pick(c); if (it) { log(); this.startProgramme(it); return true; } }

    // 正在播放的节目：继续、暂停、翻页、重讲、跳页、退出
    if (this.deck.deck && this.deck.active) {
      if (/^(继续|接着(讲|说|播)?|继续(讲|说|播放?)|往下讲|然后呢)/.test(c)) { log(); this.deck.resume(); return true; }
      if (/^(下一页|下一张|往下|往下翻|翻页|翻下一页)/.test(c)) { log(); this.deck.next(); return true; }
      if (/^(上一页|上一张|往上|往上翻|回到上一页|返回上一页)/.test(c)) { log(); this.deck.prev(); return true; }
      if (/^(重讲|再讲一遍|再说一遍|重说|重复一下|这一页再讲一遍|没听清)/.test(c)) { log(); this.deck.replay(); return true; }
      if (/^(从头讲|从头开始|从第一页|重新开始|重头讲)/.test(c)) { log(); this.deck.restartDeck(); return true; }
      const pg = c.match(/^(跳到|翻到|回到|看)?第?([0-9一二三四五六])页$/);
      if (pg) { log(); this.deck.goto(parseNumber(pg[2]) - 1); return true; }
      if (/^(停|暂停|停一下|先停一下|别说了|等一下|等等|安静)/.test(c)) { log(); this.deck.pause(); return true; }
      if (/^(退出|关掉|关闭|不看了|结束|返回)(节目|屏幕)?$/.test(c)) { log(); this.showGuide({say: false}); return true; }
    }
    if (/^(停|别说了|安静|先停一下|停一下)$/.test(c) && this.isTalking()) { log(); this.interruptAll(); return true; }

    // 网页（原始档案页）操作
    const pageOpen = screen.isOpen && !screen.state.pages[0]?.custom;
    const act = pageOpen && (/^(请|再|麻烦)?(往下|向下|下)(翻|滚|拉|看)|^下一页|^翻页|^往下$/.test(c) ? 'scroll_down'
      : /^(请|再)?(往上|向上|上)(翻|滚|拉|看)|^上一页|^往上$/.test(c) ? 'scroll_up'
      : /^(回到|返回)(顶部|开头|最上面)/.test(c) ? 'top'
      : /^(放大|大一点|字大一点|再大一点)/.test(c) ? 'zoom_in'
      : /^(缩小|小一点|再小一点)/.test(c) ? 'zoom_out' : '');
    if (act) { screen.control(act); this.voice.status?.('展示屏：' + {scroll_down: '往下翻', scroll_up: '往上翻', top: '回到顶部', zoom_in: '放大', zoom_out: '缩小'}[act]); return true; }
    if (screen.isOpen && /^(关掉|关闭|收起)(屏幕|展示屏|页面|网页|节目单)?$|^(把)?(屏幕|页面|网页|节目单)(关掉|关了|关闭|收起来)$/.test(c)) { this.deck.stop(); screen.close(); this.guide.visible = false; return true; }
    if (/^(打开|看看|看)(原|原始)?(网页|档案|档案页|项目档案|原网页)$/.test(c) && st.focus?.current) { log(); this.deck.stop(); await gdHandle('open_page', {target: st.focus.current.id}, st); return true; }
    if (/^(回到中间|回来|回到原位|回到大厅中间)$/.test(c)) { log(); this.hall?.walkHome(); return true; }

    // 换项目：同频道下一个节目；否则在最近的检索结果里换
    if (/^(再)?(换一个|换个|下一个|再来一个|看下一个)/.test(c)) {
      const cur = this.current && this.guide.chan(this.current.channel);
      if (cur && cur.items.includes(this.current)) { log(); this.startProgramme(cur.items[(cur.items.indexOf(this.current) + 1) % cur.items.length]); return true; }
      if (st.list?.length) { log(); const i = st.list.findIndex(p => p.id === st.focus?.current?.id); this.playDeck(st.list[(i + 1) % st.list.length].id); return true; }
    }
    if (/^(回到|返回|再看)(刚才|上一个|前一个)|^上一个(项目|节目)?$/.test(c) && st.focus?.previous) { log(); this.playDeck(st.focus.previous.id); return true; }

    // 对比：并排卡片 + 交给模型讲解
    if (/(这两个|两个项目|它们|他们|两者).*(关系|关联|联系|区别|不同|相同|共同|比较)|有什么(关系|关联|联系)$/.test(c) && st.focus?.current && st.focus?.previous) {
      this.deck.stop();
      const r = await gdHandle('gd_relate', {}, st);
      if (r?.a && r?.b) {
        screen.showNode(compareNode(r.a, r.b), {label: '好设计馆 · 对比', title: `${r.a.name} × ${r.b.name}`});
        st.pendingFacts = `【展示屏上并排列出了两个项目。比较时只依据以下资料：从要解决的问题、关键技术或方法、使用场景比较，说出一个真正的共同点和一个关键差别。】\n${itemFacts(r.a)}\n${itemFacts(r.b)}`;
      }
      return false;
    }

    // “看看/讲讲/打开 + 名字”：节目单里有就播节目，否则在好设计馆里找这个项目或方法做成节目
    const m = c.match(/^(请)?(帮我|给我)?(打开|看看|讲讲|讲一讲|介绍一下|介绍下|播放|我想看|我要看|我想了解)(一下)?(.{2,24}?)(吧|呢|这个项目|项目)?$/);
    if (m && !/好设计馆?$|^屏幕|^节目单$/.test(m[5])) {
      const it = this.guide.pick(m[5]);
      if (it) { log(); this.startProgramme(it); return true; }
      if (/^(打开|讲讲|讲一讲|介绍一下|介绍下|播放|我想看|我要看)$/.test(m[3])) {
        const r = await gdHandle('gd_search', {query: m[5].replace(/^(那个|这个|关于)/, ''), kind: 'all'}, st);
        const target = r.projects?.[0]?.id || r.methods?.[0]?.research_id;
        if (target) { log(); this.current = null; this.playDeck(target); return true; }
      }
    }
    return false;
  }

  // 逐字朗读一段固定讲解，等它说完
  async speak(text, token) {
    const v = this.voice;
    v.interrupt?.({keepChoices: true});
    if (token !== this.token) return false;
    v.visualMode = 'off';
    v.guidanceSpokenForTurn = true;
    v.replyText = text;
    v.log('小D', text);
    v.queueReplySentence(text);
    v.finishReplySpeech();
    const limit = Date.now() + Math.max(6000, text.length * 320);
    await wait(400);
    while (token === this.token && v.replySpeechActive && Date.now() < limit) await wait(200);
    return token === this.token;
  }

  async open(target) {
    if (!target) return;
    try { await gdHandle('open_page', {target}, this.voice.gd); } catch (e) { console.warn('好设计导览打开页面失败', e.message); }
  }

  // 好设计一站：按路线逐段讲解；step 可以是 {open, say}（页面 + 讲解）或 {say, deck}（引子 + 项目节目）
  async run() {
    const token = ++this.token;
    this.running = true;
    const route = this.routeConf;
    const steps = [this.script.intro, ...(route.steps || [])].filter(Boolean);
    this.voice.status?.(`好设计导览 · ${route.name}`);
    this.controls?.sync();
    try {
      for (const step of steps) {
        if (token !== this.token) return;
        if (step.deck) {
          if (step.say && !(await this.speak(step.say, token))) return;
          const it = this.guide.items.find(x => x.deck === step.deck);
          if (it && this.hall) await Promise.race([this.hall.walkToItem(it), wait(9000)]);
          if (!(await this.deck.playToEnd(step.deck)) || token !== this.token) return;
        } else {
          await this.open(step.open);
          if (!(await this.speak(step.say, token))) return;
        }
        await wait((step.pauseSeconds ?? 1.5) * 1000);
      }
      if (token !== this.token) return;
      if (route.closing?.open) await this.open(route.closing.open);
      this.deck.stop();
      this.guide.show({channel: this.guide.channelForRoute(this.route)});
      this.guideShownAt = Date.now();
      this.hall?.walkHome();
      if (route.closing?.say) await this.speak(route.closing.say, token);
      if (this.voice.gd) this.voice.gd.tourDone = true;
    } finally {
      if (token === this.token) this.running = false;
      this.controls?.sync();
    }
  }

  // 待机：展示屏显示节目单（像电视节目表），隔一段时间招呼一次；有人说话或唤醒时停止
  startAttract() {
    const idle = this.script?.idle;
    if (!idle || !this.voice.gdEnabled || !this.voice.gd?.screen || this.attracting) return;
    this.attracting = true;
    this.deck.stop();
    this.hall?.walkHome();
    this.guide.show({channel: this.guide.channelForRoute(this.route) || this.guide.channel});
    this.guideShownAt = Date.now();
    if (idle.greetEverySeconds > 0 && idle.greeting) {
      const greet = () => {
        if (!this.attracting) return;
        const v = this.voice;
        if (!v.replySpeechActive && !v.responseId && !v.tour?.busy) this.speak(idle.greeting, ++this.token);
        this.greetTimer = setTimeout(greet, idle.greetEverySeconds * 1000);
      };
      this.greetTimer = setTimeout(greet, idle.greetEverySeconds * 1000);
    }
    this.controls?.sync();
  }

  stopAttract({keepScreen = false} = {}) {
    if (!this.attracting) return;
    this.attracting = false;
    clearTimeout(this.greetTimer);
    if (!keepScreen) { this.guide.visible = false; this.voice.gd?.screen?.close(); }
  }
}

function compareNode(a, b) {
  const root = document.createElement('div'); root.className = 'gd-compare';
  for (const it of [a, b]) {
    const col = document.createElement('section'); col.className = 'gd-compare-col';
    if (it.cover) { const pic = document.createElement('div'); pic.className = 'gd-compare-pic'; pic.style.backgroundImage = `url("${it.cover}")`; col.append(pic); }
    const h = document.createElement('h3'); h.textContent = it.name;
    const meta = document.createElement('p'); meta.className = 'gd-compare-meta'; meta.textContent = `${it.year} 中国好设计${it.award} · ${it.unit || ''}`;
    const sum = document.createElement('p'); sum.textContent = String(it.summary || '').slice(0, 150);
    col.append(h, meta, sum); root.append(col);
  }
  return root;
}
