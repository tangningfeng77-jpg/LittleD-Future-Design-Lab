// 三维展厅（第七轮重做）：按实验室 2D 效果图搭建的室内空间——中央白色主墙与“未来设计实验室”标识、
// 顶部圆形科技屏与白色光环、地面发光圆环、左右斜墙展示屏与标语、展台与模型、主墙后的展廊。
// 全部用基础几何体与画布贴图在浏览器里生成，不下载模型文件；地面倒影用镜像几何体代替二次渲染。
// 讲节目时“氛围”随之变化：穹顶内容与流速、强调色、整体亮度、小D 头顶的追光；左右展示屏显示当前幻灯片配图。
// 网址加 ?space=photo 可回到原来的照片背景。
import * as THREE from 'three';

const HOME = new THREE.Vector3(0, 0, 1.4);
const STATION = {left: new THREE.Vector3(-2.7, 0, 1.0), right: new THREE.Vector3(2.7, 0, 1.0)};
const THEMES = {   // 频道氛围：强调色、穹顶流速、整体亮度
  idle: {accent: 0x5fb8ff, flow: .35, exposure: .98},
  lab: {accent: 0x4fa8ff, flow: .5, exposure: .96},
  gov: {accent: 0x3f6dff, flow: .55, exposure: .94},
  enterprise: {accent: 0x26bfae, flow: .55, exposure: .94},
  methods: {accent: 0x8a7dff, flow: .5, exposure: .94},
  present: {exposure: .8}
};
const deg = d => d * Math.PI / 180;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const shortest = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw?.(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return {t, c, g};
}
function cover(g, img, x, y, w, h) { const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s; g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({color, transparent: opacity < 1, opacity, toneMapped: false});

// 穹顶科技屏：径向光线、同心环、流动光点；颜色与流速随氛围变化（片元着色器，无贴图）
const DOME_FRAG = `uniform float uTime;uniform float uFlow;uniform vec3 uAccent;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 p=vUv*2.-1.;float r=length(p);if(r>1.)discard;float a=atan(p.y,p.x);
 float t=uTime*uFlow;
 float rings=smoothstep(.02,0.,abs(fract(r*7.-t*.6)-.5)-.47)*.55;
 float rays=pow(abs(sin(a*18.+t*.4)),40.)*smoothstep(1.,.15,r)*.6;
 float grid=smoothstep(.015,0.,abs(fract(a*12./6.2832+.5)-.5)-.48)*smoothstep(.95,.3,r)*.25;
 vec2 cell=floor(vec2(a*20.,r*14.-t*1.5));float spark=step(.93,hash(cell))*smoothstep(.0,.3,fract(r*14.-t*1.5))*.9;
 float core=smoothstep(.35,0.,r)*.9;
 vec3 deep=vec3(.02,.11,.32);vec3 col=deep+uAccent*(rings+rays+grid+spark)+vec3(.7,.9,1.)*core;
 col*=smoothstep(1.,.92,r)*.95+.05;gl_FragColor=vec4(col,1.);}`;
const DOME_VERT = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

// 墙面渐变贴图：上亮下略灰蓝，让白墙有体积感（一张 4×256 的小图）
let wallTex = null;
function wallMap() {
  if (wallTex) return wallTex;
  wallTex = canvasTex(4, 256, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.55, '#f3f6fa'); gr.addColorStop(1, '#dfe6ef'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }).t;
  return wallTex;
}

export class Hall {
  constructor(studio, guide) {
    this.s = studio; this.guide = guide;
    this.group = new THREE.Group(); this.group.name = '小D 展厅（按 2D 效果图）';
    this.arch = new THREE.Group();      // 需要倒影的建筑部分
    this.accentMats = [];               // 随氛围变色的发光材质
    this.walking = null; this.turning = null; this.follow = null;
    this.theme = 'idle'; this.presenting = false;
    this.accent = new THREE.Color(THEMES.idle.accent); this.flow = THEMES.idle.flow;
    this.raycaster = new THREE.Raycaster(); this.clock = new THREE.Clock();
    this.clickables = [];
  }

