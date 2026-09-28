const C = "beautybook-v2";

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(C).then(cache => cache.addAll([
      "./",
      "./index.html",
      "./css/style.css",
      "./js/app.js",
      "./js/firebase-config.js"
    ]))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== C).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});