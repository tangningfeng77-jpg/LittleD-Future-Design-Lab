// 展示屏（第二阶段）：在小D 旁边打开好设计馆页面，可左右分屏；翻页、缩放通过 postMessage 交给页面的展厅模式处理。
// 只打开好设计馆域名下的页面。小D 与页面同站部署时（如 haoshejiguan.com/littled/），展示屏直接给页面套展厅样式、
// 直接翻页缩放，不依赖网站上线展厅模式脚本。

const KIOSK_CSS = '[data-gd-chrome="navigation"],[data-gd-chrome="footer"],.gd-skip,.gd-ip-trigger,.gd-drawer,.apf-host,#apf-host{display:none!important}html{scroll-behavior:smooth}body{cursor:none}'
  + '.gd-focus{position:relative;z-index:5;outline:3px solid #4fc8ea!important;outline-offset:8px;border-radius:10px;box-shadow:0 0 0 100vmax rgba(12,34,50,.22),0 0 28px #7fdcf2!important;transition:box-shadow .5s,outline-color .5s}';
const cleanTitle = t => String(t || '').replace(/\s*[·|｜-]\s*好设计馆?\s*$/, '').replace(/\s*·\s*项目档案\s*$/, '');

export class GdScreen {
  constructor(host, base) {
    this.base = base.replace(/\/+$/, '');
    this.origin = new URL(this.base).origin;
    this.panes = [];
    this.el = document.createElement('div');
    this.el.className = 'gd-screen';
    this.el.hidden = true;
    this.el.setAttribute('aria-label', '好设计馆展示屏');
    host.appendChild(this.el);
    addEventListener('message', e => {
      if (e.origin !== this.origin || !e.data || e.data.gdKiosk !== 1) return;
      const pane = this.panes.find(p => p.frame.contentWindow === e.source);
      if (!pane) return;
      if (e.data.event === 'ready') { pane.ready = true; if (e.data.title && !pane.fixedTitle) pane.title.textContent = String(e.data.title).slice(0, 60); }
    });
  }

  get isOpen() { return !this.el.hidden; }
  get state() { return {open: this.isOpen, pages: this.panes.map(p => ({title: p.title.textContent, url: p.url, id: p.id, deck: p.deck || null, custom: !!p.custom}))}; }

  // 只允许本站页面：返回带展厅模式参数的地址，或 null
  safeUrl(url) {
    try {
      const u = new URL(url, this.base + '/');
      if (u.origin !== this.origin) return null;
      if (/^\/(api|admin|login|logout|mcp|inno\/mcp|pipeline)(\/|$)/.test(u.pathname)) return null;
      u.searchParams.set('kiosk', '1');
      return u.href;
    } catch { return null; }
  }

  makePane(item, label) {
    const pane = document.createElement('section');
    pane.className = 'gd-pane';
    const head = document.createElement('div'); // 不用 <header>：展厅模式的样式会隐藏页面里所有 header
    head.className = 'gd-pane-head';
    const src = document.createElement('span'); src.className = 'gd-src'; src.textContent = label || '好设计馆';
    const title = document.createElement('span'); title.className = 'gd-title'; title.textContent = item.title || '';
    head.append(src, title);
    const frame = document.createElement('iframe');
    frame.title = item.title || '好设计馆页面';
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.src = item.safe;
    pane.append(head, frame);
    const p = {el: pane, frame, title, url: item.url, id: item.id, ready: false, fixedTitle: !!item.title, direct: false, zoom: 1.15};
    frame.addEventListener('load', () => this.adopt(p));
    return p;
  }

  // items: [{url, title?, id?}]，一项为单屏，两项为左右分屏
  open(items) {
    const list = items.slice(0, 2).map(i => ({...i, safe: this.safeUrl(i.url)}));
    if (!list.length || list.some(i => !i.safe)) throw Error('只能打开好设计馆的页面');
    this.el.replaceChildren();
    this.panes = list.map((item, k) => this.makePane(item, list.length > 1 ? (k ? '对比 · B' : '对比 · A') : '好设计馆'));
    for (const p of this.panes) this.el.appendChild(p.el);
    this.el.classList.toggle('split', this.panes.length > 1);
    this.el.hidden = false;
    document.body.classList.add('gd-screen-open');
    return this.state;
  }

