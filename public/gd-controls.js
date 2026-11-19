// 控制层（第五轮）：屏幕控制条、“你可以这样说”帮助卡、讲解员手机遥控（遥控码配对）。
// 控制条在鼠标移动时出现，几秒后自动隐藏；遥控器页面 remote.html，输入屏幕上的四位遥控码即可操作。

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const ICON = {
  prev: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  list: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="7" height="6" rx="1.5"/><rect x="13" y="5" width="7" height="6" rx="1.5"/><rect x="4" y="13" width="7" height="6" rx="1.5"/><rect x="13" y="13" width="7" height="6" rx="1.5"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.6a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.6M12 16.6v.1"/></svg>'
};
export const HELP = [
  ['开始', ['你好，小D（开始实验室参观）', '介绍一下好设计馆 / 去看好设计馆', '节目单 / 还有哪些项目']],
  ['跟着小D', ['问第一个 / 问第二个（屏幕左侧的提示问题）', '下一部分 / 继续', '换一个场景', '结束参观']],
  ['选节目', ['第三个 / 播放第三个', '说节目名字，例如：嫦娥、海尔空调', '企业频道 / 政府频道 / 方法频道 / 实验室频道', '讲讲某某项目（任何好设计项目都能讲）']],
  ['播放中', ['停 / 暂停，继续', '下一页，上一页', '从头讲 / 重讲这一页', '退出，回到节目单', '看原网页']],
  ['提问', ['这个项目解决什么问题？', '这两个有什么关系？（对比刚看过的两个）', '好设计馆里有没有农业方面的项目？']],
  ['不用说话', ['点一下小D：立即停下；再点一下：继续', '翻页笔 → 下一页，← 上一页，B 暂停/继续，M 节目单，Esc 返回', '讲解员手机遥控：打开遥控页，输入右下角遥控码']]
];

export class Controls {
  constructor(tour) {
    this.tour = tour;
    this.code = this.loadCode();
    this.bar = el('div', 'gd-ctrl');
    this.bar.setAttribute('role', 'toolbar'); this.bar.setAttribute('aria-label', '小D 控制');
    const btn = (name, title, fn) => { const b = el('button', 'gd-ctrl-btn', ICON[name]); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.dataset.k = name; b.onclick = e => { e.stopPropagation(); fn(); this.poke(); }; this.bar.append(b); return b; };
    btn('prev', '上一页', () => tour.remote('prev'));
    this.playBtn = btn('pause', '暂停 / 继续', () => tour.remote('toggle'));
    btn('next', '下一页', () => tour.remote('next'));
    btn('stop', '停止说话', () => tour.remote('stop'));
    btn('list', '节目单', () => tour.remote('guide'));
    btn('help', '你可以这样说', () => this.showHelp());
    this.codeEl = el('span', 'gd-ctrl-code', `遥控码 <b>${this.code}</b>`);
    this.codeEl.title = '讲解员用手机打开遥控页，输入这四位数字';
    this.bar.append(this.codeEl);
    document.querySelector('.viewport')?.append(this.bar);
    addEventListener('pointermove', () => this.poke(), {passive: true});
    this.poke();
    this.connect();
  }

  loadCode() {
    const fromUrl = new URLSearchParams(location.search).get('remote');
    if (/^\d{4}$/.test(fromUrl || '')) return fromUrl;
    try { const c = localStorage.getItem('littled.remoteCode'); if (/^\d{4}$/.test(c || '')) return c; } catch {}
    const c = String(1000 + Math.floor(Math.random() * 9000));
    try { localStorage.setItem('littled.remoteCode', c); } catch {}
    return c;
  }

  poke() {
    this.bar.classList.add('is-on');
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.bar.classList.remove('is-on'), 4500);
  }

  sync() {
    const d = this.tour.deck;
    const playing = !!(d.deck && d.active && !d.paused);
    this.playBtn.innerHTML = playing ? ICON.pause : ICON.play;
    this.bar.classList.toggle('has-deck', !!(d.deck && d.active));
    this.publish();
  }

  showHelp() {
    const root = el('div', 'gd-help');
    root.append(el('h2', null, '你可以这样和小D 互动'));
    const grid = el('div', 'gd-help-grid');
    for (const [title, lines] of HELP) {
      const sec = el('section');
      sec.append(el('h3', null, title));
      const ul = el('ul');
      for (const l of lines) ul.append(el('li', null, l.replace(/</g, '&lt;')));
      sec.append(ul); grid.append(sec);
    }
    root.append(grid);
    root.append(el('p', 'gd-help-foot', `讲解员遥控：手机打开 <b>${location.origin}${location.pathname.replace(/[^/]*$/, '')}remote.html</b>，输入遥控码 <b>${this.code}</b>`));
    this.tour.voice.gd.screen.showNode(root, {label: '小D · 帮助', title: '你可以这样说'});
    this.tour.guide.visible = false;
  }

  // ---------- 手机遥控 ----------
  connect() {
    try {
      this.es?.close();
      this.es = new EventSource(`api/remote/events?code=${this.code}`);
      this.es.onmessage = e => { try { const m = JSON.parse(e.data); if (m.cmd) { this.tour.remote(m.cmd, m.arg, true); this.poke(); } } catch {} };
      this.es.onopen = () => this.publish(true);
    } catch {}
  }

  publish(force = false) {
    clearTimeout(this.pubTimer);
    this.pubTimer = setTimeout(() => {
      const t = this.tour, d = t.deck, st = t.voice.gd;
      const state = {
        at: Date.now(), route: t.route,
        mode: d.deck && d.active ? (d.paused ? 'paused' : 'playing') : t.guide.isShowing ? 'guide' : t.running ? 'tour' : st?.screen?.isOpen ? 'screen' : 'idle',
        deck: d.deck ? {title: d.deck.name, page: d.index + 1, pages: d.deck.slides.length} : null,
        channel: t.guide.channel, channels: t.guide.summary(),
        act: t.host?.act ?? -1, cues: t.host?.cues || [], waiting: !!t.host?.waiting,
        status: document.getElementById('aiStatus')?.textContent || ''
      };
      const s = JSON.stringify(state);
      if (!force && s === this.lastState) return;
      this.lastState = s;
      fetch('api/remote/state', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: this.code, state})}).catch(() => {});
    }, force ? 0 : 400);
  }
}
