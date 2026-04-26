import { useCallback, useEffect, useState } from "react";

type InstallOutcome = "accepted" | "dismissed" | "unavailable";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
}

type InstallSnapshot = {
    deferredPrompt: BeforeInstallPromptEvent | null;
    isInstallable: boolean;
    isInstalled: boolean;
};

const getStandaloneState = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches;

let installSnapshot: InstallSnapshot = {
    deferredPrompt: null,
    isInstallable: false,
    isInstalled: getStandaloneState(),
};

const subscribers = new Set<() => void>();

const notifySubscribers = () => {
    subscribers.forEach((subscriber) => subscriber());
};

const setInstallSnapshot = (updates: Partial<InstallSnapshot>) => {
    installSnapshot = {
        ...installSnapshot,
        ...updates,
    };
    notifySubscribers();
};

const setupInstallListener = () => {
    if (typeof window === "undefined") {
        return;
    }

    const setupKey = "__fintrackPWAInstallListenerReady";
    if ((window as unknown as Record<string, boolean>)[setupKey]) {
        return;
    }

    (window as unknown as Record<string, boolean>)[setupKey] = true;

    window.addEventListener("beforeinstallprompt", (event: Event) => {
        event.preventDefault();
        setInstallSnapshot({
            deferredPrompt: event as BeforeInstallPromptEvent,
            isInstallable: true,
            isInstalled: false,
        });
    });

    window.addEventListener("appinstalled", () => {
        setInstallSnapshot({
            deferredPrompt: null,
            isInstallable: false,
            isInstalled: true,
        });
    });
};

setupInstallListener();

export const usePWAInstall = () => {
    const [state, setState] = useState(installSnapshot);

    useEffect(() => {
        const syncState = () => setState(installSnapshot);
        subscribers.add(syncState);
        syncState();

        return () => {
            subscribers.delete(syncState);
        };
    }, []);

    const installApp = useCallback(async (): Promise<InstallOutcome> => {
        const deferredPrompt = installSnapshot.deferredPrompt;
        if (!deferredPrompt) {
            return "unavailable";
        }

        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
            setInstallSnapshot({
                deferredPrompt: null,
                isInstallable: false,
            });
        } else {
            setInstallSnapshot({
                deferredPrompt: null,
                isInstallable: false,
            });
        }

        return outcome;
    }, []);

    return {
        isInstallable: state.isInstallable,
        isInstalled: state.isInstalled,
        installApp,
    };
};
