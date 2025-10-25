const CACHE_NAME = 'smart-checklist-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './prototypes/cantiere_enel.json',
  './prototypes/cantiere_terna.json',
  'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js',
  'https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.min.js'
];

// Install SW e cache dei file
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Attiva SW e pulisce cache vecchie
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Intercetta richieste e risponde dalla cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
