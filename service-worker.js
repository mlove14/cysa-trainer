const CACHE='cysa-coach-question-bank-v2-batch-2';
const ASSETS=['./','./index.html','./css/styles.css','./js/app.js','./js/exam-engine.js','./questions/manifest.json','./questions/pack1.json','./questions/pack2a-v1.json','./questions/exam-sim-release1.json','./questions/exam-sim-v2-batch1.json','./questions/exam-sim-v2-batch2.json','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/favicon.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))})
