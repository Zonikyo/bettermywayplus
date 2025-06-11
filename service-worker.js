const CACHE_NAME = 'cantrip-v4';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js', '/manifest.json',
  '/data/stops.json', '/icons/icon-192.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
