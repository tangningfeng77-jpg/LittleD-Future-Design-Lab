// 展示屏（第二阶段）：在小D 旁边打开好设计馆页面，可左右分屏；翻页、缩放通过 postMessage 交给页面的展厅模式处理。
// 只打开好设计馆域名下的页面。

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
  get state() { return {open: this.isOpen, pages: this.panes.map(p => ({title: p.title.textContent, url: p.url, id: p.id}))}; }

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
    return {el: pane, frame, title, url: item.url, id: item.id, ready: false, fixedTitle: !!item.title};
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
    for (const p of targets) p.frame.contentWindow?.postMessage(message, this.origin);
    const notReady = targets.filter(p => !p.ready).length;
    return {ok: true, pending: notReady ? '页面还在加载或不支持展厅模式' : undefined};
  }
}
