const CACHE='cysa-trainer-v1';
const ASSETS=['./','./index.html','./css/styles.css','./js/app.js','./questions/manifest.json','./questions/pack1.json','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
