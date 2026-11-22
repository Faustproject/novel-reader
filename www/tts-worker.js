/* 免費離線神經語音（Kokoro-82M，Apache-2.0）：在裝置上運算，不需金鑰、句子不外傳。
   首次使用會從 Hugging Face 下載約 90MB 模型，之後由瀏覽器快取。 */
let tts = null, loading = null, chain = Promise.resolve();
async function load(){
  if(tts) return tts;
  if(!loading) loading = (async () => {
    const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js');
    const seen = {};
    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8', device: 'wasm',
      progress_callback: p => {
        if(p && p.status === 'progress' && p.total > 5e6){
          const pct = Math.floor(p.loaded / p.total * 100);
          if(seen[p.file] !== pct){ seen[p.file] = pct; postMessage({type: 'progress', pct}); }
        }
      }
    });
    postMessage({type: 'ready'});
    return tts;
  })().catch(e => { loading = null; throw e; });
  return loading;
}
onmessage = e => {
  const m = e.data;
  chain = chain.then(async () => {
    try{
      const t = await load();
      if(m.type === 'load') return;
      const a = await t.generate(m.text, {voice: m.voice, speed: 1});
      const buf = await a.toBlob().arrayBuffer();
      postMessage({type: 'audio', id: m.id, buf}, [buf]);
    }catch(err){
      postMessage({type: 'error', id: m.id, message: String(err && err.message || err)});
    }
  });
};
