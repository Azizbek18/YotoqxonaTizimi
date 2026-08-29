// Minimal service worker for PWA installability. No fetch handler on
// purpose: Chrome dropped the fetch-handler requirement for installability,
// and a pass-through `respondWith(fetch(...))` only adds a round-trip and
// disables the browser's own navigation preload / bfcache paths.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
