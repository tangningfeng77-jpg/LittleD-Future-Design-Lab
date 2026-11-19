// 好设计知识接入：工具定义、调用本机 /api/gd、展示屏控制（第二阶段）、本地知识包加载。
// 令牌只在本机服务端（.env.local 的 GD_MCP_TOKEN），浏览器只访问同源 /api/gd。

export const GD_TOOLS = [
  {type: 'function', function: {
    name: 'gd_search',
    description: '在好设计馆（中国好设计获奖项目库与设计方法库）里找项目或设计方法。访客问到某个领域、产品、技术或“有没有某类项目”“某件事怎么做”时使用。返回项目编号、名称、获奖、单位、摘要，以及方法编号和用途。',
    parameters: {type: 'object', properties: {
      query: {type: 'string', description: '简短关键词，如“农业机器人”“物流”“用户需求”'},
      kind: {type: 'string', enum: ['all', 'project', 'method'], description: '只找项目、只找方法，或都找（默认）。问做法、流程、方法时用 method'}
    }, required: ['query']}}},
  {type: 'function', function: {
    name: 'gd_read',
    description: '读取好设计馆里一个项目或方法的要点，用于讲解。编号来自 gd_search 的结果：项目形如 2021-c21，方法形如 R08。',
    parameters: {type: 'object', properties: {id: {type: 'string'}}, required: ['id']}}},
  {type: 'function', function: {
    name: 'gd_relate',
    description: '比较好设计馆里的两个项目，讲清它们的关联与差别。访客说“这两个有什么关系”“和刚才那个比”时使用；省略的一方默认是刚才讲过的项目。',
    parameters: {type: 'object', properties: {a: {type: 'string', description: '项目编号；可省略，默认当前项目'}, b: {type: 'string', description: '项目编号；可省略，默认上一个项目'}}}}},
  {type: 'function', function: {
    name: 'open_page',
    description: '在小D 旁边的展示屏打开好设计馆页面。访客说“打开……”“给我看看……”时使用。target 可以是项目编号、方法编号、home（好设计馆首页）、projects（项目库）、methods（方法库）、museum（展馆），或项目名称关键词。打开项目时会一并返回项目要点，可直接讲解。',
    parameters: {type: 'object', properties: {target: {type: 'string'}}, required: ['target']}}},
  {type: 'function', function: {
    name: 'page_control',
    description: '控制展示屏：往下翻、往上翻、回到顶部、放大、缩小、关闭。访客说“往下翻”“放大一点”“关掉”时使用。',
    parameters: {type: 'object', properties: {action: {type: 'string', enum: ['scroll_down', 'scroll_up', 'top', 'zoom_in', 'zoom_out', 'close']}}, required: ['action']}}},
  {type: 'function', function: {
    name: 'switch_project',
    description: '换一个项目并在展示屏打开。“换一个”“下一个”用 direction=next（在最近找到的项目里换）；“回到刚才那个”用 direction=previous；“换成某某”用 to 填项目编号或名称关键词。返回新项目的要点。',
    parameters: {type: 'object', properties: {to: {type: 'string'}, direction: {type: 'string', enum: ['next', 'previous']}}}}}
];
export const GD_NAMES = new Set(GD_TOOLS.map(t => t.function.name));
const SCREEN_TOOLS = new Set(['open_page', 'page_control', 'switch_project']);

const BASE_INSTRUCTIONS = '你还能查阅好设计馆：一个收录历届中国好设计获奖项目（数百个）和 64 种设计方法的设计知识平台。访客问到实验室资料以外的设计项目、某个行业的优秀设计、某件事的设计方法，或主动提到“好设计”时，调用 gd_search，再按需 gd_read；问两个项目的关系时调用 gd_relate。讲好设计馆的内容时可以自然说一句“好设计馆里收录了……”，项目要说出名称、获奖年份和奖项，用一两个具体细节讲清它解决什么问题；不要读编号和网址。好设计馆里没找到时照实说，再回到实验室能讲的内容。';
const SCREEN_INSTRUCTIONS = '你身边有一块展示屏，能打开好设计馆的页面。访客想看某个项目、方法或好设计馆时调用 open_page；说“往下翻”“放大”“关掉”时调用 page_control；说“换一个”“下一个”“回到刚才那个”“换成某某”时调用 switch_project；比较两个项目时 gd_relate 会自动左右分屏。打开页面后讲内容本身，不描述网页长什么样，也不说“我已经打开了网页”，可以说“请看屏幕”。';

