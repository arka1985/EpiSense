const CACHE_NAME = 'episense-v31';
const ASSETS = [
    './',
    'index.html',
    'main.css',
    'research_design_suite.html',
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
    'logo.svg',
    'translation.html',
    'qualitative_research.html',
    'referencing.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache v6');
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
    const url = new URL(event.request.url);

    // For navigation requests (HTML pages), use a Network First strategy
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(event.request);
            })
        );
        return;
    }

    // For other assets, use Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                });
                return networkResponse;
            });
            return cachedResponse || fetchPromise;
        })
    );
});
