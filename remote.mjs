// 讲解员手机遥控（第五轮）：屏幕用四位遥控码订阅事件流，手机发命令，按遥控码转发。
// GET  api/remote/events?code=1234   屏幕订阅（Server-Sent Events）
// POST api/remote/cmd   {code, cmd, arg}   手机发命令
// POST api/remote/state {code, state}      屏幕上报当前状态
// GET  api/remote/state?code=1234          手机读取状态（节目单、正在播放）
const CMDS = new Set(['stop', 'toggle', 'next', 'prev', 'restart', 'guide', 'channel', 'play', 'tour', 'welcome', 'idle', 'say', 'help', 'close', 'home', 'nextpart', 'ask', 'closing', 'bridge', 'mic']);
const screens = new Map();   // code → Set(res)
const states = new Map();    // code → {state, at}
const hits = new Map();      // ip → [times]

function limited(ip, max = 30) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 10000);
  list.push(now); hits.set(ip, list);
  return list.length > max;
}
const readBody = req => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > 32768) { reject(Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
  req.on('error', reject);
});
const send = (res, code, obj) => { res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(obj)); };

export async function handleRemote(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const op = u.pathname.replace(/^\/api\/remote\//, '');
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || '';
  if (limited(ip, op === 'events' ? 10 : 40)) return send(res, 429, {error: '操作太频繁'});
  if (op === 'events' && req.method === 'GET') {
    const code = u.searchParams.get('code');
    if (!/^\d{4}$/.test(code || '')) return send(res, 400, {error: 'code'});
    res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive'});
    res.write(': connected\n\n');
    if (!screens.has(code)) screens.set(code, new Set());
    screens.get(code).add(res);
    const beat = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(beat); screens.get(code)?.delete(res); if (!screens.get(code)?.size) screens.delete(code); });
    return;
  }
  if (op === 'cmd' && req.method === 'POST') {
    let b; try { b = await readBody(req); } catch { return send(res, 400, {error: 'body'}); }
    if (!/^\d{4}$/.test(b.code || '') || !CMDS.has(b.cmd)) return send(res, 400, {error: '遥控码或命令不对'});
    const arg = typeof b.arg === 'string' ? b.arg.slice(0, 300) : b.arg && typeof b.arg === 'object' ? JSON.parse(JSON.stringify(b.arg).slice(0, 600)) : undefined;
    const set = screens.get(b.code);
    if (!set?.size) return send(res, 404, {error: '没有找到这块屏幕，请核对遥控码，确认小D 页面已打开'});
    for (const r of set) r.write(`data: ${JSON.stringify({cmd: b.cmd, arg})}\n\n`);
    return send(res, 200, {ok: true, screens: set.size});
  }
  if (op === 'state' && req.method === 'POST') {
    let b; try { b = await readBody(req); } catch { return send(res, 400, {error: 'body'}); }
    if (!/^\d{4}$/.test(b.code || '')) return send(res, 400, {error: 'code'});
    states.set(b.code, {state: b.state, at: Date.now()});
    return send(res, 200, {ok: true});
  }
  if (op === 'state' && req.method === 'GET') {
    const code = u.searchParams.get('code');
    if (!/^\d{4}$/.test(code || '')) return send(res, 400, {error: 'code'});
    const s = states.get(code);
    return send(res, 200, {online: !!screens.get(code)?.size, state: s?.state || null, at: s?.at || 0});
  }
  return send(res, 404, {error: 'unknown'});
}
