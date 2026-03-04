const CACHE_NAME = 'episense-v3';
const ASSETS = [
    './',
    'index.html',
    'main.css',
    'random_gen.html',
    'data_collection.html',
    'math_modeling.html',
    'ml_basics.html',
    'stat_viz.html',
    'stats_tests.html',
    'Predictive_Value/index.html',
    'Sample_Size/index.html',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'logo.png',
    'logo.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache v3');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('Deleting old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Cache hit - return response, otherwise fetch from network
            return response || fetch(event.request);
        })
    );
});
