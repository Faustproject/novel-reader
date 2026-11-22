/* App 外殼離線快取；字典與翻譯一律走網路（查過的字另存一份，離線時可回看） */
const VERSION = 'nr-v7';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'tts-worker.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const API = ['api.dictionaryapi.dev', 'api.mymemory.translated.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'nr-api').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin === location.origin){
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req, {ignoreSearch: true});
      const net = fetch(req).then(r => { if(r.ok) c.put(req, r.clone()); return r; });
      if(req.mode === 'navigate' || /(index\.html|\/)$/.test(url.pathname)){
        // 頁面本身：網路優先（3 秒內沒回應就用快取），改版後立即生效
        return Promise.race([net, new Promise((_, rej) => setTimeout(rej, 3000))]).catch(() => hit || net);
      }
      return hit || net.catch(() => hit);          // 其餘外殼檔：快取優先，背景更新
    }));
  }else if(API.includes(url.hostname)){
    // 字典／翻譯：網路優先，失敗才用上次查過的結果
    e.respondWith(fetch(req).then(r => {
      if(r.ok || r.status === 404){ const cp = r.clone(); caches.open('nr-api').then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req).then(h => h || Response.error())));
  }
});
