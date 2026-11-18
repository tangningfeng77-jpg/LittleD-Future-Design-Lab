export class RobotCapture extends AudioWorkletProcessor {
 constructor(){super();this.pending=[];this.phase=0;this.sum=0;this.count=0;}
 process(inputs,outputs){const a=inputs[0]?.[0];if(a){const ratio=sampleRate/16000;for(const v of a){this.sum+=v;this.count++;this.phase++;if(this.phase>=ratio){this.pending.push(Math.max(-1,Math.min(1,this.sum/this.count)));this.phase-=ratio;this.sum=0;this.count=0;}if(this.pending.length>=1600){this.port.postMessage(Float32Array.from(this.pending));this.pending=[];}}}return true;}
}
registerProcessor('robot-capture',RobotCapture);
