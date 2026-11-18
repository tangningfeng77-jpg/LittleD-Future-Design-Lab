import { FilesetResolver, GestureRecognizer } from './vendor/mediapipe/vision_bundle.mjs';
import { loadRecognitionAssets } from './model-assets.mjs';

let recognizer;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    let wasmURL;
    try {
      const buffers = await loadRecognitionAssets(message => self.postMessage(message));
      self.postMessage({ type: 'progress', message: '文件已就绪 · 正在初始化手势识别' });
      const files = await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm', import.meta.url).href, true);
      wasmURL = URL.createObjectURL(new Blob([buffers.wasm], { type: 'application/wasm' }));
      files.wasmBinaryPath = wasmURL;
      const options = {
        baseOptions: { modelAssetBuffer: buffers.model, delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: .5, minHandPresenceConfidence: .5,
        minTrackingConfidence: .5
      };
      recognizer = await GestureRecognizer.createFromOptions(files, options);
      self.postMessage({ type: 'ready' });
    } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
    finally { if (wasmURL) URL.revokeObjectURL(wasmURL); }
  }
  if (data.type === 'frame') {
    try {
      const result = recognizer.recognizeForVideo(data.bitmap, data.timestamp);
      self.postMessage({ type: 'result', result });
    } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
    finally { data.bitmap.close(); }
  }
};
