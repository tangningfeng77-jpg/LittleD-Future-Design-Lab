// Only short, voice-free waiting loops are loaded. Film audio stays in the film.
export class WaitingAudio {
  constructor(){this.cache=new Map();this.pending=new Map();this.generation=0;}
  prepare(state){
    this.context ||= new AudioContext();
    if(this.cache.has(state))return Promise.resolve(this.cache.get(state));
    if(this.pending.has(state))return this.pending.get(state);
    const request=fetch(`assets/audio/wait-${state}.wav?v=3`)
      .then(response=>{if(!response.ok)throw new Error('waiting-audio');return response.arrayBuffer();})
      .then(bytes=>this.context.decodeAudioData(bytes))
      .then(buffer=>{this.cache.set(state,buffer);return buffer;})
      .finally(()=>this.pending.delete(state));
    this.pending.set(state,request);return request;
  }
  async unlock(){
    this.context ||= new AudioContext();
    await this.context.resume();
  }
  stop(){
    this.generation++;
    if(this.source){this.source.stop();this.source.disconnect();this.source=null;}
  }
  async hold(state){
    this.stop();
    if(!this.context)return;
    const generation=this.generation;
    try{
      // Cached buffers start synchronously, before frame capture and camera restart.
      const buffer=this.cache.get(state)||await this.prepare(state);
      if(generation!==this.generation)return;
      const source=this.context.createBufferSource();
      source.buffer=buffer;source.loop=true;
      source.connect(this.context.destination);source.start();this.source=source;
    }catch(error){console.warn('Waiting sound unavailable',error);}
  }
}
