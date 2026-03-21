// public/sw.js - Enhanced Service Worker for PWA
const CACHE_NAME = "ton-finance-v2";
const urlsToCache = [
    "/",
    "/static/js/bundle.js",
    "/static/css/main.css",
    "/manifest.json",
    "/logo.png",
    "/logo512.png",
    "/favicon.ico",
];

// Install event - Cache resources
self.addEventListener("install", (event) => {
    console.log("🔧 Service Worker: Installing...");
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => {
                console.log("🔧 Service Worker: Caching app shell");
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log("🔧 Service Worker: Installation complete");
                return self.skipWaiting(); // Force activation
            }),
    );
});

// Activate event - Clean up old caches
self.addEventListener("activate", (event) => {
    console.log("🚀 Service Worker: Activating...");
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log(
                                "🗑️ Service Worker: Deleting old cache:",
                                cacheName,
                            );
                            return caches.delete(cacheName);
                        }
                    }),
                );
            })
            .then(() => {
                console.log("🚀 Service Worker: Activation complete");
                return self.clients.claim(); // Take control of all pages
            }),
    );
});

// Fetch event - Serve from cache when offline
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches
            .match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    console.log(
                        "📦 Service Worker: Serving from cache:",
                        event.request.url,
                    );
                    return response;
                }

                // Network request
                console.log(
                    "🌐 Service Worker: Fetching from network:",
                    event.request.url,
                );
                return fetch(event.request).then((response) => {
                    // Check if valid response
                    if (
                        !response ||
                        response.status !== 200 ||
                        response.type !== "basic"
                    ) {
                        return response;
                    }

                    // Clone response for caching
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        console.log(
                            "💾 Service Worker: Caching new resource:",
                            event.request.url,
                        );
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                });
            })
            .catch(() => {
                // Offline fallback
                console.log(
                    "❌ Service Worker: Network failed, serving offline page",
                );
                return caches.match("/");
            }),
    );
});

// Handle push notifications (optional)
self.addEventListener("push", (event) => {
    if (event.data) {
        const data = event.data.json();
        console.log("📬 Service Worker: Push received:", data);

        const options = {
            body: data.body,
            icon: "/logo.png",
            badge: "/favicon.ico",
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: 1,
            },
            actions: [
                {
                    action: "explore",
                    title: "Explore",
                    icon: "/logo.png",
                },
                {
                    action: "close",
                    title: "Close",
                    icon: "/favicon.ico",
                },
            ],
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options),
        );
    }
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
    console.log("🔔 Service Worker: Notification clicked");
    event.notification.close();

    event.waitUntil(clients.openWindow("/"));
});
