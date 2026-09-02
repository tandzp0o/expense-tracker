import {
    getMessaging,
    getToken,
    isSupported,
    onMessage,
} from "firebase/messaging";
import { firebaseApp } from "./config";

const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY?.trim();

export type PushPermissionResult =
    | { status: "granted"; token: string }
    | { status: "denied" }
    | { status: "unsupported" }
    | { status: "misconfigured" }
    | { status: "failed"; error: unknown };

export const isPushSupported = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
        return false;
    }

    try {
        return await isSupported();
    } catch {
        return false;
    }
};

/**
 * Asks for notification permission and returns the FCM token for this device.
 * The token is what the backend stores and sends reminders to, so it has to be
 * refreshed on every sign-in: browsers rotate it silently.
 */
export const requestPushToken = async (): Promise<PushPermissionResult> => {
    if (!(await isPushSupported())) {
        return { status: "unsupported" };
    }

    if (!VAPID_KEY) {
        console.error(
            "REACT_APP_FIREBASE_VAPID_KEY is not set; web push cannot be enabled.",
        );
        return { status: "misconfigured" };
    }

    try {
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            return { status: "denied" };
        }

        // Must NOT use the default "/" scope: index.tsx registers the PWA
        // service worker there on every load, and a scope only holds one
        // script, so the two would keep overwriting each other. This is the
        // scope the Firebase SDK uses internally.
        const registration = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js",
            { scope: "/firebase-cloud-messaging-push-scope" },
        );
        await navigator.serviceWorker.ready;
        const messaging = getMessaging(firebaseApp);
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
        });

        if (!token) {
            return { status: "failed", error: new Error("Empty FCM token") };
        }

        return { status: "granted", token };
    } catch (error) {
        return { status: "failed", error };
    }
};

/**
 * Browsers do not display push notifications while the page has focus, so the
 * foreground case has to draw one itself. Returns an unsubscribe function.
 */
export const listenForForegroundMessages = async () => {
    if (!(await isPushSupported())) {
        return () => undefined;
    }

    try {
        const messaging = getMessaging(firebaseApp);

        return onMessage(messaging, (payload) => {
            const title = payload.notification?.title || "TonFin";
            const body = payload.notification?.body || "";

            if (Notification.permission !== "granted") {
                return;
            }

            void navigator.serviceWorker.ready.then((registration) =>
                registration.showNotification(title, {
                    body,
                    icon: "/logo192.png",
                    badge: "/logo192.png",
                    data: {
                        actionUrl: payload.fcmOptions?.link || "/transactions",
                    },
                }),
            );
        });
    } catch (error) {
        console.error("Could not listen for foreground messages:", error);
        return () => undefined;
    }
};
