import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import { theme as antdTheme } from "antd";

export type ThemeType = "light" | "dark" | "custom";

export interface CustomTheme {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    secondaryColor: string;
    accentColor: string;
}

export interface ThemeContextType {
    theme: ThemeType;
    customTheme: CustomTheme;
    setTheme: (theme: ThemeType) => void;
    setCustomTheme: (customTheme: CustomTheme) => void;
    antdTheme: any;
}

const defaultCustomTheme: CustomTheme = {
    primaryColor: "#667eea",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    secondaryColor: "#f1f5f9",
    accentColor: "#06b6d4",
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const hexToRgba = (hex: string, alpha: number) => {
    const cleaned = hex.replace("#", "").trim();
    if (![3, 6].includes(cleaned.length)) {
        return `rgba(0, 0, 0, ${alpha})`;
    }

    const full =
        cleaned.length === 3
            ? cleaned
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : cleaned;

    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setTheme] = useState<ThemeType>(() => {
        const saved = localStorage.getItem("app-theme");
        return (saved as ThemeType) || "light";
    });

    const [customTheme, setCustomTheme] = useState<CustomTheme>(() => {
        const saved = localStorage.getItem("app-custom-theme");
        return saved ? JSON.parse(saved) : defaultCustomTheme;
    });

    useEffect(() => {
        localStorage.setItem("app-theme", theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem("app-custom-theme", JSON.stringify(customTheme));
    }, [customTheme]);

    useEffect(() => {
        const root = document.documentElement;

        const base =
            theme === "custom"
                ? {
                      primaryColor: customTheme.primaryColor,
                      backgroundColor: customTheme.backgroundColor,
                      textColor: customTheme.textColor,
                      secondaryColor: customTheme.secondaryColor,
                      accentColor: customTheme.accentColor,
                  }
                : theme === "dark"
                  ? {
                        primaryColor: "#1890ff",
                        backgroundColor: "#0b1220",
                        textColor: "#e5e7eb",
                        secondaryColor: "#111a2c",
                        accentColor: "#06b6d4",
                    }
                  : {
                        primaryColor: "#1890ff",
                        backgroundColor: "#f5f7fb",
                        textColor: "#0f172a",
                        secondaryColor: "#ffffff",
                        accentColor: "#06b6d4",
                    };

        root.style.setProperty("--primary-color", base.primaryColor);
        root.style.setProperty("--bg-base", base.backgroundColor);
        root.style.setProperty("--bg-container", base.secondaryColor);
        root.style.setProperty("--text-base", base.textColor);
        root.style.setProperty("--secondary-color", base.secondaryColor);
        root.style.setProperty("--accent-color", base.accentColor);
        root.style.setProperty("--text-muted", hexToRgba(base.textColor, 0.74));
        root.style.setProperty(
            "--border-color",
            hexToRgba(base.textColor, 0.16),
        );
        root.style.setProperty(
            "--accent-alpha",
            hexToRgba(base.accentColor, 0.18),
        );
        root.style.setProperty("--sidenav-color", base.primaryColor);
    }, [theme, customTheme]);

    const getAntdTheme = () => {
        const baseTheme =
            theme === "dark"
                ? antdTheme.darkAlgorithm
                : antdTheme.defaultAlgorithm;

        if (theme === "custom") {
            return {
                algorithm: baseTheme,
                token: {
                    colorPrimary: customTheme.primaryColor,
                    colorBgBase: customTheme.backgroundColor,
                    colorBgLayout: customTheme.backgroundColor,
                    colorTextBase: customTheme.textColor,
                    colorText: customTheme.textColor,
                    colorTextSecondary: hexToRgba(customTheme.textColor, 0.72),
                    colorBgContainer: customTheme.secondaryColor,
                    colorBorder: hexToRgba(customTheme.textColor, 0.12),
                    colorBorderSecondary: hexToRgba(
                        customTheme.textColor,
                        0.12,
                    ),
                    colorLink: customTheme.accentColor,
                    colorLinkHover: customTheme.accentColor,
                    colorPrimaryHover: customTheme.accentColor,
                },
            };
        }

        if (theme === "dark") {
            return {
                algorithm: baseTheme,
                token: {
                    colorPrimary: "#1890ff",
                    colorBgBase: "#111827",
                    colorBgContainer: "#1f2937",
                    colorTextBase: "#ffffff",
                },
            };
        }

        return {
            algorithm: baseTheme,
            token: {
                colorPrimary: "#1890ff",
                colorBgBase: "#fafafa",
                colorBgContainer: "#ffffff",
                colorTextBase: "#111827",
            },
        };
    };

    const value: ThemeContextType = {
        theme,
        customTheme,
        setTheme,
        setCustomTheme,
        antdTheme: getAntdTheme(),
    };

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};
