const CACHE_NAME = 'yaya-workbench-v2-18';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js?v=218',
  './cloud-sync.js?v=218',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(() => {
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (event.request.url.startsWith('http')) {
            cache.put(event.request, clone);
          }
        });
        return response;
      });
    }).catch(() => {
      return new Response('离线中，请检查网络后重试');
    })
  );
});

self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = JSON.parse(event.data.text());
  } catch (e) {
    payload = { title: '提醒', body: event.data ? event.data.text() : '' };
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || './icon-192.png',
    badge: './icon-192.png',
    tag: payload.tag || 'yaya-notification',
    data: payload.data || {},
    requireInteraction: payload.requireInteraction || false,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || '雅雅的工作台', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (targetUrl !== './') {
            client.postMessage({ action: 'navigate', url: targetUrl });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
