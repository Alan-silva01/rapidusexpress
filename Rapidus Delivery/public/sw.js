// SERVICE WORKER SUICIDA - LIMPEZA TOTAL
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }).then(() => {
            return self.registration.unregister();
        }).then(() => {
            return self.clients.matchAll();
        }).then(clients => {
            clients.forEach(client => client.navigate(client.url));
        })
    );
});

// Não interceptar nada enquanto limpamos
self.addEventListener('fetch', event => {
    return;
});
