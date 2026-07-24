const CACHE_NAME = 'logichub-builder-cache-v3';
const CORE_ASSETS = ['/builder/', '/builder/index.html', '/builder/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('logichub-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (event) => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/builder/')) return;
  if (url.pathname.startsWith('/api/') || request.headers.has('authorization')) return;
  if (request.mode === 'navigate') { event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put('/builder/index.html', copy)); return response; }).catch(() => caches.match('/builder/index.html'))); return; }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { if (response && response.status === 200 && response.type === 'basic') caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())); return response; })));
});
