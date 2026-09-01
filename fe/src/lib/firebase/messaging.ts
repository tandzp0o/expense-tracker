import { getMessaging, getToken, isSupported } from "firebase/messaging";
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

        const registration = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js",
        );
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
