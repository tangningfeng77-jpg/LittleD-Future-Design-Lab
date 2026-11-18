import assert from 'node:assert/strict';
import {SCENE_CHOICES,findSceneChoice,orbitLayout,SceneChoices} from '../public/scene-choices.js';
assert.equal(SCENE_CHOICES.length,6);assert.equal(new Set(SCENE_CHOICES.map(s=>s.id)).size,6);
assert.equal(findSceneChoice('我想看看智慧农业').id,'agriculture');assert.equal(findSceneChoice('教育方面').id,'education');assert.equal(findSceneChoice('数字商业运营').id,'commerce');assert.equal(findSceneChoice('时尚服装').id,'fashion');
for(const width of [375,700,1329,1920]){const points=orbitLayout(width);assert.equal(points.filter(p=>p.x<50).length,3);assert.equal(points.filter(p=>p.x>50).length,3);assert(points.every(p=>p.x>10&&p.x<90&&p.y>35&&p.y<80));}
const makeNode=()=>({style:{setProperty(){}},dataset:{},attributes:{},classList:{add(){},remove(){},toggle(){}},children:[],setAttribute(k,v){this.attributes[k]=v},append(...items){this.children.push(...items)}});
const viewport=makeNode();globalThis.document={createElement:makeNode,querySelector:()=>viewport};globalThis.window={innerWidth:1329,addEventListener(){}};globalThis.requestAnimationFrame=fn=>fn();
const choices=[];const menu=new SceneChoices({onSelect:scene=>choices.push(scene.id)});assert(menu.root.hidden);menu.show();assert(menu.visible);assert.equal(menu.buttons.length,6);assert(menu.buttons.every(b=>!b.disabled));
menu.choose(SCENE_CHOICES[0]);menu.choose(SCENE_CHOICES[1]);await new Promise(r=>setTimeout(r,700));assert.deepEqual(choices,['agriculture'],'one click chooses exactly one scene');assert(!menu.visible);assert(!menu.toggle.hidden);
menu.show();menu.choose(SCENE_CHOICES[5]);menu.hide();await new Promise(r=>setTimeout(r,700));assert.deepEqual(choices,['agriculture'],'a new user action cancels an older pending selection');
menu.reset();assert(menu.root.hidden&&menu.toggle.hidden);
console.log('PASS: all six supplied images have unique scene labels; ellipse has three choices per side; click dispatches once; selection can reopen; cancelled clicks cannot send a stale question.');
