// 好设计导览（第三阶段）：在实验室导览里加一站“好设计”，按来宾路线逐段讲解并在展示屏打开页面；
// 无人交流时展示屏轮播精选项目；结尾可引向小D 访谈。剧本在 assets/tour/gooddesign-tour.json，现场可改。
import {gdHandle} from './gooddesign.js';
import {affirm, negative} from './guide-flow.js';

const clean = s => String(s || '').normalize('NFKC').replace(/[\s，。！？、,.!?～~]/g, '');
const ROUTE_KEY = 'littled.gdRoute';
// “介绍一下好设计馆”“带我看看好设计”之类的明确请求；“好设计里有没有农业项目”不算
const ASK_STOP = /^(请|那)?(你)?(带我|给我|带我们|给我们)?(看看|看一看|介绍|介绍一下|介绍下|参观|参观一下|了解|了解一下|了解下|讲讲|讲一讲|讲下|说说|说下)(一下)?好设计馆?(吧|呢|好吗)?$|^好设计馆?(是什么|是干什么的|介绍一下)(呀|呢)?$/;

export class GdTour {
  constructor(voice) {
    this.voice = voice;
    this.script = null;
    this.running = false;
    this.offered = false;
    this.token = 0;
    this.attractTimer = null;
    this.greetTimer = null;
    this.attracting = false;
    this.route = this.initialRoute();
  }

  async load() {
    try { this.script = await (await fetch('./assets/tour/gooddesign-tour.json', {cache: 'no-store'})).json(); }
    catch { this.script = null; }
    if (this.script && !this.script.routes?.[this.route]) this.route = this.script.defaultRoute || Object.keys(this.script.routes || {})[0];
    this.mountRoutePicker();
    return !!this.script;
  }

  initialRoute() {
    const fromUrl = new URLSearchParams(location.search).get('route');
    if (fromUrl) { try { localStorage.setItem(ROUTE_KEY, fromUrl); } catch {} return fromUrl; }
    try { return localStorage.getItem(ROUTE_KEY) || ''; } catch { return ''; }
  }

  // 侧栏里给现场人员选路线（展厅模式下侧栏默认收起）
  mountRoutePicker() {
    const host = document.querySelector('.right');
    if (!host || !this.script) return;
    const box = document.createElement('details');
    box.innerHTML = '<summary>好设计导览路线</summary><label>来宾类型<select></select></label><p>也可以在网址后加 ?route=government 或 ?route=enterprise。</p>';
    const select = box.querySelector('select');
    for (const [id, r] of Object.entries(this.script.routes)) select.append(new Option(r.name, id, false, id === this.route));
    select.onchange = () => { this.route = select.value; try { localStorage.setItem(ROUTE_KEY, this.route); } catch {} };
    host.append(box);
  }

  offerText() {
    if (!this.script?.offer || !this.voice.gdEnabled) return '';
    this.offered = true;
    return this.script.offer;
  }

  // voice.respond 开头调用：返回 true 表示已由好设计导览处理
  async intercept(text, {sceneEntry} = {}) {
    this.stopAttract();
    if (!this.script || !this.voice.gdEnabled || sceneEntry || this.voice.tour?.state === 'video') return false;
    if (this.running) this.cancel(); // 访客插话：停止后续剧本，交给自由问答
    const c = clean(text);
    if (this.offered && negative(text)) { this.offered = false; return false; }
    if ((this.offered && affirm(text)) || ASK_STOP.test(c)) {
      this.offered = false;
      this.voice.log('你', text);
      this.run();
      return true;
    }
    return false;
  }

  cancel() { this.token++; this.running = false; }

  // 逐字朗读一段固定讲解，等它说完
  async speak(text, token) {
    const v = this.voice;
    v.interrupt?.();
    if (token !== this.token) return false;
    v.visualMode = 'off';
    v.guidanceSpokenForTurn = true;
    v.replyText = text;
    v.log('小D', text);
    v.queueReplySentence(text);
    v.finishReplySpeech();
    const limit = Date.now() + Math.max(6000, text.length * 320);
    await new Promise(r => setTimeout(r, 400));
    while (token === this.token && v.replySpeechActive && Date.now() < limit) await new Promise(r => setTimeout(r, 200));
    return token === this.token;
  }

  async open(target) {
    if (!target) return;
    try { await gdHandle('open_page', {target}, this.voice.gd); } catch (e) { console.warn('好设计导览打开页面失败', e.message); }
  }

  async run() {
    const token = ++this.token;
    this.running = true;
    const route = this.script.routes[this.route] || Object.values(this.script.routes)[0];
    const steps = [this.script.intro, ...(route.steps || [])].filter(Boolean);
    this.voice.status?.(`好设计导览 · ${route.name}`);
    try {
      for (const step of steps) {
        if (token !== this.token) return;
        await this.open(step.open);
        if (!(await this.speak(step.say, token))) return;
        await new Promise(r => setTimeout(r, (step.pauseSeconds ?? 2) * 1000));
      }
      if (token !== this.token) return;
      if (route.closing?.open) await this.open(route.closing.open);
      if (route.closing?.say) await this.speak(route.closing.say, token);
      if (this.voice.gd) this.voice.gd.tourDone = true;
    } finally {
      if (token === this.token) this.running = false;
    }
  }

  // 待机：展示屏轮播精选项目，隔一段时间招呼一次；有人说话或唤醒时停止
  startAttract() {
    const idle = this.script?.idle;
    if (!idle || !this.voice.gdEnabled || !this.voice.gd?.screen || this.attracting) return;
    this.attracting = true;
    const list = idle.rotate || [];
    let i = 0;
    const show = async () => {
      if (!this.attracting || !list.length) return;
      const id = list[i++ % list.length], st = this.voice.gd;
      // 直接上屏，不改“当前/上一个项目”，以免影响来宾后面问“这两个有什么关系”
      try { st.screen.open([{url: `${st.base}/dossier/?project=${encodeURIComponent(id)}`, id}]); } catch {}
      if (this.attracting) this.attractTimer = setTimeout(show, (idle.intervalSeconds || 25) * 1000);
    };
    show();
    if (idle.greetEverySeconds > 0 && idle.greeting) {
      const greet = () => {
        if (!this.attracting) return;
        const v = this.voice;
        if (!v.replySpeechActive && !v.responseId && !v.tour?.busy) this.speak(idle.greeting, this.token);
        this.greetTimer = setTimeout(greet, idle.greetEverySeconds * 1000);
      };
      this.greetTimer = setTimeout(greet, idle.greetEverySeconds * 1000);
    }
  }

  stopAttract() {
    if (!this.attracting) return;
    this.attracting = false;
    clearTimeout(this.attractTimer);
    clearTimeout(this.greetTimer);
    this.voice.gd?.screen?.close();
  }
}
