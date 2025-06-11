const CACHE_NAME = 'cantrip-cache-v1';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Timetables and GTFS-R caching
  if (url.pathname.endsWith('.json') || url.pathname.includes('gtfs-realtime')) {
    event.respondWith(
      caches.open('transit-data').then(cache =>
        fetch(event.request)
          .then(response => {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cache.match(event.request))
      )
    );
    return;
  }

  // Default asset caching
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
