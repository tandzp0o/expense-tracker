// src/hooks/usePWAInstall.ts
import { useState, useEffect } from "react";

export const usePWAInstall = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            console.log("📱 PWA install prompt available");
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        const handleAppInstalled = () => {
            console.log("✅ PWA installed successfully!");
            setDeferredPrompt(null);
            setIsInstallable(false);
        };

        window.addEventListener(
            "beforeinstallprompt",
            handleBeforeInstallPrompt,
        );
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            window.removeEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt,
            );
            window.removeEventListener("appinstalled", handleAppInstalled);
        };
    }, []);

    const installApp = async () => {
        if (!deferredPrompt) {
            console.log("❌ No install prompt available");
            return;
        }

        // Check if prompt method exists (real PWA event)
        if (typeof deferredPrompt.prompt !== "function") {
            console.log(
                "💡 Real PWA install requires browser native beforeinstallprompt event",
            );

            // Fallback: Show install instructions
            alert(
                "PWA Install:\n\nChrome/Edge: Click 📱 icon in address bar\nSafari: Share → Add to Home Screen\n\nOr wait for automatic install banner on mobile",
            );
            return;
        }

        console.log("🚀 Starting PWA install...");
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        console.log("📊 User choice:", outcome);

        if (outcome === "accepted") {
            console.log("✅ User accepted install");
            setDeferredPrompt(null);
            setIsInstallable(false);
        } else {
            console.log("❌ User declined install");
        }
    };

    return { isInstallable, installApp };
};
