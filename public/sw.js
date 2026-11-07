/* UR Online — service worker (offline support)
 *
 * Strategy:
 *  - navigations  → network first, offline.html fallback
 *  - static assets (script/style/font/image, /icons, /uploads media) → cache
 *    first with background refresh (stale-while-revalidate)
 *  - /api/ and socket traffic → network only (never cached)
 */
const VERSION = 'ur-online-v1';
const PRECACHE = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const CACHEABLE_DEST = new Set(['script', 'style', 'font', 'image']);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Live data stays live.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return;

  // App navigations: try the network, fall back to the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Keep a copy of visited pages for offline revisits.
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Static assets & media: cache first, refresh in the background.
  const isMedia = url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/icons/');
  if (CACHEABLE_DEST.has(req.destination) || isMedia) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })
    );
  }
});
