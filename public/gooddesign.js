// 好设计知识接入（第一阶段）：工具定义、调用本机 /api/gd、本地知识包加载。
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
    parameters: {type: 'object', properties: {a: {type: 'string', description: '项目编号；可省略，默认当前项目'}, b: {type: 'string', description: '项目编号；可省略，默认上一个项目'}}}}}
];
export const GD_NAMES = new Set(GD_TOOLS.map(t => t.function.name));

export const GD_INSTRUCTIONS = '你还能查阅好设计馆：一个收录历届中国好设计获奖项目（数百个）和 64 种设计方法的设计知识平台。访客问到实验室资料以外的设计项目、某个行业的优秀设计、某件事的设计方法，或主动提到“好设计”时，调用 gd_search，再按需 gd_read；问两个项目的关系时调用 gd_relate。讲好设计馆的内容时可以自然说一句“好设计馆里收录了……”，项目要说出名称、获奖年份和奖项，用一两个具体细节讲清它解决什么问题；不要读编号和网址。好设计馆里没找到时照实说，再回到实验室能讲的内容。';

const clipArg = (v, n = 80) => String(v || '').trim().slice(0, n);

// 返回给模型的 JSON 字符串
export async function gdCall(name, args, focus = {}) {
  const q = new URLSearchParams();
  if (name === 'gd_search') {
    q.set('op', 'search'); q.set('q', clipArg(args.query));
    if (['project', 'method'].includes(args.kind)) q.set('kind', args.kind);
  } else if (name === 'gd_read') {
    q.set('op', 'read'); q.set('id', clipArg(args.id, 40));
  } else if (name === 'gd_relate') {
    const a = clipArg(args.a, 40) || focus.current?.id, b = clipArg(args.b, 40) || (a === focus.current?.id ? focus.previous?.id : focus.current?.id);
    if (!a || !b || a === b) return JSON.stringify({error: '需要两个不同的项目。先请访客说出要比较的两个项目，或先用 gd_search 找到它们。'});
    q.set('op', 'relate'); q.set('a', a); q.set('b', b);
  } else throw Error('unknown tool');
  const response = await fetch('/api/gd?' + q, {signal: AbortSignal.timeout(20000)});
  return JSON.stringify(await response.json());
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
