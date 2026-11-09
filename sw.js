// PoloPad Pro — Offline Pool Deck Service Worker (Rev 2.5 PWA)
const CACHE_NAME = 'polopad-pro-rev25-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './assets/polobridge_kit_exploded_render.jpg',
  './assets/polobridge_hardware_dongle.jpg',
  './assets/polobridge_deck_operator_pov.jpg',
  './downloads/PoloBridge_Rev2_4_JLCPCB_Gerbers.zip',
  './downloads/JLCPCB_BOM.csv',
  './downloads/JLCPCB_CPL.csv',
  './downloads/polobridge_front_panel_drill_jig.stl',
  './downloads/polopad_poolside_sunhood_stand.stl'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Stale-While-Revalidate + Offline SPA Navigation Fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return cached;
        });
      return cached || networked;
    })
  );
});
