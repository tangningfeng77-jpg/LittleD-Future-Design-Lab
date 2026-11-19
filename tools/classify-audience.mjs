// 把好设计馆的获奖项目分成“偏政府领导”和“偏企业”两类，供导览路线挑选。
// 用法（在本机服务目录下，需要 .env 里的百炼配置与 GD_DECK_MODEL）：
//   node tools/classify-audience.mjs public/assets/tour/audience.json
import fs from 'node:fs';
import {getCatalog, llmJSON} from '../gd-proxy.mjs';
const out = process.argv[2] || 'public/assets/tour/audience.json';
const cat = await getCatalog();
const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {items: {}};
const items = prev.items || {};
const todo = cat.filter(p => !items[p.id]);
console.log('total', cat.length, 'todo', todo.length);
for (let i = 0; i < todo.length; i += 30) {
  const batch = todo.slice(i, i + 30);
  const list = batch.map(p => `${p.id}｜${p.name}｜${p.unit}｜${String(p.summary || '').replace(/\s+/g, '').slice(0, 70)}`).join('\n');
  try {
    const j = await llmJSON(`下面是中国好设计获奖项目（编号｜名称｜单位｜简介）。展厅里来访的有两类领导：政府领导（关心国家战略与重大工程、基础设施、公共服务与民生、医疗卫生、乡村与农业、生态环保、区域产业升级）和企业领导（关心产品创新、制造与装备升级、用户体验与品牌、商业模式、可直接借鉴的设计方法）。
请判断每个项目更适合讲给哪一类，并给出代表性分数：3 = 非常适合作为这一类的展示案例，2 = 适合，1 = 一般。reason 不超过 16 个字，只根据给出的信息。
输出 JSON：{"items":[{"id":"","audience":"gov 或 enterprise","score":1,"reason":""}]}
${list}`);
    for (const x of j?.items || []) if (batch.some(p => p.id === x.id) && /^(gov|enterprise)$/.test(x.audience)) items[x.id] = {audience: x.audience, score: Math.max(1, Math.min(3, +x.score || 1)), reason: String(x.reason || '').slice(0, 20)};
    console.log('batch', i / 30 + 1, Object.keys(items).length);
  } catch (e) { console.log('batch fail', i, e.message); }
  fs.writeFileSync(out, JSON.stringify({version: 1, generated: new Date().toISOString().slice(0, 10), note: '由模型按项目名称与简介初分，供导览挑选；负责人可直接改 audience。', items}, null, 1));
}
const awardRank = {金奖: 0, 银奖: 1, 提名奖: 2, 创意奖: 3};
const byId = new Map(cat.map(p => [p.id, p]));
for (const a of ['gov', 'enterprise']) {
  const top = Object.entries(items).filter(([, v]) => v.audience === a).sort((x, y) => y[1].score - x[1].score || (awardRank[byId.get(x[0])?.award] ?? 9) - (awardRank[byId.get(y[0])?.award] ?? 9) || String(y[0]).localeCompare(String(x[0]))).slice(0, 12);
  console.log(a, Object.values(items).filter(v => v.audience === a).length, top.map(([id, v]) => `${id} ${byId.get(id)?.name?.slice(0, 12)}(${v.score})`).join(' | '));
}
