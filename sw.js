'use strict';

const CACHE_NAME = 'precon-offline-app-v27';
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
  './assets/icon.svg',
  './assets/absolute-aluminum-logo.png',
  './assets/Pre-Construction-template.pdf'
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
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
