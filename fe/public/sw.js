// public/sw.js - Ton Finance PWA Service Worker
// ✅ Tăng version khi muốn force refresh cache cho user
const CACHE_NAME = "ton-finance-cache-v1";

const ASSETS_TO_CACHE = [
    "/",
    "/manifest.json",
    "/logo.png",
    "/logo512.png",
];

// ─── Helper: bỏ qua HMR và dev files ─────────────────────
const shouldSkip = (request) => {
    const url = request.url;
    return (
        request.method !== "GET" ||
        request.headers.has("Authorization") ||
        url.includes("hot-update.js") ||
        url.includes("hot-update.json") ||
        url.includes("webpack-hmr") ||
        url.includes("sockjs-node") ||
        url.includes("__webpack") ||
        url.includes("/api/") // Không cache API calls
    );
};

// ─── Install ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
    console.log("[SW] Installing - ton-finance");
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[SW] Caching app shell assets");
            return cache.addAll(ASSETS_TO_CACHE);
        }),
    );
    self.skipWaiting(); // Kích hoạt ngay, không chờ tab cũ đóng
});

// ─── Activate ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
    console.log("[SW] Activating - cleaning old caches...");
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log("[SW] Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                }),
            );
        }),
    );
    self.clients.claim(); // Kiểm soát tất cả tab ngay lập tức
});

// ─── Fetch: Network first → Cache fallback ────────────────
// Bắt buộc có fetch handler để browser hiện gợi ý "Cài đặt app"
self.addEventListener("fetch", (event) => {
    // ✅ Bỏ qua HMR files, API có auth và request không nên cache
    if (shouldSkip(event.request)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Lấy được từ network → cập nhật cache và trả về
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            })
            .catch(() => {
                // Mất mạng → fallback về cache
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // Nếu không có cache → trả về trang chủ (offline fallback)
                    return caches.match("/");
                });
            }),
    );
});

// ─── Push Notification ────────────────────────────────────
self.addEventListener("push", (event) => {
    if (!event.data) return;
    const data = event.data.json();

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: "/logo.png",
            badge: "/logo.png",
            tag: data.tag,
            vibrate: [200, 100, 200],
            data: data.data,
            requireInteraction: true, // Không tự biến mất
            renotify: true, // Hiện lại dù cùng tag
            silent: false, // Có âm thanh + rung
            actions: [
                { action: "open", title: "📂 Xem chi tiết" },
                { action: "dismiss", title: "✕ Bỏ qua" },
            ],
        }),
    );
});

// ─── Notification Click ───────────────────────────────────
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    if (event.action === "dismiss") return;

    const actionUrl = event.notification.data?.actionUrl || "/";

    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                // Focus tab đang mở nếu có
                for (const client of clientList) {
                    if (client.url.includes(actionUrl) && "focus" in client) {
                        return client.focus();
                    }
                }
                // Không có tab nào → mở tab mới
                return clients.openWindow(actionUrl);
            }),
    );
});
