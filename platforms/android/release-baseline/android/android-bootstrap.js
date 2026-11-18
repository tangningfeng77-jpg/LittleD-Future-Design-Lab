const c=document.createElement('canvas');let gl=null;try{gl=c.getContext('webgl2')}catch{}
function fail(message){const box=document.createElement('div');box.style.cssText='position:fixed;inset:10%;z-index:9999;background:white;padding:40px;font:24px sans-serif;color:#254638';box.textContent=message;document.body.append(box)}
if(!gl){fail('当前Android网页组件不支持WebGL 2，无法显示3D机器人。请更新设备的Android System WebView后重新打开小D。')}else{import('./app.js').catch(e=>{console.error(e);fail('小D启动未完成：'+e.message+'。请长按页面检查连接设置，或重新启动应用。')})}
