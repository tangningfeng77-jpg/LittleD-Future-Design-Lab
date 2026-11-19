// 三维展厅（第五轮）：把照片背景换成可走动的圆形展厅。四面弧形展墙对应节目单的四个频道，
// 每个节目是墙上的一张展板；开讲时小D 走到展板前，镜头跟随；来宾可拖动视角、点展板开讲。
// 网址加 ?space=photo 可回到原来的照片背景。
import * as THREE from 'three';

const C = new THREE.Vector3(0, 0, 0);
const HOME = new THREE.Vector3(0, 0, 1.82);
const R_WALL = 7.2;
const ZONE_ANGLE = {lab: -57, gov: -19, enterprise: 19, methods: 57};
const deg = d => d * Math.PI / 180;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const shortest = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return {texture: t, canvas: c};
}
const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif';
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, x, y, maxW, lineH, maxLines) {
  const chars = [...String(text)], lines = [];
  let line = '';
  for (const ch of chars) { if (g.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch; }
  if (line) lines.push(line);
  if (lines.length > maxLines) { let last = lines[maxLines - 1]; while (g.measureText(last + '…').width > maxW && last) last = last.slice(0, -1); lines.length = maxLines; lines[maxLines - 1] = last + '…'; }
  lines.forEach((l, i) => g.fillText(l, x, y + i * lineH));
}

export class Hall {
  constructor(studio, guide) {
    this.s = studio; this.guide = guide;
    this.group = new THREE.Group(); this.group.name = '小D 三维展厅';
    this.panels = []; this.active = null; this.walking = null; this.follow = null;
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
  }

  build() {
    const g = this.group;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(10, 120), new THREE.MeshStandardMaterial({color: 0xeef3f7, roughness: .26, metalness: .06}));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    const glow = (color, opacity = .85) => new THREE.MeshBasicMaterial({color, transparent: true, opacity, toneMapped: false});
    for (const [r, o] of [[2.4, .55], [4.3, .4], [9.7, .7]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .012, 6, 180), glow(0x8fe3ff, o)); ring.rotation.x = Math.PI / 2; ring.position.y = .004; g.add(ring); }
    this.homeRing = new THREE.Mesh(new THREE.TorusGeometry(.72, .016, 6, 96), glow(0x9ceeff, .9)); this.homeRing.rotation.x = Math.PI / 2; this.homeRing.position.set(HOME.x, .006, HOME.z); g.add(this.homeRing);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 6.4, 120, 1, true), new THREE.MeshStandardMaterial({color: 0xf3f7fa, roughness: .9, side: THREE.BackSide}));
    wall.position.y = 3.2; g.add(wall);
    for (let i = 0; i < 36; i++) { const a = deg(i * 10); const strip = new THREE.Mesh(new THREE.BoxGeometry(.035, 5.2, .02), glow(0xcdeffc, .55)); strip.position.set(Math.sin(a) * 9.93, 3, -Math.cos(a) * 9.93); strip.rotation.y = -a; g.add(strip); }
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(10, 96), new THREE.MeshStandardMaterial({color: 0xf6f9fb, roughness: 1, side: THREE.DoubleSide})); ceil.rotation.x = Math.PI / 2; ceil.position.y = 6.4; g.add(ceil);
    for (const r of [2.6, 5.2, 7.8]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .03, 6, 160), glow(0xe8fbff, .95)); ring.rotation.x = Math.PI / 2; ring.position.y = 6.35; g.add(ring); }
    // 后墙标识
    const sign = canvasTexture(2048, 640, (x, w) => {
      x.textAlign = 'center'; x.fillStyle = '#164e7d'; x.font = `700 170px ${FONT}`; x.fillText('未来设计实验室', w / 2, 230);
      x.fillStyle = '#355f81'; x.font = '600 64px Arial, sans-serif'; x.fillText('F U T U R E   D E S I G N   L A B', w / 2, 360);
      x.fillStyle = '#3f9fc0'; x.font = `500 60px ${FONT}`; x.fillText('好设计馆 · 小D 展厅', w / 2, 500);
    });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.75), new THREE.MeshBasicMaterial({map: sign.texture, transparent: true, toneMapped: false}));
    signMesh.position.set(0, 4.35, -9.85); g.add(signMesh);
    // 四面展墙
    for (const ch of this.guide.channels) this.buildZone(ch);
    this.s.scene.add(g);
  }

  buildZone(ch) {
    const center = deg(ZONE_ANGLE[ch.id] ?? 0), span = deg(37);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R_WALL + .06, R_WALL + .06, 3.3, 48, 1, true, Math.PI - center - span / 2, span), new THREE.MeshStandardMaterial({color: 0xfbfdff, roughness: .7, side: THREE.DoubleSide}));
    wall.position.y = 1.95; this.group.add(wall);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(R_WALL + .02, R_WALL + .02, .03, 48, 1, true, Math.PI - center - span / 2, span), new THREE.MeshBasicMaterial({color: 0x8fe3ff, toneMapped: false, side: THREE.DoubleSide}));
    base.position.y = .22; this.group.add(base);
    const title = canvasTexture(1024, 160, (x, w, h) => { x.textAlign = 'center'; x.fillStyle = '#153d58'; x.font = `600 84px ${FONT}`; x.fillText(ch.name.replace(/^好设计 · /, '好设计 · '), w / 2, 112); });
    const tMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .4), new THREE.MeshBasicMaterial({map: title.texture, transparent: true, toneMapped: false}));
    const tPos = new THREE.Vector3(Math.sin(center) * (R_WALL - .04), 3.28, -Math.cos(center) * (R_WALL - .04)); tMesh.position.copy(tPos); tMesh.lookAt(C.x, 3.28, C.z); this.group.add(tMesh);
    const cols = 4, step = 1.04 / (R_WALL - .05);   // 展板宽 0.95 m，间隔约 0.09 m
    ch.items.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const a = center + (col - (cols - 1) / 2) * step, y = [2.62, 1.86, 1.10][row] ?? 1.10;
      const pos = new THREE.Vector3(Math.sin(a) * (R_WALL - .05), y, -Math.cos(a) * (R_WALL - .05));
      const tex = canvasTexture(512, 340, () => {}); this.drawPanel(tex, it);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.95, .63), new THREE.MeshBasicMaterial({map: tex.texture, toneMapped: false}));
      mesh.position.copy(pos); mesh.lookAt(C.x, y, C.z); mesh.userData.item = it;
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.03, .71), new THREE.MeshBasicMaterial({color: 0x5bd6f5, transparent: true, opacity: 0, toneMapped: false}));
      frame.position.copy(pos).addScaledVector(pos.clone().setY(0).normalize(), .01); frame.lookAt(C.x, y, C.z);
      this.group.add(frame, mesh);
      // 小D 站在展板右前方，不挡住展板
      const standA = a + deg(4.2), stand = new THREE.Vector3(Math.sin(standA) * (R_WALL - 1.5), 0, -Math.cos(standA) * (R_WALL - 1.5));
      this.panels.push({item: it, mesh, frame, tex, stand, look: pos});
    });
  }

  drawPanel(tex, it, img) {
    const g = tex.canvas.getContext('2d'), w = 512, h = 340;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; roundRect(g, 0, 0, w, h, 26); g.fill();
    g.save(); roundRect(g, 14, 14, w - 28, 210, 18); g.clip();
    g.fillStyle = '#e9f3f7'; g.fillRect(14, 14, w - 28, 210);
    if (img) {
      const art = it.kind === 'lab-scene' || it.kind === 'lab-project';
      const s = art ? Math.min((w - 28) / img.width, 210 / img.height) : Math.max((w - 28) / img.width, 210 / img.height);
      const iw = img.width * s, ih = img.height * s; g.drawImage(img, 14 + (w - 28 - iw) / 2, 14 + (210 - ih) / 2, iw, ih);
    } else { g.fillStyle = '#9cc0cf'; g.font = `600 64px ${FONT}`; g.textAlign = 'center'; g.fillText(it.kind === 'gd-intro' ? '导览' : it.title.replace(/[^一-龥A-Za-z0-9]/g, '').slice(0, 3), w / 2, 140); }
    g.restore();
    g.fillStyle = '#153d58'; roundRect(g, 24, 24, 58, 50, 12); g.fill();
    g.fillStyle = '#e8fbff'; g.font = '700 34px "DIN Alternate", Arial, sans-serif'; g.textAlign = 'center'; g.fillText(String(it.no), 53, 61);
    g.textAlign = 'left'; g.fillStyle = '#153d58'; g.font = `600 34px ${FONT}`; wrap(g, it.title, 24, 268, w - 48, 40, 2);
    if (it.award) { g.fillStyle = '#5a8aa0'; g.font = `400 22px ${FONT}`; g.fillText(it.award, 24, 326); }
    tex.texture.needsUpdate = true;
    if (!img) {
      const src = this.guide.image(it);
      if (src) { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => this.drawPanel(tex, it, im); im.src = src; }
    }
  }

  enable() {
    const {scene, controls, robot} = this.s;
    for (const name of ['Photo room · projected depth surfaces', 'Sharp architectural lettering · 未来设计实验室', 'Raised sign edge']) { const o = scene.getObjectByName(name); if (o) o.visible = false; }
    scene.background = new THREE.Color(0xe9f0f6);
    scene.fog = new THREE.Fog(0xe9f0f6, 13, 30);
    controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = deg(58); controls.maxPolarAngle = deg(86);
    controls.minDistance = 2.4; controls.maxDistance = 9;
    controls.enablePan = false;
    robot.position.copy(HOME); robot.rotation.y = 0;
    this.frameRobot(true);
    this.loop();
    window.gdHall = this;
  }

  // 镜头对准小D：从展厅中心方向看过去，略高
  cameraFor(pos) {
    const toC = new THREE.Vector3(C.x - pos.x, 0, C.z - pos.z);
    const home = pos.distanceTo(HOME) < .3, dir = home ? new THREE.Vector3(0, 0, 1) : toC.normalize();
    // 在中间时拉远一些，让四面展墙都进入画面；走到展板前时近一些
    const target = pos.clone().add(new THREE.Vector3(0, home ? 1.35 : 1.05, 0));
    const cam = target.clone().addScaledVector(dir, home ? 6.6 : 6.2).add(new THREE.Vector3(0, home ? .7 : .8, 0));
    if (cam.length() > 9.2) cam.setLength(9.2);
    return {target, cam};
  }

  frameRobot(instant = false) {
    const {camera, controls, robot} = this.s, f = this.cameraFor(robot.position);
    if (instant) { controls.target.copy(f.target); camera.position.copy(f.cam); controls.update(); }
    else this.follow = {...f, until: performance.now() + 1600};
  }

  highlight(panel) {
    for (const p of this.panels) p.frame.material.opacity = 0;
    this.active = panel || null;
  }

  panelFor(it) { return this.panels.find(p => p.item.key === it.key) || null; }

  // 走到某个位置：先转身，再行走，到达后面向来宾
  walk(to, {face} = {}) {
    const {robot, play} = this.s;
    if (this.walking) this.walking.resolve(false);
    return new Promise(resolve => {
      const from = robot.position.clone(), dist = from.distanceTo(to);
      if (dist < .05) { this.turnTo(face); resolve(true); return; }
      this.walking = {to: to.clone(), heading: angleTo(from, to), face, resolve, started: false};
      play?.('walk');
    });
  }

  turnTo(face) {
    if (!face) return;
    this.turning = {heading: angleTo(this.s.robot.position, face)};
  }

  async walkToItem(it) {
    const p = this.panelFor(it);
    if (!p) return false;
    this.highlight(p);
    const done = await this.walk(p.stand, {face: this.s.camera.position.clone()});
    return done;
  }

  async walkHome() { this.highlight(null); return this.walk(HOME, {face: new THREE.Vector3(0, 0, 10)}); }

  pick(clientX, clientY) {
    const {camera, renderer} = this.s, rect = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(v, camera);
    const hit = this.raycaster.intersectObjects(this.panels.map(p => p.mesh), false)[0];
    return hit?.object.userData.item || null;
  }

  loop() {
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(.25, this.clock.getDelta()),   // 按真实时间走，帧率低时也不会变慢
       {robot, camera, controls, contact, play} = this.s;
      const t = performance.now() / 1000;
      if (this.active) this.active.frame.material.opacity = .55 + .35 * Math.sin(t * 3.2);
      this.homeRing.material.opacity = .55 + .3 * Math.sin(t * 1.6);
      const w = this.walking;
      if (w) {
        const d = shortest(robot.rotation.y, w.heading);
        robot.rotation.y += d * (1 - Math.exp(-dt * 9));
        if (Math.abs(d) < .35) {
          const step = 1.4 * dt, rest = new THREE.Vector3().subVectors(w.to, robot.position).setY(0), len = rest.length();
          if (len <= step) {
            robot.position.copy(w.to); this.walking = null; play?.('Idle'); this.turnTo(w.face); this.frameRobot(); w.resolve(true);
          } else robot.position.addScaledVector(rest.normalize(), step);
        }
        const f = this.cameraFor(robot.position); this.follow = {...f, until: performance.now() + 1400};
      } else if (this.turning) {
        const d = shortest(robot.rotation.y, this.turning.heading);
        robot.rotation.y += d * (1 - Math.exp(-dt * 6));
        if (Math.abs(d) < .01) this.turning = null;
      }
      if (contact) { contact.position.x = robot.position.x; contact.position.z = robot.position.z; }
      if (this.follow) {
        controls.target.x = damp(controls.target.x, this.follow.target.x, 3, dt); controls.target.y = damp(controls.target.y, this.follow.target.y, 3, dt); controls.target.z = damp(controls.target.z, this.follow.target.z, 3, dt);
        camera.position.x = damp(camera.position.x, this.follow.cam.x, 2.4, dt); camera.position.y = damp(camera.position.y, this.follow.cam.y, 2.4, dt); camera.position.z = damp(camera.position.z, this.follow.cam.z, 2.4, dt);
        if (performance.now() > this.follow.until) this.follow = null;
      }
      if (camera.position.length() > 9.4) camera.position.setLength(9.4);
    };
    tick();
  }
}
