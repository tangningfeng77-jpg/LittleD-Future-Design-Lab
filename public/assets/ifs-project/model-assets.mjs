const assetDefinitions = [
  { name: '运行文件', path: 'wasm/vision_wasm_module_internal.wasm', size: 14603372, compressedSize: 4116306, hash: 'b8927a2eebfe80dd98a426a210a9e820c8215168c06f3bcf5d4d09080f623db5' },
  { name: '手势模型', path: 'gesture_recognizer.task', size: 8373440, compressedSize: 6320973, hash: '97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482' }
];

async function validAsset(bytes, asset) {
  if (bytes.byteLength !== asset.size) return false;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('') === asset.hash;
}

// This cache contains only public model files. Camera frames never enter it.
export async function loadModelAsset(asset, baseURL, report = () => {}) {
  const originalURL = new URL(`${asset.path}?v=${asset.hash}`, baseURL).href;
  let cache;
  try { cache = await globalThis.caches?.open('water-gesture-model-v1'); } catch {}
  const cached = await cache?.match(originalURL).catch(() => undefined);
  if (cached) {
    const bytes = new Uint8Array(await cached.arrayBuffer());
    if (await validAsset(bytes, asset)) { report(1, true); return bytes; }
    await cache.delete(originalURL).catch(() => {});
  }

  const compressed = typeof DecompressionStream === 'function';
  const url = new URL(`${asset.path}${compressed ? '.gz' : ''}?v=${asset.hash}`, baseURL);
  const controller = new AbortController();
  let stallTimer;
  const resetTimeout = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(), 30000);
  };
  try {
    resetTimeout();
    const response = await fetch(url, { signal: controller.signal, cache: 'force-cache' });
    if (!response.ok) throw new Error(`asset-http|${asset.name} HTTP ${response.status}`);
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      resetTimeout();
      report(Math.min(.99, received / (compressed ? asset.compressedSize : asset.size)), false);
    }
    clearTimeout(stallTimer);
    let bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    if (!await validAsset(bytes, asset)) throw new Error(`asset-integrity|${asset.name}下载不完整或返回了错误内容`);
    await cache?.put(originalURL, new Response(bytes)).catch(() => {});
    report(1, false);
    return bytes;
  } catch (error) {
    if (error.message.startsWith('asset-')) throw error;
    throw new Error(`asset-network|${asset.name}${controller.signal.aborted ? '下载中断，30 秒未收到数据' : '下载失败，请检查网站连接'}`);
  } finally { clearTimeout(stallTimer); }
}

export async function loadRecognitionAssets(report) {
  const fractions = [0, 0];
  const cached = [false, false];
  const sizes = assetDefinitions.map(asset => typeof DecompressionStream === 'function' ? asset.compressedSize : asset.size);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const buffers = await Promise.all(assetDefinitions.map((asset, index) => loadModelAsset(asset, new URL('./vendor/mediapipe/', import.meta.url), (fraction, fromCache) => {
    fractions[index] = fraction;
    cached[index] = fromCache;
    const loaded = sizes.reduce((sum, size, i) => sum + size * fractions[i], 0);
    const progress = Math.round(loaded / total * 100);
    report({ type: 'progress', progress, message: cached.every(Boolean) ? '已读取本机缓存 · 正在准备识别' : `下载手势组件 ${progress}% · ${(loaded / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB` });
  })));
  return { wasm: buffers[0], model: buffers[1] };
}