  // ---------- 搭建 ----------
  build() {
    const g = this.group, A = this.arch;
    g.add(A);
    // 地面：半透明亮面，透出下方的镜像建筑，形成倒影
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshStandardMaterial({color: 0xeef2f6, roughness: .2, metalness: .04, transparent: true, opacity: .74}));
    floor.rotation.x = -Math.PI / 2; floor.renderOrder = 1; g.add(floor);
    // 地面发光圆环（效果图前景的大圆环）
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.15, 3.27, 160), glowMat(0xe2f5ff)); ring.rotation.x = -Math.PI / 2; ring.position.set(HOME.x, .012, HOME.z); g.add(ring);
    const halo = canvasTex(256, 256, (x, w) => { const gr = x.createRadialGradient(w / 2, w / 2, w * .36, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(120,200,255,0)'); gr.addColorStop(.78, 'rgba(120,200,255,.55)'); gr.addColorStop(1, 'rgba(120,200,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, w); });
    this.ringGlowMat = new THREE.MeshBasicMaterial({map: halo.t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: this.accent.clone()});
    const ringGlow = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4), this.ringGlowMat); ringGlow.rotation.x = -Math.PI / 2; ringGlow.position.set(HOME.x, .014, HOME.z); g.add(ringGlow);
    this.accentMats.push(this.ringGlowMat);

    this.buildMonolith(A);
    this.buildWings(A);
    this.buildBackHall(A);
    this.buildCeiling(g);
    this.buildFurniture(A);
    this.buildSpotlight(g);

    // 地面倒影：建筑镜像放在地面以下
    const mirror = A.clone(true); mirror.scale.y = -1; mirror.position.y = -.02;
    mirror.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = (o.material.opacity ?? 1) * .7; o.material.depthWrite = false; o.material.side = THREE.DoubleSide; } });
    mirror.renderOrder = 0; g.add(mirror);
    this.s.scene.add(g);
  }

  // 中央主墙：白色厚墙 + 标识 + 两侧斜向光刃 + 边缘光
  buildMonolith(A) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.7, .4), new THREE.MeshStandardMaterial({color: 0xffffff, map: wallMap(), roughness: .55}));
    wall.position.set(0, 2.35, -2.6); A.add(wall);
    const sign = canvasTex(2048, 640, (x, w) => {
      x.textAlign = 'center';
      x.font = `700 196px ${FONT}`;
      // 立体蓝色字：白色辉光托底 + 轻微下投影，远看清楚，贴近效果图的发光标识
      x.shadowColor = 'rgba(255,255,255,.95)'; x.shadowBlur = 30; x.fillStyle = '#ffffff'; x.fillText('未来设计实验室', w / 2, 300);
      x.shadowColor = 'rgba(20,60,120,.35)'; x.shadowBlur = 10; x.shadowOffsetY = 6;
      const tg = x.createLinearGradient(0, 120, 0, 320); tg.addColorStop(0, '#4f8fd6'); tg.addColorStop(1, '#1f5a9e'); x.fillStyle = tg; x.fillText('未来设计实验室', w / 2, 300);
      x.shadowOffsetY = 0;
      x.shadowBlur = 0; x.fillStyle = '#c6d6e6'; x.fillRect(w / 2 - 760, 418, 220, 4); x.fillRect(w / 2 + 540, 418, 220, 4);
      x.fillStyle = '#4f6f8f'; x.font = '600 74px Arial, sans-serif'; x.fillText('F U T U R E   D E S I G N   L A B', w / 2, 444);
    });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 1.53), new THREE.MeshBasicMaterial({map: sign.t, transparent: true, toneMapped: false}));
    signMesh.position.set(0, 2.7, -2.39); A.add(signMesh);
    for (const sx of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.1, .06), glowMat(0xcfeeff)); blade.position.set(sx * 2.55, .95, -2.38); blade.rotation.z = sx * deg(38); A.add(blade);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(.035, 4.6, .035), glowMat(0xe8f7ff)); edge.position.set(sx * 3.2, 2.35, -2.38); A.add(edge);
      this.accentMats.push(blade.material);
    }
  }

  // 左右斜墙：标语 + 大屏 / 三块展示屏 + 蓝色发光边
  buildWings(A) {
    const mk = (side) => {
      const grp = new THREE.Group(); grp.position.set(side * 5.9, 0, -.7); grp.rotation.y = -side * deg(30);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 4.6, .3), new THREE.MeshStandardMaterial({color: 0xffffff, map: wallMap(), roughness: .6})); wall.position.y = 2.3; grp.add(wall);
      const trim = glowMat(0x7fc8ff); this.accentMats.push(trim);
      const inner = side < 0 ? 3.05 : -3.05;
      const v = new THREE.Mesh(new THREE.BoxGeometry(.05, 4.5, .05), trim); v.position.set(inner, 2.3, .17); grp.add(v);
      const h = new THREE.Mesh(new THREE.BoxGeometry(6.1, .05, .05), trim); h.position.set(0, 4.55, .17); grp.add(h);
      const slogan = canvasTex(1024, 512, (x) => {
        if (side < 0) { x.fillStyle = '#5d6b7a'; x.fillRect(0, 0, 1024, 512); }
        x.textAlign = side < 0 ? 'left' : 'right'; const tx = side < 0 ? 60 : 964;
        x.fillStyle = side < 0 ? '#ffffff' : '#1d4f86'; x.font = `700 118px ${FONT}`;
        if (side < 0) { x.fillText('设计 · 连接未来', tx, 190); x.font = '600 52px Arial'; x.fillStyle = '#e6eef6'; x.fillText('DESIGN CONNECTS', tx, 290); x.fillText('THE FUTURE', tx, 352); }
        else { x.fillText('创新设计', tx, 160); x.fillText('改变生活', tx, 290); x.font = '600 48px Arial'; x.fillStyle = '#3a6ea6'; x.fillText('INNOVATION IN DESIGN', tx, 380); x.fillText('BETTER LIFE', tx, 436); }
      });
      const sl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({map: slogan.t, transparent: true, toneMapped: false}));
      sl.position.set(side < 0 ? -1.6 : 1.5, 3.5, .16); grp.add(sl);
      if (side < 0) {
        this.leftScreen = canvasTex(1024, 576, (x, w, hh) => this.drawScreenIdle(x, w, hh, 'left'));
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.91), new THREE.MeshBasicMaterial({map: this.leftScreen.t, toneMapped: false}));
        scr.position.set(-.9, 1.95, .17); scr.userData.target = {guideChannel: 'lab'}; grp.add(scr); this.clickables.push(scr);
      } else {
        this.rightScreens = [];
        [-.95, .2, 1.35].forEach((x, i) => {
          const tex = canvasTex(512, 384, (g2, w, hh) => this.drawScreenIdle(g2, w, hh, 'right' + i));
          const frame = new THREE.Mesh(new THREE.BoxGeometry(1.08, .82, .04), new THREE.MeshStandardMaterial({color: 0x1d2633, roughness: .4})); frame.position.set(x, 1.95, .17); grp.add(frame);
          const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .75), new THREE.MeshBasicMaterial({map: tex.t, toneMapped: false})); scr.position.set(x, 1.95, .2); scr.userData.target = {guideChannel: 'route'}; grp.add(scr); this.clickables.push(scr);
          this.rightScreens.push(tex);
        });
      }
      A.add(grp);
    };
    mk(-1); mk(1);
  }

  drawScreenIdle(x, w, h, which) {
    const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0c2a5c'); gr.addColorStop(1, '#2a74c9'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(160,220,255,.35)'; x.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const bx = (i * 97 + (which.length * 31)) % w, bh = h * (.25 + ((i * 37) % 50) / 100); x.strokeRect(bx, h - bh, 40 + (i % 3) * 18, bh); }
    x.fillStyle = 'rgba(220,240,255,.9)'; x.font = `600 ${Math.round(h / 9)}px ${FONT}`; x.textAlign = 'left';
    x.fillText(which === 'left' ? '未来设计实验室' : '好设计馆', w * .06, h * .16);
  }

  // 主墙后的展廊：隔墙、展柜屏、绿植
  buildBackHall(A) {
    const white = new THREE.MeshStandardMaterial({color: 0xf1f4f8, roughness: .7});
    for (const sx of [-1, 1]) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(7, 4.2, .2), white); back.position.set(sx * 5.2, 2.1, -8.4); A.add(back);
      const part = new THREE.Mesh(new THREE.BoxGeometry(.25, 3.6, 3.6), white); part.position.set(sx * 3.9, 1.8, -5.2); A.add(part);
      for (let i = 0; i < 3; i++) {
        const sx2 = sx * (3.3 + i * 1.5);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .7), new THREE.MeshBasicMaterial({color: [0x163b72, 0x1f5aa6, 0x2b72c4][i], toneMapped: false})); scr.position.set(sx2, 2.1, -8.28); A.add(scr);
        const cas = new THREE.Mesh(new THREE.BoxGeometry(1.2, .9, .5), white); cas.position.set(sx2, .45, -7.8); A.add(cas);
      }
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.22, .18, .45, 10), white); pot.position.set(-2.6, .22, -4.4); A.add(pot);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(.48, 0), new THREE.MeshStandardMaterial({color: 0x3f8f4e, roughness: .8, flatShading: true})); leaf.position.set(-2.6, .95, -4.4); leaf.scale.y = 1.3; A.add(leaf);
  }

  // 天花：白色顶面 + 圆形下沉穹顶科技屏 + 白色光环；两侧黑色格栅与轨道灯（实例化，一次绘制）
  buildCeiling(g) {
    const top = new THREE.Mesh(new THREE.RingGeometry(3.45, 26, 96), new THREE.MeshStandardMaterial({color: 0xf8fafc, roughness: .9, side: THREE.DoubleSide}));
    top.rotation.x = Math.PI / 2; top.position.set(0, 5.4, -.4); g.add(top);
    const well = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.45, .6, 96, 1, true), new THREE.MeshStandardMaterial({color: 0xf4f7fb, side: THREE.BackSide})); well.position.set(0, 5.7, -.4); g.add(well);
    this.domeUniforms = {uTime: {value: 0}, uFlow: {value: this.flow}, uAccent: {value: this.accent.clone()}};
    const dome = new THREE.Mesh(new THREE.CircleGeometry(3.42, 96), new THREE.ShaderMaterial({uniforms: this.domeUniforms, vertexShader: DOME_VERT, fragmentShader: DOME_FRAG}));
    dome.rotation.x = Math.PI / 2; dome.position.set(0, 5.99, -.4); g.add(dome);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(3.47, .1, 10, 160), glowMat(0xffffff)); bezel.rotation.x = Math.PI / 2; bezel.position.set(0, 5.4, -.4); g.add(bezel);
    const slat = new THREE.InstancedMesh(new THREE.BoxGeometry(.07, .14, 9), new THREE.MeshStandardMaterial({color: 0x1b1f26, roughness: .6}), 44);
    const m = new THREE.Matrix4(); let k = 0;
    for (const sx of [-1, 1]) for (let i = 0; i < 22; i++) { m.makeRotationY(-sx * deg(34)); m.setPosition(sx * (5.2 + i * .19), 5.2, -1.2); slat.setMatrixAt(k++, m); }
    g.add(slat);
    const spot = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .09, .26, 8), new THREE.MeshBasicMaterial({color: 0xfff6e8, toneMapped: false}), 10);
    k = 0; for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) { m.makeRotationX(deg(25)); m.setPosition(sx * (5 + i * .6), 4.95, -2 + i * .7); spot.setMatrixAt(k++, m); }
    g.add(spot);
  }

  // 展台：左侧城市模型（实例化小方块）+ 查询台；右侧展台与雕塑
  buildFurniture(A) {
    const white = new THREE.MeshStandardMaterial({color: 0xfafbfd, roughness: .45});
    const tableL = new THREE.Mesh(new THREE.BoxGeometry(2.6, .82, 1.1), white); tableL.position.set(-4.7, .41, 1.5); tableL.rotation.y = deg(34); A.add(tableL);
    const city = new THREE.InstancedMesh(new THREE.BoxGeometry(.11, 1, .11), white, 36), m = new THREE.Matrix4();
    for (let i = 0; i < 36; i++) { const hh = .08 + ((i * 53) % 37) / 100; const lx = -1.1 + (i % 9) * .27, lz = -.35 + Math.floor(i / 9) * .23; m.makeScale(1, hh, 1); m.setPosition(lx, .82 + hh / 2, lz); city.setMatrixAt(i, m); }
    city.position.copy(tableL.position).setY(0); city.rotation.y = deg(34); A.add(city);
    const kioskPost = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.0, .12), white); kioskPost.position.set(-4.3, .5, 2.9); A.add(kioskPost);
    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(.6, .4, .05), new THREE.MeshStandardMaterial({color: 0x1f3d66, emissive: 0x2c6fd0, emissiveIntensity: .45, roughness: .3})); kiosk.position.set(-4.3, 1.05, 2.9); kiosk.rotation.set(-deg(35), deg(45), 0); A.add(kiosk);
    const tableR = new THREE.Mesh(new THREE.BoxGeometry(2.4, .82, 1.0), white); tableR.position.set(4.8, .41, 1.3); tableR.rotation.y = -deg(34); A.add(tableR);
    const sculpt = new THREE.Mesh(new THREE.IcosahedronGeometry(.28, 0), new THREE.MeshStandardMaterial({color: 0xdfe6ee, metalness: .5, roughness: .25, flatShading: true})); sculpt.position.set(4.8, 1.12, 1.3); A.add(sculpt);
  }

  // 讲解时小D 头顶的追光（加法混合的锥体，不投影，开销很小）
  buildSpotlight(g) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25, 5.2, 40, 1, true), new THREE.MeshBasicMaterial({color: 0x9fd6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}));
    cone.position.set(HOME.x, 2.6, HOME.z); this.spot = cone; g.add(cone);
  }

  // ---------- 启用 ----------
  enable() {
    const {scene, controls, robot} = this.s;
    for (const name of ['Photo room · projected depth surfaces', 'Sharp architectural lettering · 未来设计实验室', 'Raised sign edge']) { const o = scene.getObjectByName(name); if (o) o.visible = false; }
    scene.background = new THREE.Color(0xeef3f8);
    scene.fog = new THREE.Fog(0xeef3f8, 14, 34);
    controls.minAzimuthAngle = -deg(40); controls.maxAzimuthAngle = deg(40);
    controls.minPolarAngle = deg(66); controls.maxPolarAngle = deg(100);
    controls.minDistance = 3; controls.maxDistance = 12;
    controls.enablePan = false;
    robot.position.copy(HOME); robot.rotation.y = 0;
    this.frameRobot(true);
    this.loop();
    window.gdHall = this;
  }

  // ---------- 氛围 ----------
  setTheme(name) { if (THEMES[name]) this.theme = name; }
  setPresenting(on) { this.presenting = !!on; }

  // 左大屏与右侧三屏显示当前内容（项目封面、图集）
  showMedia(urls = [], title = '') {
    const list = urls.filter(Boolean);
    const draw = (tex, url, label, idle) => {
      if (!url) { this.drawScreenIdle(tex.g, tex.c.width, tex.c.height, idle); tex.t.needsUpdate = true; return; }
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { const {g, c} = tex; g.fillStyle = '#0d1f3a'; g.fillRect(0, 0, c.width, c.height); cover(g, im, 0, 0, c.width, c.height);
        if (label) { g.fillStyle = 'rgba(8,24,48,.6)'; g.fillRect(0, c.height * .82, c.width, c.height * .18); g.fillStyle = '#eaf6ff'; g.font = `600 ${Math.round(c.height / 16)}px ${FONT}`; g.textAlign = 'left'; g.fillText(label.slice(0, 26), c.width * .04, c.height * .94); }
        tex.t.needsUpdate = true; };
      im.onerror = () => { this.drawScreenIdle(tex.g, tex.c.width, tex.c.height, idle); tex.t.needsUpdate = true; };
      // COS 不带 Vary: Origin：同一张图若先被普通 <img> 缓存，再按跨域方式读会失败；跨域读时换个地址，缓存分开
      im.src = /^https?:/.test(url) && !url.startsWith(location.origin) ? url + (url.includes('?') ? '&' : '?') + 'cors=1' : url;
    };
    if (this.leftScreen) draw(this.leftScreen, list[0], title, 'left');
    (this.rightScreens || []).forEach((tex, i) => draw(tex, list[(i + 1) % Math.max(1, list.length)], '', 'right' + i));
  }

  resetMedia() {
    if (this.leftScreen) { this.drawScreenIdle(this.leftScreen.g, 1024, 576, 'left'); this.leftScreen.t.needsUpdate = true; }
    (this.rightScreens || []).forEach((tex, i) => { this.drawScreenIdle(tex.g, 512, 384, 'right' + i); tex.t.needsUpdate = true; });
  }

  // ---------- 镜头与行走 ----------
  cameraFor(pos) {
    const home = pos.distanceTo(HOME) < .3;
    const target = new THREE.Vector3(pos.x * .7, home ? 2.15 : 1.8, home ? -2 : pos.z - 2);
    const cam = new THREE.Vector3(pos.x * .5, home ? 1.5 : 1.6, home ? 9.6 : pos.z + 7.6);
    return {target, cam};
  }

  frameRobot(instant = false) {
    const {camera, controls, robot} = this.s, f = this.cameraFor(robot.position);
    if (instant) { controls.target.copy(f.target); camera.position.copy(f.cam); controls.update(); }
    else this.follow = {...f, until: performance.now() + 1800};
  }

  walk(to, {face} = {}) {
    const {robot, play} = this.s;
    if (this.walking) this.walking.resolve(false);
    return new Promise(resolve => {
      if (robot.position.distanceTo(to) < .05) { this.turnTo(face); resolve(true); return; }
      this.walking = {to: to.clone(), heading: angleTo(robot.position, to), face, resolve};
      play?.('walk');
    });
  }

  turnTo(face) { if (face) this.turning = {heading: angleTo(this.s.robot.position, face)}; }

  stationFor(it) { return it?.channel === 'lab' ? STATION.left : STATION.right; }

  async walkToItem(it) {
    this.setTheme(it?.channel || 'idle');
    return this.walk(this.stationFor(it), {face: new THREE.Vector3(this.stationFor(it).x * .55, 0, 10)});
  }

  async walkHome() { this.setTheme('idle'); this.setPresenting(false); return this.walk(HOME, {face: new THREE.Vector3(0, 0, 10)}); }

  // 点左屏打开实验室频道，点右屏打开当前路线频道
  pick(clientX, clientY) {
    const {camera, renderer} = this.s, rect = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(v, camera);
    return this.raycaster.intersectObjects(this.clickables, false)[0]?.object.userData.target || null;
  }

  loop() {
    const target = new THREE.Color();
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(.25, this.clock.getDelta()), {robot, camera, controls, contact, play, renderer} = this.s;
      const t = performance.now() / 1000, th = THEMES[this.theme] || THEMES.idle;
      // 氛围渐变：强调色、穹顶流速、整体亮度、追光
      this.accent.lerp(target.set(th.accent ?? THEMES.idle.accent), 1 - Math.exp(-dt * 1.5));
      for (const m of this.accentMats) m.color.copy(this.accent);
      this.domeUniforms.uAccent.value.copy(this.accent);
      this.flow = damp(this.flow, (th.flow ?? .4) * (this.presenting ? 1.6 : 1), 1.2, dt);
      this.domeUniforms.uFlow.value = this.flow; this.domeUniforms.uTime.value = t;
      const exp = this.presenting ? THEMES.present.exposure : (th.exposure ?? .98);
      if (renderer) renderer.toneMappingExposure = damp(renderer.toneMappingExposure, exp, 1.5, dt);
      this.spot.material.opacity = damp(this.spot.material.opacity, this.presenting ? .16 + .03 * Math.sin(t * 2) : 0, 2, dt);
      this.spot.position.x = robot.position.x; this.spot.position.z = robot.position.z;
      this.ringGlowMat.opacity = .7 + .25 * Math.sin(t * 1.4);
      // 行走
      const w = this.walking;
      if (w) {
        const d = shortest(robot.rotation.y, w.heading);
        robot.rotation.y += d * (1 - Math.exp(-dt * 9));
        if (Math.abs(d) < .35) {
          const step = 1.4 * dt, rest = new THREE.Vector3().subVectors(w.to, robot.position).setY(0), len = rest.length();
          if (len <= step) { robot.position.copy(w.to); this.walking = null; play?.('Idle'); this.turnTo(w.face); this.frameRobot(); w.resolve(true); }
          else robot.position.addScaledVector(rest.normalize(), step);
        }
        this.follow = {...this.cameraFor(robot.position), until: performance.now() + 1400};
      } else if (this.turning) {
        const d = shortest(robot.rotation.y, this.turning.heading);
        robot.rotation.y += d * (1 - Math.exp(-dt * 6));
        if (Math.abs(d) < .01) this.turning = null;
      }
      if (contact) { contact.position.x = robot.position.x; contact.position.z = robot.position.z; }
      if (this.follow) {
        controls.target.x = damp(controls.target.x, this.follow.target.x, 2.6, dt); controls.target.y = damp(controls.target.y, this.follow.target.y, 2.6, dt); controls.target.z = damp(controls.target.z, this.follow.target.z, 2.6, dt);
        camera.position.x = damp(camera.position.x, this.follow.cam.x, 2.2, dt); camera.position.y = damp(camera.position.y, this.follow.cam.y, 2.2, dt); camera.position.z = damp(camera.position.z, this.follow.cam.z, 2.2, dt);
        if (performance.now() > this.follow.until) this.follow = null;
      }
    };
    tick();
  }
}
