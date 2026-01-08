
const CACHE_NAME = 'rapidus-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-192.jpg',
    '/icons/icon-512.jpg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
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
        icon: '/icons/icon-192.jpg',
        badge: '/icons/icon-192.jpg',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        },
        // O som é suportado em alguns navegadores Android via tag 'sound'
        // Mas no PWA real, muitas vezes depende da categoria da notificação no sistema
        tag: 'delivery-notification',
        renotify: true
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
