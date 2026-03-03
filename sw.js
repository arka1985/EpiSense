const CACHE_NAME = 'episense-v1';
const ASSETS = [
    'index.html',
    'main.css',
    'stats_tests.html',
    'math_modeling.html',
    'ml_basics.html',
    'icons/icon-192.png',
    'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
