// src/components/PWAInstallButton.tsx
import { Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { usePWAInstall } from "../hooks/usePWAInstall";

export const PWAInstallButton = () => {
    const { isInstallable, installApp } = usePWAInstall();

    // Only show when PWA is actually installable
    if (!isInstallable) return null;

    return (
        <Button
            className="PWAInstallButton"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={installApp}
            style={{
                position: "fixed",
                bottom: 20,
                right: 20,
                zIndex: 1000,
            }}
        >
            Cài đặt ứng dụng
        </Button>
    );
};
