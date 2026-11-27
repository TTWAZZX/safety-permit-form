const CACHE = 'tsh-she-v2';
const PRECACHE = [
    './guard-home.html',
    './manifest.json',
    './guard-navigation.js',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(PRECACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k.startsWith('tsh-she-') && k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // Only cache same-origin GET requests
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (!url.href.startsWith(self.registration.scope) || url.search) return;

    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res.ok && !res.redirected) {
                    const clone = res.clone();
                    e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {}));
                }
                return res;
            })
            .catch(async () => (await caches.match(e.request, { cacheName: CACHE })) || Response.error())
    );
});
