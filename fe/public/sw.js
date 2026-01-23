// public/sw.js
const CACHE_NAME = "ton-finance-v1";
const urlsToCache = [
    "/",
    "/static/js/bundle.js",
    "/static/css/main.css",
    "/manifest.json",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)),
    );
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches
            .match(event.request)
            .then((response) => response || fetch(event.request)),
    );
});
