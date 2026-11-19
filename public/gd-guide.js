// 节目单（第四轮）：像看电视一样列出小D 能讲的内容，编号连续；来宾说“第三个”、说名字或点卡片即开始。
// 清单在 assets/tour/programmes.json，按频道分组；以后实验室其他项目的 PPT 转成节目后也加在这里。

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const clean = s => String(s || '').normalize('NFKC').replace(/[\s，。！？、,.!?～~“”"']/g, '').toLowerCase();
const CN = {零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10};
export function parseNumber(t) {
  const m = clean(t).match(/^(?:我要|我想看|看|选|播放|讲|来|就)?第?([0-9]{1,2}|[一二两三四五六七八九十]{1,3})(?:个|号|项|条)?(?:吧|节目|项目)?$/);
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
  constructor(st) { this.st = st; this.items = []; this.channels = []; this.visible = false; this.recommend = new Set(); }

  async load() {
    try {
      const d = await (await fetch('./assets/tour/programmes.json', {cache: 'no-store'})).json();
      let no = 0;
      this.channels = (d.channels || []).map(c => ({name: c.name, items: (c.items || []).map(it => ({...it, no: ++no}))}));
      this.items = this.channels.flatMap(c => c.items);
    } catch { this.items = []; }
    // 好设计项目补上封面
    await Promise.all(this.items.filter(it => it.kind === 'deck').map(async it => {
      try { const r = await (await fetch('api/gd?op=read&id=' + encodeURIComponent(it.deck))).json(); it.cover = r.item?.cover; it.award = r.item ? `${r.item.year} ${r.item.award}` : ''; } catch {}
    }));
    return this.items.length > 0;
  }

  image(it) {
    if (it.image) return it.image;
    if (it.kind === 'lab-scene') return `./assets/scene-choices/${it.scene}.png`;
    if (it.kind === 'lab-project') return './assets/ifs-project/ifs-project-icon.png';
    return it.cover || '';
  }

  // 显示节目单；recommend 为要突出的节目（路线推荐、看完一个后的相关推荐）
  show({title = '节目单', recommend = []} = {}) {
    this.recommend = new Set(recommend);
    const root = el('div', 'gd-guide');
    for (const c of this.channels) {
      const row = el('section', 'gd-guide-row');
      row.append(el('h3', 'gd-guide-channel', c.name));
      const grid = el('div', 'gd-guide-grid');
      c.items.forEach((it, i) => {
        const card = el('button', 'gd-guide-card' + (this.recommend.has(it.deck || it.scene || it.kind) ? ' is-pick' : ''));
        card.type = 'button'; card.style.setProperty('--i', i);
        const img = this.image(it);
        const pic = el('div', 'gd-guide-pic' + (it.kind === 'lab-scene' || it.kind === 'lab-project' ? ' is-art' : ''));
        if (img) pic.style.backgroundImage = `url("${img}")`; else pic.append(el('span', 'gd-guide-mono', it.title.slice(0, 2)));
        card.append(el('span', 'gd-guide-no', String(it.no)), pic, el('span', 'gd-guide-name', it.title));
        if (it.award) card.append(el('span', 'gd-guide-meta', it.award));
        card.onclick = () => this.onPick?.(it);
        grid.append(card);
      });
      row.append(grid);
      root.append(row);
    }
    root.append(el('p', 'gd-guide-tip', '说“第几个”或节目名字，也可以直接点卡片'));
    this.st.screen.showNode(root, {label: '小D · 节目单', title});
    this.visible = true;
  }

  hide() { if (this.visible && this.st.screen?.state.pages[0]?.custom && !this.st.screen.state.pages[0].deck) this.st.screen.close(); this.visible = false; }

  get isShowing() { return this.visible && !!this.st.screen?.isOpen && !!this.st.screen.state.pages[0]?.custom && !this.st.screen.state.pages[0].deck; }

  // 根据来宾的话找节目：第 N 个 / 名字 / 别名
  pick(text) {
    const n = parseNumber(text);
    if (n) return this.items.find(it => it.no === n) || null;
    const c = clean(text).replace(/^(我想看|我要看|看看|看|讲讲|讲|播放|来个|打开)/, '').replace(/(吧|这个|节目|项目)$/, '');
    if (c.length < 2) return null;
    return this.items.find(it => [it.title, ...(it.aliases || [])].some(a => { const x = clean(a); return x && (c === x || c.includes(x) || (x.includes(c) && c.length >= 2)); })) || null;
  }
}