// 每轮更新：告诉模型展示屏和当前项目的状态（讲解员用翻页笔换了项目，小D 也知道）
export function gdInstructions(st) {
  let t = BASE_INSTRUCTIONS;
  if (st?.screen) {
    t += SCREEN_INSTRUCTIONS;
    const pages = st.screen.state.pages;
    t += st.screen.isOpen ? `展示屏当前打开：${pages.map(p => p.title).filter(Boolean).join(' 与 ') || '好设计馆页面'}。` : '展示屏当前关闭。';
  }
  if (st?.focus?.current) t += `当前讲到的好设计项目：${st.focus.current.name}（${st.focus.current.id}）` + (st.focus.previous ? `；上一个：${st.focus.previous.name}（${st.focus.previous.id}）。` : '。');
  return t;
}
// 兼容第一阶段
export const GD_INSTRUCTIONS = BASE_INSTRUCTIONS;

export function createGdState(base) { return {base: String(base || 'https://haoshejiguan.com').replace(/\/+$/, ''), focus: {current: null, previous: null}, list: [], screen: null}; }

const clipArg = (v, n = 80) => String(v || '').trim().slice(0, n);
const PROJECT_ID = /^\d{4}-[a-z]?\d+$/i, METHOD_ID = /^(R\d{1,3}|IM-[A-Z]+-\d+)$/i;
const SECTIONS = {home: '/', projects: '/projects/', methods: '/methods/', museum: '/museum/', apps: '/apps/', model: '/model/', about: '/about/'};

async function api(params) {
  const response = await fetch('/api/gd?' + new URLSearchParams(params), {signal: AbortSignal.timeout(20000)});
  return response.json();
}

function setFocus(st, item) {
  if (!item || item.kind === 'method' || !item.id || item.id === st.focus.current?.id) return;
  st.focus.previous = st.focus.current;
  st.focus.current = {id: item.id, name: item.name, page: item.page};
}

// 把 target 解析成可打开的页面：{url, title, id, item}
async function resolveTarget(st, target) {
  target = clipArg(target, 80);
  const key = target.toLowerCase();
  if (SECTIONS[key]) return {url: st.base + SECTIONS[key], title: {home: '好设计馆', projects: '项目库', methods: '方法库', museum: '展馆', apps: '应用中心', model: '大模型', about: '关于好设计馆'}[key]};
  if (target.startsWith('/')) return {url: st.base + target, title: ''};
  if (PROJECT_ID.test(target) || METHOD_ID.test(target)) {
    const r = await api({op: 'read', id: target});
    if (!r.item) throw Error(r.error || '没有这个编号');
    return {url: r.item.page, title: r.item.name, id: r.item.id, item: r.item};
  }
  const r = await api({op: 'search', q: target});
  st.list = r.projects?.length ? r.projects : st.list;
  const first = r.projects?.[0] || r.methods?.[0];
  if (!first) throw Error('好设计馆里没有找到“' + target + '”');
  const read = await api({op: 'read', id: first.research_id || first.id});
  const item = read.item || first;
  return {url: item.page, title: item.name, id: item.id, item};
}

function openOnScreen(st, pages) {
  if (!st.screen) return '展示屏不可用';
  try { st.screen.open(pages); return pages.length > 1 ? '已在展示屏左右分屏打开' : '已在展示屏打开'; }
  catch (e) { return '展示屏打不开：' + e.message; }
}

