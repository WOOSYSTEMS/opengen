const CACHE_NAME = 'opengen-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/storage.js',
  '/js/identity.js',
  '/js/signaling.js',
  '/js/webrtc.js',
  '/js/call.js',
  '/js/screen.js',
  '/js/chat.js',
  '/js/app.js'
];

// Install - cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (e) => {
  // Skip WebSocket and non-GET requests
  if (e.request.url.includes('ws://') || e.request.url.includes('wss://') || e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
