// src/components/PWAInstallButton.tsx
import { Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { usePWAInstall } from "../hooks/usePWAInstall";

export const PWAInstallButton = () => {
    const { isInstallable, installApp } = usePWAInstall();

    // Debug logs
    console.log("🔍 PWAInstallButton - isInstallable:", isInstallable);

    // Tạm thởi luôn hiển thị để test
    const showForTest = true; // Đổi thành false khi production

    if (!isInstallable && !showForTest) {
        console.log("❌ PWAInstallButton - Not installable, hiding button");
        return null;
    }

    return (
        <Button
            className="ekash_nav_item pwa_install_button"
            type={isInstallable ? "default" : "dashed"}
            icon={<DownloadOutlined />}
            onClick={installApp}
            disabled={!isInstallable}
            style={{
                width: "100%",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                height: 48,
                padding: "0 16px",
                border: isInstallable
                    ? "1px solid #e5e7eb"
                    : "1px dashed #d9d9d9",
                borderRadius: 8,
                color: "black",
                backgroundColor: !isInstallable ? "#f5f5f5" : "transparent",
            }}
        >
            <span style={{ marginLeft: 8 }}>
                {isInstallable ? "Cài đặt ứng dụng" : "PWA không khả dụng"}
            </span>
        </Button>
    );
};
