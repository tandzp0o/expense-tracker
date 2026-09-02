/* eslint-disable no-undef */
// Background handler for FCM web push. Must live at the site root so the
// browser can register it under the "/firebase-cloud-messaging-push-scope".
importScripts(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
);
importScripts(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js",
);

firebase.initializeApp({
    apiKey: "AIzaSyArwJdRgoFQPMAZTqhY8EVa0g2q-7UxHqo",
    authDomain: "expense-tracker-auth-c50cf.firebaseapp.com",
    projectId: "expense-tracker-auth-c50cf",
    storageBucket: "expense-tracker-auth-c50cf.firebasestorage.app",
    messagingSenderId: "502908893673",
    appId: "1:502908893673:web:8688b18d5f4b0c8b35f378",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "TonFin";
    const options = {
        body: payload.notification?.body || "",
        icon: "/logo192.png",
        badge: "/logo192.png",
        data: { link: payload.fcmOptions?.link || "/transactions" },
    };

    self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const link = event.notification.data?.link || "/transactions";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(
            (windowClients) => {
                const existing = windowClients.find((client) => client.focus);
                if (existing) {
                    existing.navigate(link);
                    return existing.focus();
                }

                return clients.openWindow(link);
            },
        ),
    );
});
