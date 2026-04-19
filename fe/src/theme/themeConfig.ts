import { ThemeConfig } from "antd";

// Color scheme matching muse-ant-design
export const darkTheme: ThemeConfig = {
    token: {
        colorPrimary: "#1890ff",
        colorSuccess: "#52c41a",
        colorWarning: "#faad14",
        colorError: "#f5222d",
        colorInfo: "#1890ff",
        colorTextBase: "#ffffff",
        colorBgBase: "#111827",
        colorBgContainer: "#1f2937",
        borderRadius: 4,
        fontSize: 14,
        lineHeight: 1.5715,
    },
    components: {
        Button: {
            controlHeight: 40,
            borderRadius: 4,
            primaryColor: "#1890ff",
        },
        Card: {
            borderRadiusLG: 8,
            boxShadowSecondary:
                "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)",
        },
        Input: {
            controlHeight: 40,
            borderRadius: 4,
        },
        Select: {
            controlHeight: 40,
            borderRadius: 4,
        },
        DatePicker: {
            controlHeight: 40,
            borderRadius: 4,
        },
        Table: {
            borderRadius: 4,
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        },
        Layout: {
            headerHeight: 64,
            headerPadding: "0 24px",
            headerColor: "#111827",
            bodyBg: "#f5f5f5",
            footerBg: "#f8f9fa",
            footerPadding: "24px 50px",
        },
        Menu: {
            itemSelectedBg: "#e6f7ff",
            itemSelectedColor: "#1890ff",
        },
    },
};

export const lightTheme: ThemeConfig = {
    token: {
        colorPrimary: "#1890ff",
        colorSuccess: "#52c41a",
        colorWarning: "#faad14",
        colorError: "#f5222d",
        colorInfo: "#1890ff",
        colorTextBase: "#111827",
        colorBgBase: "#fafafa",
        colorBgContainer: "#ffffff",
        borderRadius: 4,
        fontSize: 14,
        lineHeight: 1.5715,
    },
    components: {
        Button: {
            controlHeight: 40,
            borderRadius: 4,
        },
        Card: {
            borderRadiusLG: 8,
        },
        Layout: {
            headerHeight: 64,
        },
    },
};

// Custom CSS variables for styling
export const cssVariables = {
    primaryColor: "#1890ff",
    successColor: "#52c41a",
    warningColor: "#faad14",
    errorColor: "#f5222d",
    infoColor: "#1890ff",
    textPrimary: "#111827",
    textSecondary: "#6b7280",
    textMuted: "#9ca3af",
    borderColor: "#e5e7eb",
    bgPrimary: "#ffffff",
    bgSecondary: "#f9fafb",
    bgTertiary: "#f3f4f6",
};
