const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

export function classifyPose(landmarks, category, previous = 'neutral') {
  if (category?.categoryName === 'Closed_Fist' && category.score >= .5) return 'fist';
  const palm = Math.max(distance(landmarks[0], landmarks[9]), .001);
  const pinch = distance(landmarks[4], landmarks[8]) / palm;
  if (pinch < (previous === 'pinch' ? .43 : .28)) return 'pinch';
  if (category?.categoryName === 'Open_Palm' && category.score >= .5) return 'open';
  return 'neutral';
}

export class HandTracker {
  constructor() { this.tracks = []; this.nextId = 1; }
  update(result, now) {
    const available = this.tracks.filter(track => now - track.seen < 350);
    const hands = result.landmarks.map((points, index) => {
      const label = result.handedness[index]?.[0]?.categoryName || '';
      const matching = available.filter(track => distance(track.points[0], points[0]) < .3);
      matching.sort((a, b) => (distance(a.points[0], points[0]) + (a.label === label ? 0 : .1)) - (distance(b.points[0], points[0]) + (b.label === label ? 0 : .1)));
      const track = matching[0] || { id: this.nextId++, pose: 'neutral', candidate: 'neutral', since: now, points, seen: now };
      if (matching[0]) available.splice(available.indexOf(track), 1);
      if (now - track.seen > 150) { track.pose = 'neutral'; track.candidate = 'neutral'; track.since = now; }
      const pose = classifyPose(result.worldLandmarks[index] || points, result.gestures[index]?.[0], track.pose);
      if (pose !== track.candidate) { track.candidate = pose; track.since = now; }
      const hold = pose === 'pinch' ? 150 : pose === 'neutral' ? 100 : 220;
      if (now - track.since >= hold) track.pose = pose;
      track.points = points.map((point, i) => ({ x: track.points[i].x * .35 + point.x * .65, y: track.points[i].y * .35 + point.y * .65, z: point.z }));
      track.label = label;
      track.seen = now;
      return track;
    });
    this.tracks = [...hands, ...available];
    return hands;
  }
}

// Camera frames stay in memory and are transferred only to a same-origin worker.
// The camera video is detached from the DOM and is never composited on screen.
export class CameraHands {
  constructor(onHands, onStatus) {
    this.onHands = onHands;
    this.onStatus = onStatus;
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.running = false;
    this.starting = false;
    this.generation = 0;
  }

