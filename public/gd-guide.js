// 节目单（第五轮：频道化）：像电视一样分频道——实验室、偏政府领导、偏企业、设计方法。
// 每个频道内编号从 1 开始；说“第三个”指当前频道第三个，说“企业频道”切换；名字在所有频道里找。
// 清单 assets/tour/programmes.json。

import {asset, gdApi} from './gd-local.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const clean = s => String(s || '').normalize('NFKC').replace(/[\s，。！？、,.!?～~“”"'·]/g, '').toLowerCase();
const CN = {零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10};
export function parseNumber(t) {
  const m = clean(t).match(/^(?:我要|我想看|我想听|看|听|选|播放|讲|来|就|放)?第?([0-9]{1,2}|[一二两三四五六七八九十]{1,3})(?:个|号|项|条|集)?(?:吧|节目|项目)?$/);
  if (!m) return 0;
  const s = m[1];
  if (/^\d+$/.test(s)) return +s;
  if (s === '十') return 10;
  if (s.length === 2 && s[0] === '十') return 10 + CN[s[1]];
  if (s.length === 2 && s[1] === '十') return CN[s[0]] * 10;
  if (s.length === 3 && s[1] === '十') return CN[s[0]] * 10 + CN[s[2]];
  return CN[s] || 0;
}

export class ProgrammeGuide {
  constructor(st) { this.st = st; this.channels = []; this.items = []; this.channel = 'lab'; this.visible = false; this.mark = null; }

  async load() {
    try {
      const d = await (await fetch('./assets/tour/programmes.json', {cache: 'no-store'})).json();
      this.channels = (d.channels || []).map(c => ({...c, items: (c.items || []).map((it, i) => ({...it, no: i + 1, channel: c.id, key: c.id + ':' + (i + 1)}))}));
      this.items = this.channels.flatMap(c => c.items);
      this.channel = this.channels[0]?.id || 'lab';
    } catch { this.items = []; }
    // 封面在后台补齐，不阻塞启动；节目单正在显示时补齐后刷新
    this.coversReady = Promise.all(this.items.filter(it => it.kind === 'deck' && /^\d{4}-/.test(it.deck)).map(async it => {
      try { const r = await gdApi({op: 'read', id: it.deck}); it.cover = r.item?.cover; it.award = r.item ? `${r.item.year} ${r.item.award}` : ''; } catch {}
    })).then(() => { if (this.isShowing) this.show(); });
    return this.items.length > 0;
  }

  chan(id = this.channel) { return this.channels.find(c => c.id === id) || this.channels[0]; }
  channelForRoute(route) { return this.channels.find(c => c.route === route)?.id; }

  image(it) {
    if (it.image) return it.image;
    if (it.kind === 'lab-scene') return asset(`./assets/scene-choices/${it.scene}.png`);
    if (it.kind === 'lab-project') return asset('./assets/ifs-project/ifs-project-icon.png');
    return it.cover || '';
  }

  // 显示节目单；channel 指定频道；mark 为刚看完/推荐的节目 key
  show({channel, mark} = {}) {
    if (channel && this.chan(channel)) this.channel = this.chan(channel).id;
    if (mark !== undefined) this.mark = mark;
    const c = this.chan();
    const root = el('div', 'gd-guide');
    const tabs = el('nav', 'gd-guide-tabs');
    for (const ch of this.channels) {
      const t = el('button', 'gd-guide-tab' + (ch.id === c.id ? ' is-on' : ''), ch.short || ch.name);
      t.type = 'button'; t.onclick = () => { this.show({channel: ch.id}); this.onChange?.(); };
      tabs.append(t);
    }
    root.append(tabs);
    const grid = el('div', 'gd-guide-grid');
    c.items.forEach((it, i) => {
      const card = el('button', 'gd-guide-card' + (this.mark === it.key ? ' is-pick' : ''));
      card.type = 'button'; card.style.setProperty('--i', i);
      const img = this.image(it);
      const pic = el('div', 'gd-guide-pic' + (it.kind === 'lab-scene' || it.kind === 'lab-project' ? ' is-art' : ''));
      if (img) pic.style.backgroundImage = `url("${img}")`;
      else pic.append(el('span', 'gd-guide-mono', it.kind === 'gd-intro' ? '导览' : it.title.replace(/[^一-龥A-Za-z0-9]/g, '').slice(0, 2)));
      card.append(el('span', 'gd-guide-no', String(it.no)), pic, el('span', 'gd-guide-name', it.title));
      if (it.award) card.append(el('span', 'gd-guide-meta', it.award));
      card.onclick = () => this.onPick?.(it);
      grid.append(card);
    });
    root.append(grid);
    root.append(el('p', 'gd-guide-tip', '说“第几个”或节目名字 · 说“企业频道”“方法频道”换频道 · 也可以点卡片'));
    this.st.screen.showNode(root, {label: '小D · 节目单', title: c.name});
    this.visible = true;
    this.onChange?.();
  }

  hide() { if (this.isShowing) this.st.screen.close(); this.visible = false; }

  get isShowing() { return this.visible && !!this.st.screen?.isOpen && !!this.st.screen.state.pages[0]?.custom && !this.st.screen.state.pages[0].deck; }

  // “企业频道”“换到政府”之类
  pickChannel(text) {
    const c = clean(text).replace(/^(切换到|切到|换到|换成|打开|看看|去|到|回到)/, '').replace(/(吧|呢)$/, '');
    if (!c) return null;
    return this.channels.find(ch => [ch.short, ch.name, ...(ch.aliases || [])].some(a => clean(a) === c)) || null;
  }

  // 根据来宾的话找节目：第 N 个（当前频道）/ 名字 / 别名（先当前频道，再全部）
  pick(text) {
    const n = parseNumber(text);
    if (n) return this.chan().items.find(it => it.no === n) || null;
    const c = clean(text).replace(/^(我想看|我要看|看看|看|讲讲|讲|播放|放|来个|打开|介绍一下|介绍)/, '').replace(/(吧|这个|节目|项目)$/, '');
    if (c.length < 2) return null;
    const match = it => [it.title, ...(it.aliases || [])].some(a => { const x = clean(a); return x && (c === x || c.includes(x) || (x.includes(c) && c.length >= 2)); });
    return this.chan().items.find(match) || this.items.find(match) || null;
  }

  // 给遥控器的精简清单
  summary() { return this.channels.map(c => ({id: c.id, name: c.short || c.name, items: c.items.map(it => ({key: it.key, no: it.no, title: it.title}))})); }
  byKey(key) { return this.items.find(it => it.key === key) || null; }
}
