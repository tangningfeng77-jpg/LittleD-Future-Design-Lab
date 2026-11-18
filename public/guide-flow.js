import {SCENE_CHOICES} from './scene-choices.js';
const clean=s=>String(s).replace(/[\s，。！？、,.!?]/g,'');
export const affirm=text=>/^(可以|可以啊|好的|好|好啊|行|没问题|愿意|想|想看|想了解|体验一下|进去|进入项目|开始体验)$/.test(clean(text));
export const negative=text=>/^(没有|没有了|没了|没什么|暂时没有|不用了|不问了|没有问题|没有其他问题|就这些|先这样)$/.test(clean(text));
export function requestedScene(text){const value=clean(text),found=SCENE_CHOICES.filter(s=>value.includes(s.title));if(found.length>1)return null;for(const scene of SCENE_CHOICES){for(const title of [scene.title,...scene.aliases]){const rest=value.replace(title,'');if(value.includes(title)&&/^(我想了解|想了解|我想看看|想看看|看看|换到|换成|换一个|切换到|介绍一下|介绍|讲讲|了解一下|我选|选|请介绍|是什么|的介绍|这一块|吧|呢)*$/.test(rest))return scene;}}return null;}
export const PROJECT_INVITATION='好的，这个方向我们先聊到这里。如果你愿意，我可以带你深入了解一个未来设计实验室正在探索的项目。你感兴趣吗？';
const bridges={
 '智慧农业':'水土管理和采后分选连接的是同一条生产链。判断这条链是否可靠，值得先看水土检测怎样影响灌溉决策。',
 '公安政务':'这里最关键的分界，是系统发现线索与人作出处置决定。可以从一次交通异常的发现和复核，理解这条协作链。',
 '时尚产业':'数字设计与实体制作之间，最有意思的是“看起来合适”与“真正穿得合适”的差别。虚拟试衣和真实试穿正好能说明它。',
 '智慧物流':'物流不只是货物移动，还要让每一次交接都有据可查。回单怎样把实物交付变成业务凭证，是理解这套系统的一个入口。',
 '数字商业运营':'客流数据本身不会改善经营，只有转化为陈列和补货行动才有价值。可以从一个高驻留货架的调整，理解数据怎样参与决策。',
 '未来教育':'互动效果只是起点，学习发生在孩子操作、观察和解释的过程中。实验室的AI汉服换装，把服饰文化与图像生成联系起来，正好能说明内容与交互怎样结合。'
};
export function guideContext(turn,scene,offered=false){return `你是一位见识广、耐心而敏锐的图书馆知识向导。保留自然理解能力：先理解访客真实意图和上下文，再参考大纲组织答案。讲解围绕实验室的实际项目、具体对象和应用环节；介绍原理时说明它在本项目中解释什么，不转成脱离项目的一般科普。大纲是依据，不是固定问答脚本；访客改变话题、说“项目”、表达愿意深入体验或提出大纲外问题时，顺着其意图处理。知识感来自准确解释、举例和有价值的关联，而非堆砌术语或自称渊博。当前累计实质交流${turn}轮，当前场景${scene||'自由问答'}。项目邀请${offered?'已经发出，不重复邀请，继续跟随访客问题':'尚未发出'}。先完整回答，再顺着访客刚关心的内容指出一个值得注意的关联或比较，不用固定客套问句，不要求访客逐个批准小步骤。禁止说“这一部分先介绍到这里”“您还有别的想了解的吗”“下一步可以问”。承接要像讲解员自然带看下一个相关内容。先用一个自然的延伸问题把当前领域讲深一点。访客说“可以”“嗯”时，理解为愿意继续听，继续介绍刚才的延伸内容；访客明确说不想了解时，再自然转到项目邀请。访客继续追问，就继续回答，不要按轮数机械收尾。等访客明确表示没有更多想了解的内容时，再说“好的，这个方向我们先聊到这里。如果你愿意，我可以带你深入了解一个未来设计实验室正在探索的项目。你感兴趣吗？”。只有访客明确同意后才进入项目；项目与前面的领域问答是两个独立阶段。这是展厅讲解，不是互动课堂；只介绍知识、案例、机制和展陈内容。不要对访客说“你想试试自己操作吗”“你可以动手”“拿起镜子/手电/设备”等，也不要把访客说成学生、实验参与者或现场操作者。可以介绍展项中孩子、工作人员或项目参与者做了什么，但不能邀请当前访客实际操作。项目小游戏尚未接入，不编造玩法或已可游玩的功能。`;
}
export function fallbackBridge(turn,scene,offered){if(turn>=3&&!offered)return PROJECT_INVITATION;return offered?'':bridges[scene]||'这也说明了一个共同问题：技术判断怎样与真实场景中的验证相互配合。';}
export class ProjectEntry{
 constructor(onEnter,visuals){this.onEnter=onEnter;this.visuals=visuals;this.offered=false;
 this.icon=document.createElement('button');this.icon.className='project-entry';this.icon.hidden=true;this.icon.textContent='进入 IFS 项目';this.icon.onclick=onEnter;
 this.panel=document.createElement('section');this.panel.className='project-experience';this.panel.hidden=true;
 this.panel.innerHTML='<button class="project-close" type="button">返回小D</button><iframe title="IFS 项目" allow="camera; autoplay; fullscreen"></iframe>';
 document.querySelector('.viewport').append(this.icon,this.panel);this.frame=this.panel.querySelector('iframe');
 this.devices=document.createElement('details');this.devices.innerHTML='<summary>项目摄像头与手势设备</summary><p role="status">尚未开启</p><button type="button">重新连接摄像头</button>';
 document.querySelector('.right').append(this.devices);this.deviceStatus=this.devices.querySelector('p');this.devices.querySelector('button').onclick=()=>{this.prepare();this.frame.contentWindow?.postMessage({type:'ifs-camera-start'},location.origin);};
 this.panel.querySelector('.project-close').onclick=()=>this.close();
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==this.frame.contentWindow)return;if(e.data?.type==='ifs-device-status'){this.deviceStatus.textContent=e.data.message;this.frame.dataset.camera=e.data.status;}if(e.data?.type==='ifs-complete'&&!this.panel.hidden)this.close();});
 }
 prepare(){if(this.prepared)return;this.prepared=true;this.frame.src='./assets/ifs-project/index.html?prepare=1';}
 offer(){this.offered=true;this.icon.hidden=true;if(this.visuals)this.visuals.show([{id:'IFS-ENTRY',title:'进入 IFS 项目',kind:'项目入口',url:'./assets/ifs-project/ifs-project-icon.png',project:true,onActivate:this.onEnter}]);else this.icon.hidden=false;}
 enter(){this.offered=false;this.icon.hidden=true;this.visuals?.clear();this.panel.hidden=false;if(!this.prepared){this.prepared=true;this.frame.src='./assets/ifs-project/index.html?autostart=1';}else this.frame.contentWindow?.postMessage({type:'ifs-start'},location.origin);}
 close(){this.offered=false;this.panel.hidden=true;this.icon.hidden=true;this.visuals?.clear();this.frame.contentWindow?.postMessage({type:'ifs-reset'},location.origin);this.onReturn?.();}
 hide(){this.offered=false;this.icon.hidden=true;this.visuals?.clear();this.panel.hidden=true;}
 stop(){this.frame.contentWindow?.postMessage({type:'ifs-camera-stop'},location.origin);}
}