// 处理一个好设计工具调用，返回给模型的对象
export async function gdHandle(name, args, st) {
  if (name === 'gd_search') {
    const r = await api({op: 'search', q: clipArg(args.query), ...(['project', 'method'].includes(args.kind) ? {kind: args.kind} : {})});
    if (r.projects?.length) st.list = r.projects;
    return r;
  }
  if (name === 'gd_read') {
    const r = await api({op: 'read', id: clipArg(args.id, 40)});
    setFocus(st, r.item);
    return r;
  }
  if (name === 'gd_relate') {
    const a = clipArg(args.a, 40) || st.focus.current?.id;
    const b = clipArg(args.b, 40) || (a === st.focus.current?.id ? st.focus.previous?.id : st.focus.current?.id);
    if (!a || !b || a === b) return {error: '需要两个不同的项目。先请访客说出要比较的两个项目，或先用 gd_search 找到它们。'};
    const r = await api({op: 'relate', a, b});
    if (r.a?.page && r.b?.page && st.screen) r.screen = openOnScreen(st, [{url: r.a.page, title: r.a.name, id: r.a.id}, {url: r.b.page, title: r.b.name, id: r.b.id}]);
    return r;
  }
  if (!SCREEN_TOOLS.has(name)) throw Error('unknown tool');
  if (!st.screen) return {error: '展示屏不可用，直接讲解即可。'};
  if (name === 'page_control') return st.screen.control(String(args.action || ''));
  if (name === 'open_page') {
    const t = await resolveTarget(st, args.target);
    setFocus(st, t.item);
    return {screen: openOnScreen(st, [t]), item: t.item, title: t.title};
  }
  if (name === 'switch_project') {
    let id = clipArg(args.to, 80);
    if (!id && args.direction === 'previous') id = st.focus.previous?.id;
    if (!id) {
      const list = st.list || [];
      if (!list.length) return {error: '还没有可以换的项目。先问访客想看哪方面的，再用 gd_search 找。'};
      const i = list.findIndex(p => p.id === st.focus.current?.id);
      id = list[(i + 1) % list.length].id;
    }
    if (!id) return {error: '没有上一个项目。'};
    const t = await resolveTarget(st, id);
    setFocus(st, t.item);
    return {screen: openOnScreen(st, [t]), item: t.item, title: t.title, position: st.list.length ? `${st.list.findIndex(p => p.id === t.id) + 1}/${st.list.length}` : undefined};
  }
}

// 翻页笔/键盘：展示屏打开时，上下键翻页，左右键换项目，Esc 关闭。输入框里不拦截。
export function bindClicker(st, onChange = () => {}) {
  addEventListener('keydown', async e => {
    if (!st.screen?.isOpen || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
    const scroll = {PageDown: 'scroll_down', ArrowDown: 'scroll_down', PageUp: 'scroll_up', ArrowUp: 'scroll_up', Home: 'top'}[e.key];
    try {
      if (scroll) { e.preventDefault(); st.screen.control(scroll); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const r = await gdHandle('switch_project', {direction: e.key === 'ArrowRight' ? 'next' : 'previous'}, st); onChange(r); }
      else if (e.key === 'Escape' || e.key === 'b' || e.key === '.') { st.screen.close(); onChange({closed: true}); }
    } catch (err) { onChange({error: err.message}); }
  });
}

// 第一阶段接口，保留给测试用
export async function gdCall(name, args, focus = {}) {
  const st = {focus: {current: focus.current || null, previous: focus.previous || null}, list: [], screen: null, base: ''};
  return JSON.stringify(await gdHandle(name, args, st));
}

// 本地知识包：public/assets/packs/index.json 列出的 local 包会并入实验室知识检索。
// 每个包的 pages.json 与 lab-knowledge/knowledge.json 同一格式（pages、images）。
export async function loadPacks(knowledge) {
  let index;
  try { const r = await fetch('./assets/packs/index.json'); if (!r.ok) return []; index = await r.json(); } catch { return []; }
  const loaded = [];
  for (const pack of index.packs || []) {
    if (pack.kind !== 'local' || pack.enabled === false || !/^[a-z0-9-]+$/.test(pack.id || '')) { loaded.push(pack); continue; }
    try {
      const base = `./assets/packs/${pack.id}/`;
      const data = await (await fetch(base + 'pages.json')).json();
      for (const p of data.pages || []) knowledge.pages.push({...p, id: pack.id + ':' + p.id, title: `${pack.name}｜${p.title}`, path: `${pack.name} / ${p.path || p.title}`, images: p.images || []});
      for (const i of data.images || []) knowledge.images.push({...i, url: i.url && !/^(https?:|\/|\.\/assets\/)/.test(i.url) ? base + i.url.replace(/^\.\//, '') : i.url});
      loaded.push({...pack, pages: (data.pages || []).length});
    } catch { loaded.push({...pack, error: true}); }
  }
  return loaded;
}
