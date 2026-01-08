const CACHE_NAME = 'rapidus-cache-v5';
const urlsToCache = [
    '/',
    '/index.html'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Lógica de Notificação Push
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Nova Notificação';
    const options = {
        body: data.body || 'Você tem uma nova atualização no Rapidus!',
        icon: '/icons/icon-192.png',
        data: {
            url: data.url || '/'
        },
        tag: 'rapidus-' + Date.now(), // Unique tag every time
        requireInteraction: true // Keeps notification visible until clicked
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
