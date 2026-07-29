self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key === 'logichub-v2-cache-v1' || key === 'logichub-cache-v1').map((key) => caches.delete(key)))).then(() => self.registration.unregister()).then(() => self.clients.matchAll()).then((clients) => clients.forEach((client) => client.navigate(client.url))))
});
