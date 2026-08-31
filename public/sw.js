// Minimal service worker for PWA installability. No fetch handler on
// purpose: Chrome dropped the fetch-handler requirement for installability,
// and a pass-through `respondWith(fetch(...))` only adds a round-trip and
// disables the browser's own navigation preload / bfcache paths.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'Mening Yotoqxonam';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Siz uchun yangi xabar bor.',
    icon: data.icon || '/icons/icon-192.webp',
    badge: data.badge || '/icons/icon-96.webp',
    tag: data.tag || 'mening-yotoqxonam',
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: data.url || '/talaba/dashboard' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/talaba/dashboard', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) await client.navigate(target);
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow(target);
  })());
});
