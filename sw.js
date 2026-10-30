const CACHE_NAME = 'dotcat-todo-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/pixel-base.css',
  './css/cat.css',
  './css/layout.css',
  './css/components.css',
  './js/icons.js',
  './js/sound.js',
  './js/store.js',
  './js/cat.js',
  './js/ui.js',
  './js/app.js',
  './js/pwa.js',
  './assets/icon-192.svg',
  './assets/icon-512.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // 캐시 우선, 네트워크 폴백
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return (
        cached ||
        fetch(e.request).catch(() => {
          // 오프라인 시 index.html 반환
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        })
      );
    })
  );
});

