// 对话条（第九轮）：屏幕底部一条，让来宾随时知道小D 在干什么、听到了什么、现场吵不吵。
// - 状态：等你说话 / 在听 / 想一想 / 小D 在说（点一下打断）/ 现场太吵，按住说话
// - 音量条：实时音量和当前“算作说话”的门槛，来宾能看出环境声有没有被当成说话
// - “我听到：……”：识别结果直接显示，听错了一眼就知道
// - 按住说话、打字：嘈杂现场或不方便说话时用
// - 自动降噪：环境声持续偏大或频繁误触发时，先提高门槛；再吵就自动改成“按住说话”，安静下来自动恢复
// 讲解员用遥控器手动设置过收音方式时，不再自动切换。

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const BARS = 12;
const NOISY = .025, TOO_LOUD = .05, QUIET = .015;   // 环境底噪（RMS）

export class TalkBar {
  constructor(tour) {
    this.tour = tour; this.v = tour.voice;
    this.auto = {noisySince: 0, loudSince: 0, quietSince: 0, holdOnly: false, raised: false, empties: []};
    this.mount();
    this.timer = setInterval(() => this.tick(), 120);
  }

  mount() {
    const root = this.root = el('div', 'gd-talk'); root.setAttribute('role', 'status');
    this.dot = el('span', 'gd-talk-dot');
    this.label = el('span', 'gd-talk-label', '等你说话');
    this.meter = el('span', 'gd-talk-meter'); this.meter.setAttribute('aria-hidden', 'true');
    this.bars = Array.from({length: BARS}, () => this.meter.appendChild(el('i')));
    this.mark = this.meter.appendChild(el('b'));
    this.heard = el('span', 'gd-talk-heard');
    this.hold = el('button', 'gd-talk-hold', '按住说话'); this.hold.type = 'button';
    this.typeBtn = el('button', 'gd-talk-type', '打字'); this.typeBtn.type = 'button';
    this.form = el('form', 'gd-talk-form'); this.form.hidden = true;
    this.input = el('input'); this.input.placeholder = '输入想问小D 的话，回车发送'; this.input.maxLength = 120;
    this.form.append(this.input);
    const main = el('div', 'gd-talk-main'); main.append(this.dot, this.label, this.meter, this.heard);
    root.append(main, this.hold, this.typeBtn, this.form);
    document.querySelector('.viewport')?.append(root);

    // 小D 在说时点状态条 = 打断
    // 想太久时点一下 = 放弃这一轮，可以重新问
    main.onclick = () => {
      if (this.tour.resumeWaiting || this.tour.resuming) return;   // 从访谈回来，正在接上语音
      if (this.speaking()) this.tour.interruptAll();
      else if (this.state === 'think' && performance.now() - (this.thinkSince || 0) > 9000) { this.tour.interruptAll(); this.flash('好的，你可以重新问'); }
      else if (!this.v.ready || !this.v.awakened) this.v.respond('你好，小D');
    };
    // 按住说话：鼠标、触屏都可以；松开或手指滑出就发送
    const down = e => { e.preventDefault(); this.hold.setPointerCapture?.(e.pointerId); this.hold.classList.add('on'); this.v.begin?.(); };
    const up = () => { if (!this.hold.classList.contains('on')) return; this.hold.classList.remove('on'); this.v.end?.(); };
    this.hold.addEventListener('pointerdown', down);
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) this.hold.addEventListener(t, up);
    this.typeBtn.onclick = () => { this.form.hidden = !this.form.hidden; if (!this.form.hidden) this.input.focus(); };
    this.form.onsubmit = e => {
      e.preventDefault(); const text = this.input.value.trim(); if (!text) return;
      this.input.value = ''; this.form.hidden = true; this.tour.host?.touch();
      this.v.lastHeard = {text, at: performance.now(), typed: true};
      this.v.respond(text);
    };
  }

  speaking() { const v = this.v; return !!(v.replySpeechActive || v.sources?.size); }

  // 手动设置过（遥控器、地址参数）就不自动切换
  manual() { try { return this.tour.micManual || /[?&]noise=/.test(location.search) || localStorage.getItem('littled.noisy') != null; } catch { return !!this.tour.micManual; } }

  autoNoise(now) {
    const v = this.v, a = this.auto, box = document.getElementById('autoMic');
    if (!v.ready || this.manual() || v.ptt) return;
    const amb = v.ambient || 0;
    a.empties = a.empties.filter(t => now - t < 60000);
    if ((v.emptyHeard || 0) > (a.lastEmpty || 0)) { a.empties.push(now); a.lastEmpty = v.emptyHeard; }
    a.noisySince = amb > NOISY ? (a.noisySince || now) : 0;
    a.loudSince = amb > TOO_LOUD ? (a.loudSince || now) : 0;
    a.quietSince = amb < QUIET ? (a.quietSince || now) : 0;
    // 第一步：提高门槛
    if (!a.raised && (a.noisySince && now - a.noisySince > 6000 || a.empties.length >= 2)) {
      a.raised = true; v.noisyRoom = true; v.vad = null;
      this.flash('现场有点吵，小D 会更仔细地分辨你的声音');
    }
    // 第二步：太吵或频繁误触发 → 改成按住说话
    if (!a.holdOnly && box?.checked && (a.loudSince && now - a.loudSince > 6000 || a.empties.length >= 4)) {
      a.holdOnly = true; box.checked = false; v.autoTalking = false; v.update?.();
      this.flash('现场太吵了，请按住右边的按钮说话');
    }
    // 安静 20 秒后恢复
    if ((a.raised || a.holdOnly) && a.quietSince && now - a.quietSince > 20000) {
      if (a.holdOnly && box && !box.checked) { box.checked = true; v.update?.(); }
      if (a.raised) { v.noisyRoom = false; v.vad = null; }
      a.raised = a.holdOnly = false; a.empties = [];
      this.flash('现场安静下来了，直接说话就可以');
    }
  }

  flash(text) { this.flashText = text; this.flashUntil = performance.now() + 5000; }

  tick() {
    const v = this.v, now = performance.now(), box = document.getElementById('autoMic');
    this.autoNoise(Date.now());
    // 开场的“你好，小D”大按钮还在时，对话条先不出现，避免两个入口重复
    const wake = document.getElementById('wakePrompt');
    const hide = !!(wake && !wake.hidden && wake.offsetParent && getComputedStyle(wake).visibility !== 'hidden' && getComputedStyle(wake).opacity !== '0');
    if (hide !== this.root.hidden) this.root.hidden = hide;
    document.body.classList.toggle('gd-talk-on', !hide);
    if (hide) return;
    let state = 'idle', text = '等你说话';
    if (!v.ready) { state = 'off'; text = this.tour.resumeWaiting ? '欢迎回来 · 点一下屏幕，小D 接着陪你' : v.awakened ? '正在连接…' : '说“你好，小D”或点这里开始'; }
    else if (v.tour?.busy || v.tour?.state === 'video') { state = 'busy'; text = '正在播放介绍'; }
    else if (v.ptt) { state = 'listen'; text = '正在听，松开就发送'; }
    else if (this.speaking()) { state = 'speak'; text = '小D 在说 · 点这里打断'; }
    else if (v.autoTalking) { state = 'listen'; text = '在听…'; }
    else if (v.responseId || v.pendingTurn || v.awaitingTools) {
      // 想得久时说明在做什么，免得来宾以为卡住了
      state = 'think'; const waited = now - (this.thinkSince || now);
      text = v.pendingWeb ? (waited > 7000 ? '资料有点多，再等几秒…' : '在查好设计馆的资料…') : waited > 9000 ? '还在想，点这里可以重新问' : '想一想…';
    }
    else if (box && !box.checked) { state = 'hold'; text = this.auto.holdOnly ? '现场太吵 · 请按住右边按钮说话' : '按住右边按钮说话'; }
    if (this.flashUntil > now && (state === 'idle' || state === 'hold')) text = this.flashText;
    if (state !== this.state) { this.root.dataset.state = this.state = state; this.thinkSince = state === 'think' ? now : 0; }
    if (text !== this.text) this.label.textContent = this.text = text;
    this.root.classList.toggle('noisy', !!v.noisyRoom);
    this.hold.classList.toggle('hint', state === 'hold');

    // 音量条：对数刻度，门槛位置随环境变化
    const lv = Math.min(1, Math.max(0, (Math.log10((v.level || 0) + 1e-4) + 3) / 2.4));
    const n = Math.round(lv * BARS);
    this.bars.forEach((b, i) => b.classList.toggle('on', i < n));
    const floor = v.vad?.floor || .006, thr = Math.max(v.noisyRoom ? .02 : .012, floor * (v.noisyRoom ? 3.6 : 2.8) + .004);
    this.mark.style.left = (Math.min(1, Math.max(0, (Math.log10(thr) + 3) / 2.4)) * 100).toFixed(1) + '%';

    // 识别结果停留 7 秒
    const h = v.lastHeard;
    const heard = h && now - h.at < 7000 && h.text ? (h.typed ? '你输入：' : '我听到：') + h.text : '';
    if (heard !== this.heardText) { this.heard.textContent = this.heardText = heard; this.heard.classList.toggle('show', !!heard); }
  }
}
