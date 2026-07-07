'use strict';

const CACHE_NAME = 'precon-app-v44';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './documents.js',
  './utils.js',
  './storage.js',
  './photos.js',
  './pdf.js',
  './app.js',
  './manifest.webmanifest',
  './assets/fonts/Arlen-Light.otf',
  './assets/fonts/Arlen-Regular.otf',
  './assets/fonts/Arlen-Bold.otf',
  './assets/fonts/Alkaline-Bold.woff2',
  './assets/fonts/DIN-Condensed-Variable.woff2',
  './assets/fonts/SpicyRice-Regular.ttf',
  './assets/absolute-aluminum_badge-color.svg',
  './assets/apple-touch-icon.png',
  './assets/absolute-aluminum-logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await caches.match(request);

  try {
    const freshRequest = new Request(request, { cache: 'no-cache' });
    const response = await fetch(freshRequest);

    if (response && response.ok && new URL(request.url).origin === self.location.origin) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (err) {
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('./index.html');
    throw err;
  }
}
