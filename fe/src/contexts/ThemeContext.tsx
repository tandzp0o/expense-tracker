import React, {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

export type ThemeMode = "light" | "dark";
export type FontPreset = "sans" | "serif" | "mono" | "rounded";
export type FontScale = "sm" | "md" | "lg";
export type RadiusPreset = "compact" | "balanced" | "rounded";

export interface AppearanceSettings {
    mode: ThemeMode;
    primaryColor: string;
    fontPreset: FontPreset;
    fontScale: FontScale;
    radiusPreset: RadiusPreset;
}

interface ThemeContextValue {
    appearance: AppearanceSettings;
    setMode: (mode: ThemeMode) => void;
    updateAppearance: (updates: Partial<AppearanceSettings>) => void;
    resetAppearance: () => void;
}

const STORAGE_KEY = "fintrack-appearance";

const DEFAULT_APPEARANCE: AppearanceSettings = {
    mode: "light",
    primaryColor: "#2563eb",
    fontPreset: "sans",
    fontScale: "md",
    radiusPreset: "balanced",
};

const FONT_PRESETS: Record<FontPreset, string> = {
    sans: '"Inter", "Segoe UI", sans-serif',
    serif: '"Georgia", "Times New Roman", serif',
    mono: '"JetBrains Mono", "Consolas", monospace',
    rounded: '"Trebuchet MS", "Segoe UI", sans-serif',
};

const FONT_SCALES: Record<FontScale, string> = {
    sm: "15px",
    md: "16px",
    lg: "17px",
};

const RADIUS_PRESETS: Record<
    RadiusPreset,
    { sm: string; md: string; lg: string; xl: string }
> = {
    compact: {
        sm: "8px",
        md: "10px",
        lg: "16px",
        xl: "20px",
    },
    balanced: {
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "30px",
    },
    rounded: {
        sm: "18px",
        md: "22px",
        lg: "32px",
        xl: "40px",
    },
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const clampHex = (value: string) => {
    const normalized = value.trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)
        ? normalized
        : DEFAULT_APPEARANCE.primaryColor;
};

const expandHex = (value: string) => {
    const normalized = clampHex(value).replace("#", "");
    if (normalized.length === 3) {
        return normalized
            .split("")
            .map((char) => `${char}${char}`)
            .join("");
    }
    return normalized;
};

const hexToRgb = (value: string) => {
    const expanded = expandHex(value);
    return {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16),
    };
};

export const hexToRgba = (value: string, alpha: number) => {
    const { r, g, b } = hexToRgb(value);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getContrastColor = (value: string) => {
    const { r, g, b } = hexToRgb(value);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? "#0f172a" : "#ffffff";
};

const applyAppearance = (appearance: AppearanceSettings) => {
    const root = document.documentElement;
    root.dataset.theme = appearance.mode;
    root.style.setProperty("--app-primary", clampHex(appearance.primaryColor));
    root.style.setProperty(
        "--app-primary-foreground",
        getContrastColor(appearance.primaryColor),
    );
    root.style.setProperty(
        "--app-primary-soft",
        hexToRgba(appearance.primaryColor, 0.14),
    );
    root.style.setProperty(
        "--app-primary-soft-strong",
        hexToRgba(appearance.primaryColor, 0.24),
    );
    root.style.setProperty("--app-ring", hexToRgba(appearance.primaryColor, 0.3));
    root.style.setProperty(
        "--app-font-family",
        FONT_PRESETS[appearance.fontPreset],
    );
    root.style.setProperty("--app-font-size", FONT_SCALES[appearance.fontScale]);
    root.style.setProperty(
        "--app-radius-sm",
        RADIUS_PRESETS[appearance.radiusPreset].sm,
    );
    root.style.setProperty(
        "--app-radius-md",
        RADIUS_PRESETS[appearance.radiusPreset].md,
    );
    root.style.setProperty(
        "--app-radius-lg",
        RADIUS_PRESETS[appearance.radiusPreset].lg,
    );
    root.style.setProperty(
        "--app-radius-xl",
        RADIUS_PRESETS[appearance.radiusPreset].xl,
    );
    root.style.colorScheme = appearance.mode;
};

const readInitialAppearance = (): AppearanceSettings => {
    if (typeof window === "undefined") {
        return DEFAULT_APPEARANCE;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return DEFAULT_APPEARANCE;
        }
        const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
        return {
            mode: parsed.mode === "dark" ? "dark" : "light",
            primaryColor: clampHex(
                parsed.primaryColor || DEFAULT_APPEARANCE.primaryColor,
            ),
            fontPreset:
                parsed.fontPreset && parsed.fontPreset in FONT_PRESETS
                    ? parsed.fontPreset
                    : DEFAULT_APPEARANCE.fontPreset,
            fontScale:
                parsed.fontScale && parsed.fontScale in FONT_SCALES
                    ? parsed.fontScale
                    : DEFAULT_APPEARANCE.fontScale,
            radiusPreset:
                parsed.radiusPreset && parsed.radiusPreset in RADIUS_PRESETS
                    ? parsed.radiusPreset
                    : DEFAULT_APPEARANCE.radiusPreset,
        };
    } catch {
        return DEFAULT_APPEARANCE;
    }
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [appearance, setAppearance] =
        useState<AppearanceSettings>(readInitialAppearance);

    useEffect(() => {
        applyAppearance(appearance);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
    }, [appearance]);

    const value = useMemo<ThemeContextValue>(
        () => ({
            appearance,
            setMode: (mode) =>
                setAppearance((current) => ({
                    ...current,
                    mode,
                })),
            updateAppearance: (updates) =>
                setAppearance((current) => ({
                    ...current,
                    ...updates,
                    primaryColor: updates.primaryColor
                        ? clampHex(updates.primaryColor)
                        : current.primaryColor,
                    radiusPreset:
                        updates.radiusPreset &&
                        updates.radiusPreset in RADIUS_PRESETS
                            ? updates.radiusPreset
                            : current.radiusPreset,
                })),
            resetAppearance: () => setAppearance(DEFAULT_APPEARANCE),
        }),
        [appearance],
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return context;
};