  async start() {
    if (this.running || this.starting) return;
    const generation = ++this.generation;
    this.starting = true;
    this.onStatus('loading', '正在等待摄像头连接与授权');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('secure-context');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { ...(this.selectedDeviceId?{deviceId:{exact:this.selectedDeviceId}}:{facingMode:'user'}), width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } }, audio: false });
      if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      const track=stream.getVideoTracks()[0];this.deviceName=track.label||'当前摄像头';this.deviceId=track.getSettings().deviceId||'';
      this.video.srcObject = stream;
      this.video.autoplay=true;
      if(!this.video.isConnected){Object.assign(this.video.style,{position:'fixed',width:'2px',height:'2px',opacity:'0',pointerEvents:'none'});this.video.setAttribute('aria-hidden','true');document.body.append(this.video);}
      await this.video.play();
      if (generation !== this.generation) return;
      this.onStatus('loading', '摄像头已连接 · 正在加载手势组件');
      this.worker = new Worker(new URL('./gesture-worker.mjs?v=loading-3', import.meta.url), { type: 'module' });
      await new Promise((resolve, reject) => {
        let timer;
        const finish = (error) => {
          clearTimeout(timer);
          this.cancelInitialization = null;
          error ? reject(error) : resolve();
        };
        const resetTimeout = () => {
          clearTimeout(timer);
          timer = setTimeout(() => finish(new Error('model-timeout')), 45000);
        };
        this.cancelInitialization = () => finish(new Error('cancelled'));
        resetTimeout();
        this.worker.onerror = event => finish(new Error(`model-load|${event.message || '识别线程无法启动'}`));
        this.worker.onmessage = ({ data }) => {
          if (data.type === 'progress') {
            resetTimeout();
            this.onStatus('loading', data.message, data.progress);
          } else if (data.type === 'ready') finish();
          else if (data.type === 'error') finish(new Error(data.message || 'model-load'));
        };
        this.worker.postMessage({ type: 'init' });
      });
      if (generation !== this.generation) return;
      this.tracker = new HandTracker();
      this.running = true;
      this.starting = false;
      this.busy = false;
      this.lastFrame = -1;
      this.lastSent = -Infinity;
      this.worker.onmessage = ({ data }) => {
        if(data.type!=='result'&&data.type!=='error')return;
        clearTimeout(this.frameTimeout);this.busy = false;
        if (data.type === 'error') { this.stop(); this.onStatus('error', '手势识别中断，请重新启用摄像头'); return; }
        if (!this.running || this.suspended || document.hidden) return;
        const now=performance.now(),hands=this.tracker.update(data.result,now);
        this.processedFrames=(this.processedFrames||0)+1;document.body.dataset.handFrames=String(this.processedFrames);document.body.dataset.handCount=String(hands.length);
        if(now-(this.lastReport||0)>1000){this.lastReport=now;this.onStatus('ready',hands.length?'已识别到 '+hands.length+' 只手':'摄像头与识别正常 · 请将手掌完整放入画面');}
        this.onHands(hands);
      };
      this.worker.onerror = () => { this.stop(); this.onStatus('error', '手势模型运行失败，请重新启用摄像头'); };
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (this.running) { this.stop(); this.onStatus('error', '摄像头连接已中断，请检查设备后重试'); }
      });
      this.onStatus('ready', '摄像头已开启 · 等待手部');
      this.frame(performance.now());
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop();
      const messages = {
        NotAllowedError: '请在浏览器中允许摄像头访问，再点击“启用摄像头”',
        NotFoundError: '未检测到摄像头，请连接摄像头后重试',
        NotReadableError: '摄像头被占用或无法读取，请关闭占用它的应用后重试',
        'secure-context': '请通过 HTTPS 网站或本地预览打开，以启用摄像头',
        'model-timeout': '手势组件已连续 45 秒无响应。请点击“启用摄像头”重试，已完成的下载会从本机缓存读取'
      };
      const [code, detail] = error.message.split('|');
      this.onStatus('error', messages[error.name] || messages[code] || (detail ? `手势加载失败 · ${detail}` : '手势初始化失败，请重新启用摄像头'));
    }
  }

  async selectDevice(deviceId){this.stop();this.selectedDeviceId=deviceId||'';return this.start();}

  async resume(){
    this.suspended=false;
    if(!this.running&&!this.starting)return this.start();
    if(this.video.srcObject&&this.video.paused)await this.video.play().catch(()=>{});
    if(this.running){clearTimeout(this.animation);this.frame(performance.now());}
  }
  async frame(now) {
    if (!this.running) return;
    clearTimeout(this.animation);this.animation=setTimeout(()=>this.frame(performance.now()),65);
    if (this.suspended || document.hidden || this.busy || now - this.lastSent < 65 || this.video.readyState < 2 || this.video.currentTime === this.lastFrame) return;
    this.busy = true;
    this.lastFrame = this.video.currentTime;
    this.lastSent = now;
    const generation = this.generation;
    try {
      const bitmap = await createImageBitmap(this.video);
      if (generation !== this.generation || !this.running) { bitmap.close(); return; }
      this.frameTimeout=setTimeout(()=>{if(generation===this.generation){this.stop();this.onStatus('error','手势识别超时，请在右侧设备栏重新连接摄像头');}},6000);
      this.worker.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
    } catch {
      if (generation !== this.generation) return;
      this.stop();
      this.onStatus('error', '无法读取摄像头帧，请重新启用摄像头');
    }
  }

  stop() {
    this.generation++;
    this.running = false;
    this.starting = false;
    this.cancelInitialization?.();
    clearTimeout(this.animation);clearTimeout(this.frameTimeout);
    this.worker?.terminate();
    this.stream?.getTracks().forEach(track => track.stop());
    this.video.srcObject = null;
    this.onHands([]);
    this.onStatus('paused', '摄像头已关闭');
  }
}