  // 同站页面：直接套展厅样式（隐藏导航、页脚、浮动按钮，字号放大）
  adopt(p) {
    let doc;
    try { doc = p.frame.contentDocument; } catch { return; }
    if (!doc?.documentElement) return;
    try { const sh = new p.frame.contentWindow.CSSStyleSheet(); sh.replaceSync(KIOSK_CSS); doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sh]; } catch {}
    doc.documentElement.style.setProperty('zoom', String(p.zoom));
    p.direct = true; p.ready = true;
    const setTitle = () => { if (!p.fixedTitle && doc.title) p.title.textContent = cleanTitle(doc.title).slice(0, 60); };
    setTitle(); setTimeout(setTitle, 2500);
  }

  // 在展示屏里显示自己的内容（幻灯片、节目单），而不是网页
  showNode(node, {label = '好设计馆', title = '', deck = null} = {}) {
    let p = this.panes.length === 1 && this.panes[0].custom ? this.panes[0] : null;
    if (!p) {
      this.el.replaceChildren();
      const pane = document.createElement('section'); pane.className = 'gd-pane gd-pane-custom';
      const head = document.createElement('div'); head.className = 'gd-pane-head';
      const src = document.createElement('span'); src.className = 'gd-src';
      const t = document.createElement('span'); t.className = 'gd-title';
      head.append(src, t);
      const stage = document.createElement('div'); stage.className = 'gd-pane-stage';
      pane.append(head, stage); this.el.append(pane);
      p = {el: pane, frame: null, title: t, src, stage, custom: true, ready: true, url: null, id: deck};
      this.panes = [p];
      this.el.classList.remove('split');
    }
    p.src.textContent = label; p.title.textContent = title; p.deck = deck; p.id = deck;
    p.stage.replaceChildren(node);
    this.el.hidden = false;
    document.body.classList.add('gd-screen-open');
    return this.state;
  }

  // 讲解时在网页上高亮正在讲的部分：找到包含这段文字的最小元素，滚到中间并加聚光
  focusText(text) {
    const p = this.panes.find(x => x.direct);
    if (!p || !text) return false;
    try {
      const doc = p.frame.contentDocument, want = String(text).replace(/\s+/g, '');
      doc.querySelectorAll('.gd-focus').forEach(e => e.classList.remove('gd-focus'));
      let best = null;
      // 先找标题（目录、导航里的同名链接不算），再找包含这段文字的最小块
      for (const e of doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,a,button,strong,span,div,section,article,figure,td')) {
        if (e.closest('[data-gd-chrome],.gd-drawer,nav,aside,.toc,[role="navigation"]')) continue;
        const t = (e.textContent || '').replace(/\s+/g, '');
        if (!t.includes(want)) continue;
        const heading = /^H[1-6]$/.test(e.tagName), score = (heading ? 0 : 100000) + t.length;
        if (!best || score < best.score) best = {e, score};
      }
      if (!best) return false;
      let el = best.e;
      // 在卡片、图、列表项里时，高亮整张卡片
      for (let up = el.parentElement, n = 0; up && up !== doc.body && n < 6; up = up.parentElement, n++) {
        if (/^(FIGURE|ARTICLE|LI)$/.test(up.tagName) || [...up.classList].some(c => /(^|-)card$/.test(c))) {
          if (up.getBoundingClientRect().height < (doc.defaultView.innerHeight || 800) * .85) el = up;
          break;
        }
      }
      // 文字太短的元素（如单个标题），向上找一个合适的卡片或段落框
      while (el.parentElement && el.getBoundingClientRect().width < 260 && el.parentElement !== doc.body) el = el.parentElement;
      el.classList.add('gd-focus');
      el.scrollIntoView({behavior: 'smooth', block: 'center'});
      return true;
    } catch { return false; }
  }

  clearFocus() { for (const p of this.panes) { try { p.frame?.contentDocument?.querySelectorAll('.gd-focus').forEach(e => e.classList.remove('gd-focus')); } catch {} } }

  close() {
    this.el.hidden = true;
    this.el.replaceChildren();
    this.panes = [];
    document.body.classList.remove('gd-screen-open');
  }

  // action: scroll_down | scroll_up | top | zoom_in | zoom_out | close；side: both | left | right
  control(action, side = 'both') {
    if (action === 'close') { this.close(); return {ok: true}; }
    if (!this.isOpen) return {ok: false, reason: '展示屏没有打开'};
    const targets = side === 'left' ? this.panes.slice(0, 1) : side === 'right' ? this.panes.slice(1, 2) : this.panes;
    const message = {gdKiosk: 1, action};
    for (const p of targets) {
      if (p.custom || !p.frame) continue;
      if (p.direct) {
        try {
          const w = p.frame.contentWindow, step = w.innerHeight * .72;
          if (action === 'scroll_down') w.scrollBy({top: step, behavior: 'smooth'});
          else if (action === 'scroll_up') w.scrollBy({top: -step, behavior: 'smooth'});
          else if (action === 'top') w.scrollTo({top: 0, behavior: 'smooth'});
          else if (action === 'zoom_in' || action === 'zoom_out') {
            p.zoom = Math.min(1.6, Math.max(.8, Math.round((p.zoom + (action === 'zoom_in' ? .1 : -.1)) * 100) / 100));
            p.frame.contentDocument.documentElement.style.setProperty('zoom', String(p.zoom));
          }
          continue;
        } catch { p.direct = false; }
      }
      p.frame.contentWindow?.postMessage(message, this.origin);
    }
    const notReady = targets.filter(p => !p.ready).length;
    return {ok: true, pending: notReady ? '页面还在加载或不支持展厅模式' : undefined};
  }
}
