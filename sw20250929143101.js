const CACHE_NAME = 'kaomoji-v5-revert-001';
const ASSETS = [
  './',
  'index20250929230101.html',
  'style20250929142401.css',
  'app20250929143001.js',
  'kaomoji-data20250929142901.js',
  'manifest20250929143101.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k!==CACHE_NAME).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
