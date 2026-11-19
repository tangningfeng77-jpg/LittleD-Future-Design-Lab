// Alpha-bound calibration: equal visible subject height, independent of PNG padding.
const ART_BOUNDS={"fashion.png": [1.153914, 1.054529, 0.566843, 0.026385], "logistics.png": [1.051132, 1.051132, 0.51886, 0.051132], "public-services.png": [1.160035, 1.060124, 0.591512, 0.04863], "agriculture.png": [1.115646, 1.019558, 0.557823, 0.012755], "education.png": [1.055556, 1.055556, 0.536616, 0.040404], "commerce.png": [1.045872, 1.045872, 0.533361, 0.026689]};
export const SCENE_CHOICES=Object.freeze([
 {id:'agriculture',title:'智慧农业',aliases:['农业','种植','农田'],image:'agriculture.png'},
 {id:'public-services',title:'公安政务',aliases:['公安','政务','警察','安防'],image:'public-services.png'},
 {id:'fashion',title:'时尚产业',aliases:['时尚','服装','服饰','云衣'],image:'fashion.png'},
 {id:'logistics',title:'智慧物流',aliases:['物流','配送','仓储'],image:'logistics.png'},
 {id:'commerce',title:'数字商业运营',aliases:['数字商业','商业运营','零售','超市'],image:'commerce.png'},
 {id:'education',title:'未来教育',aliases:['教育','教学','学习'],image:'education.png'}
]);
export function findSceneChoice(text){const value=String(text).replace(/\s/g,'');return SCENE_CHOICES.find(scene=>[scene.title,...scene.aliases].some(word=>value.includes(word)))||null;}
export function orbitLayout(width){const mobile=width<700;return SCENE_CHOICES.map((scene,index)=>{const angle=(-120+60*index)*Math.PI/180;return{...scene,x:!mobile&&index<2?(index===0?29:71):50+(mobile?37:32)*Math.cos(angle),y:(mobile?58:58.5)+(mobile?21:20)*Math.sin(angle)};});}
export class SceneChoices {
 constructor({onSelect}){
  this.onSelect=onSelect;this.visible=false;this.unlocked=false;this.selectionToken=0;
  const root=document.createElement('section');root.id='sceneChoices';root.className='scene-choices';root.hidden=true;root.setAttribute('aria-label','选择想了解的场景');
  root.innerHTML='<svg class="scene-orbit" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><ellipse class="scene-orbit-soft" cx="500" cy="300" rx="497" ry="297"/><ellipse class="scene-orbit-line" cx="500" cy="300" rx="497" ry="297"/><path d="M175 72 A497 297 0 0 1 825 72 M175 528 A497 297 0 0 0 825 528" class="scene-orbit-arc"/></svg>';
  this.buttons=SCENE_CHOICES.map((scene,index)=>{
   const button=document.createElement('button');button.type='button';button.className='scene-choice';button.dataset.scene=scene.id;button.setAttribute('aria-label',scene.title);button.style.setProperty('--order',index);
   const art=document.createElement('span');art.className='scene-art';art.setAttribute('aria-hidden','true');
   const image=document.createElement('img');image.src=window.ldAsset('./assets/scene-choices/'+scene.image);image.alt='';image.draggable=false;
   const [width,height,center,top]=ART_BOUNDS[scene.image];
   image.style.cssText=`width:calc(var(--icon-size) * ${width});height:calc(var(--icon-size) * ${height});left:calc(50% - var(--icon-size) * ${center});top:calc(var(--icon-size) * -${top})`;
   art.append(image);
   const indexLabel=document.createElement('span');indexLabel.className='scene-index';indexLabel.textContent=String(index+1).padStart(2,'0');indexLabel.setAttribute('aria-hidden','true');
   const label=document.createElement('span');label.className='scene-label';label.textContent=scene.title;
   button.append(indexLabel,art,label);button.onclick=()=>this.choose(scene);root.append(button);return button;
  });
  const toggle=document.createElement('button');toggle.type='button';toggle.className='scene-choice-toggle';toggle.textContent='选择场景';toggle.hidden=true;toggle.setAttribute('aria-label','重新选择六大场景');toggle.onclick=()=>this.show();
  document.querySelector('.viewport').append(root,toggle);this.root=root;this.toggle=toggle;
  this.layout();window.addEventListener('resize',()=>this.layout());
 }
 layout(){const positions=orbitLayout(window.innerWidth);positions.forEach((point,i)=>{this.buttons[i].style.setProperty('--x',point.x+'%');this.buttons[i].style.setProperty('--y',point.y+'%');});}
 show(){
  this.onShow?.();
  clearTimeout(this.selectionTimer);this.selectionToken++;this.choosing=false;this.unlocked=true;this.visible=true;
  this.buttons.forEach(button=>{button.classList.remove('is-selected');button.disabled=false;button.setAttribute('aria-pressed','false');});
  this.root.hidden=false;this.toggle.hidden=true;this.root.classList.remove('is-visible','is-choosing');
  const token=this.selectionToken;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token===this.selectionToken&&this.visible)this.root.classList.add('is-visible');}));
 }
 hide(){clearTimeout(this.selectionTimer);this.selectionToken++;this.visible=false;this.choosing=false;this.root.hidden=true;this.root.classList.remove('is-visible','is-choosing');this.toggle.hidden=!this.unlocked;}
 reset(){this.unlocked=false;this.hide();}
 choose(scene,onComplete=this.onSelect){
  if(!this.visible||this.choosing)return;this.choosing=true;this.root.classList.add('is-choosing');
  this.buttons.forEach(button=>{const selected=button.dataset.scene===scene.id;button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));button.disabled=true;});
  const token=this.selectionToken;this.selectionTimer=setTimeout(()=>{if(token!==this.selectionToken)return;this.hide();onComplete(scene);},650);
 }
}
