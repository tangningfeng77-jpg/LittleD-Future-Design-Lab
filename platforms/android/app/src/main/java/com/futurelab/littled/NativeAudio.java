package com.futurelab.littled;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.*;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import org.json.*;

/** Local PCM capture; never writes recordings to disk. */
public final class NativeAudio {
 final MainActivity activity;
 volatile int generation=0;
 volatile AudioRecord recorder;
 volatile Thread worker;
 volatile String pendingDevice;
 volatile String lastDiagnostic="尚未录音";
 NativeAudio(MainActivity activity){this.activity=activity;}
 AudioDeviceInfo[] devices(){return ((AudioManager)activity.getSystemService(Context.AUDIO_SERVICE)).getDevices(AudioManager.GET_DEVICES_INPUTS);}
 @JavascriptInterface public String inputs(){JSONArray list=new JSONArray();try{for(AudioDeviceInfo d:devices())list.put(new JSONObject().put("id",String.valueOf(d.getId())).put("name",d.getProductName().toString()).put("type",d.getType()));}catch(Exception ignored){}return list.toString();}
 @JavascriptInterface public String diagnostic(){return lastDiagnostic;}
 @JavascriptInterface public void start(String device){activity.runOnUiThread(()->{if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){pendingDevice=device;activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},21);}else launch(device);});}
 void permission(boolean granted){String device=pendingDevice;pendingDevice=null;if(granted)launch(device);else emit("error","message","请在应用权限中允许小D使用麦克风");}
 synchronized void launch(String device){stop();int token=generation;Thread previous=worker;worker=new Thread(()->{try{if(previous!=null)previous.join(1500);capture(device,token);}catch(Exception e){if(token==generation)emit("error","message",e.getMessage());}},"LittleD-native-microphone");worker.start();}
 @JavascriptInterface public synchronized void stop(){generation++;pendingDevice=null;AudioRecord r=recorder;if(r!=null)try{r.stop();}catch(Exception ignored){}}
 void emit(String type,String key,Object value){try{JSONObject event=new JSONObject().put("type",type).put(key,value);String js="window.dispatchEvent(new CustomEvent('littled-native-audio',{detail:"+event+"}))";activity.runOnUiThread(()->{if(activity.web!=null&&!activity.isDestroyed())activity.web.evaluateJavascript(js,null);});}catch(Exception ignored){}}
 void capture(String selected,int token)throws Exception{
 if(activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)throw new SecurityException("麦克风权限未允许");
  AudioDeviceInfo preferred=null;for(AudioDeviceInfo d:devices())if(String.valueOf(d.getId()).equals(selected))preferred=d;
  StringBuilder attempts=new StringBuilder();
  for(int source:new int[]{MediaRecorder.AudioSource.MIC,MediaRecorder.AudioSource.VOICE_RECOGNITION,MediaRecorder.AudioSource.DEFAULT})for(int rate:new int[]{16000,48000,44100})for(int channels:new int[]{1,2}){
   if(token!=generation)return;AudioRecord r=null;boolean opened=false;
   try{
    int mask=channels==1?AudioFormat.CHANNEL_IN_MONO:AudioFormat.CHANNEL_IN_STEREO;int minimum=AudioRecord.getMinBufferSize(rate,mask,AudioFormat.ENCODING_PCM_16BIT);if(minimum<=0)continue;
    r=new AudioRecord(source,rate,mask,AudioFormat.ENCODING_PCM_16BIT,Math.max(minimum*2,rate*channels/5*2));if(r.getState()!=AudioRecord.STATE_INITIALIZED)throw new Exception("初始化失败");
    if(preferred!=null&&!r.setPreferredDevice(preferred))throw new Exception("输入路由不可用");
    recorder=r;r.startRecording();if(r.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING)throw new Exception("录音未开始");
    short[] block=new short[rate/50*channels];int count=r.read(block,0,block.length);if(count<=0)throw new Exception("读取失败 "+count);if(token!=generation)return;
    opened=true;AudioDeviceInfo routed=r.getRoutedDevice();lastDiagnostic="原生录音 · "+(routed==null?"系统默认":routed.getProductName())+" · "+rate+"Hz / "+channels+"声道 · 输入源"+source;
    emit("ready","message",lastDiagnostic);PcmConverter converter=new PcmConverter(rate,channels);
    while(token==generation){if(count<0)throw new Exception("录音中断 "+count);if(count>0){converter.append(block,count,pcm->{if(token==generation)emit("pcm","audio",Base64.encodeToString(pcm,Base64.NO_WRAP));});}count=r.read(block,0,block.length);}
    return;
   }catch(Exception e){if(token!=generation)return;if(opened)throw e;attempts.append(source).append('/').append(rate).append('/').append(channels).append(':').append(e.getClass().getSimpleName()).append(' ');}
   finally{if(r!=null){try{r.stop();}catch(Exception ignored){}r.release();if(recorder==r)recorder=null;}}
  }
  lastDiagnostic="原生录音无法启动。输入设备："+inputs()+"；尝试："+attempts;throw new Exception(lastDiagnostic);
 }
 interface Sink{void accept(byte[] pcm);}
 static final class PcmConverter{
  final int rate,channels;double phase=0,sum=0;int samples=0,used=0;final byte[] output=new byte[3200];
  PcmConverter(int rate,int channels){this.rate=rate;this.channels=channels;}
  void append(short[] input,int length,Sink sink){for(int i=0;i+channels<=length;i+=channels){double mono=0;for(int c=0;c<channels;c++)mono+=input[i+c];sum+=mono/channels;samples++;phase+=16000;if(phase>=rate){short v=(short)Math.max(-32768,Math.min(32767,Math.round(sum/samples)));output[used++]=(byte)v;output[used++]=(byte)(v>>8);phase-=rate;sum=0;samples=0;if(used==output.length){sink.accept(output.clone());used=0;}}}}
 }
}
