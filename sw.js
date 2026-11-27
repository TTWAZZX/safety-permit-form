const CACHE = 'tsh-she-v3';
const PRECACHE = [
    './guard-home.html',
    './manifest.json',
    './guard-navigation.js',
    './guard-report-queue.js',
    './guard_violation.html',
];

// Cache the report form dependencies when used online so the form can reopen offline.
const REPORT_ASSETS = new Set([
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/css/tom-select.bootstrap5.min.css',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/js/tom-select.complete.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
]);

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
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    const reportAsset = REPORT_ASSETS.has(url.href);
    if (!reportAsset && (!url.href.startsWith(self.registration.scope) || url.search)) return;

    e.respondWith(
        fetch(e.request)
            .then(res => {
                if ((res.ok && !res.redirected) || (reportAsset && res.type === 'opaque')) {
                    const clone = res.clone();
                    e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {}));
                }
                return res;
            })
            .catch(async () => (await caches.match(e.request, { cacheName: CACHE })) || Response.error())
    );
});
