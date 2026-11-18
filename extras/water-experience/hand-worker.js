// Hand inference is isolated from the render loop; only one transferred frame is in flight.
let detector;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {FilesetResolver,HandLandmarker}=await import('./vendor/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm',self.location.href).href);
   detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./assets/hand_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5});
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   const start=performance.now();try{const result=detector.detectForVideo(data.bitmap,data.timestamp);self.postMessage({type:'result',landmarks:result.landmarks[0]||null,inferenceMs:performance.now()-start})}finally{data.bitmap.close()}
  }
 }catch(e){self.postMessage({type:'error',message:String(e.message||e)})}
};
