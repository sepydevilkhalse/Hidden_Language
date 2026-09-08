// ==============================================
// Hidden Language — Service Worker
// ==============================================
// Purpose: make the app installable/offline-capable (PWA) and give the
// in-app "Check for update" button somewhere to write a manually-approved
// new copy of index.html to. This worker never fetches an update on its
// own — it only ever serves whatever is already in the cache, and the
// cache is only ever changed by (a) the very first install, or (b) the
// page itself calling caches.open()/cache.put() after the user has
// clicked the update button AND confirmed the prompt. No auto-update.

const CACHE_NAME = 'hidden-language-cache-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    // The HTML document itself: cache-first. This is what makes "offline ->
    // use the last installed version" and "manual update -> reload shows the
    // new version" both work, since the cache is the single source of truth
    // for the document instead of always re-hitting the network.
    if (req.mode === 'navigate' || req.destination === 'document') {
        event.respondWith(
            caches.match(req, { ignoreSearch: true }).then((cached) => {
                if (cached) return cached;
                return fetch(req)
                    .then((res) => {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                        return res;
                    })
                    .catch(() => caches.match('./index.html'));
            })
        );
        return;
    }

    // Everything else (fonts, icons, manifest): network first, cache fallback
    // for offline, and quietly cache successful responses for next time.
    event.respondWith(
        fetch(req)
            .then((res) => {
                const copy = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                return res;
            })
            .catch(() => caches.match(req))
    );
});
