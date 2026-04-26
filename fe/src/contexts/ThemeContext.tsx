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
    secondaryColor?: string;
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

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const clampHex = (value: string) => {
    const normalized = value.trim();
    return HEX_COLOR_PATTERN.test(normalized)
        ? normalized
        : DEFAULT_APPEARANCE.primaryColor;
};

const normalizeOptionalHex = (value?: string | null) => {
    if (!value) {
        return undefined;
    }

    const normalized = value.trim();
    return HEX_COLOR_PATTERN.test(normalized) ? normalized : undefined;
};

export const getAppearanceSecondaryColor = (
    appearance: Pick<AppearanceSettings, "primaryColor" | "secondaryColor">,
) => normalizeOptionalHex(appearance.secondaryColor) || clampHex(appearance.primaryColor);

export const getAppearanceGradientColors = (
    appearance: Pick<AppearanceSettings, "primaryColor" | "secondaryColor">,
) => ({
    primary: clampHex(appearance.primaryColor),
    secondary: getAppearanceSecondaryColor(appearance),
});

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

const mixHexColors = (
    colors: Array<{ color: string; weight: number }>,
) => {
    const totalWeight = colors.reduce((total, item) => total + item.weight, 0);
    const mixed = colors.reduce(
        (total, item) => {
            const rgb = hexToRgb(item.color);
            return {
                r: total.r + rgb.r * item.weight,
                g: total.g + rgb.g * item.weight,
                b: total.b + rgb.b * item.weight,
            };
        },
        { r: 0, g: 0, b: 0 },
    );

    return `rgb(${Math.round(mixed.r / totalWeight)}, ${Math.round(
        mixed.g / totalWeight,
    )}, ${Math.round(mixed.b / totalWeight)})`;
};

const applyAppearance = (appearance: AppearanceSettings) => {
    const root = document.documentElement;
    const { primary, secondary } = getAppearanceGradientColors(appearance);
    const contentPanelBackground =
        appearance.mode === "dark"
            ? mixHexColors([
                  { color: "#0b1220", weight: 0.76 },
                  { color: primary, weight: 0.1 },
                  { color: secondary, weight: 0.14 },
              ])
            : mixHexColors([
                  { color: "#f3f8f4", weight: 0.72 },
                  { color: primary, weight: 0.11 },
                  { color: secondary, weight: 0.17 },
              ]);
    const mainSurfaceBackground =
        appearance.mode === "dark"
            ? mixHexColors([
                  { color: "#0c1727", weight: 0.7 },
                  { color: primary, weight: 0.12 },
                  { color: secondary, weight: 0.18 },
              ])
            : mixHexColors([
                  { color: "#eef6ef", weight: 0.64 },
                  { color: primary, weight: 0.14 },
                  { color: secondary, weight: 0.22 },
              ]);
    const pageBackground =
        appearance.mode === "dark"
            ? [
                  `radial-gradient(circle at 12% 8%, ${hexToRgba(primary, 0.34)}, transparent 28%)`,
                  `radial-gradient(circle at 88% 10%, ${hexToRgba(secondary, 0.3)}, transparent 26%)`,
                  `radial-gradient(circle at 48% 105%, ${hexToRgba(secondary, 0.18)}, transparent 34%)`,
                  "linear-gradient(180deg, rgba(6, 11, 22, 0.98) 0%, rgba(9, 17, 31, 0.96) 52%, rgba(2, 6, 23, 0.98) 100%)",
              ].join(", ")
            : [
                  `radial-gradient(circle at 10% 4%, ${hexToRgba(primary, 0.22)}, transparent 30%)`,
                  `radial-gradient(circle at 88% 2%, ${hexToRgba(secondary, 0.26)}, transparent 28%)`,
                  `radial-gradient(circle at 52% 112%, ${hexToRgba(secondary, 0.16)}, transparent 36%)`,
                  "linear-gradient(180deg, rgba(255, 251, 244, 0.94) 0%, rgba(243, 247, 255, 0.96) 48%, rgba(248, 250, 252, 0.98) 100%)",
              ].join(", ");

    root.dataset.theme = appearance.mode;
    root.style.setProperty("--app-primary", primary);
    root.style.setProperty("--app-secondary", secondary);
    root.style.setProperty(
        "--app-primary-foreground",
        getContrastColor(primary),
    );
    root.style.setProperty(
        "--app-secondary-foreground",
        getContrastColor(secondary),
    );
    root.style.setProperty(
        "--app-primary-soft",
        hexToRgba(primary, 0.14),
    );
    root.style.setProperty(
        "--app-primary-soft-strong",
        hexToRgba(primary, 0.24),
    );
    root.style.setProperty(
        "--app-secondary-soft",
        hexToRgba(secondary, 0.14),
    );
    root.style.setProperty(
        "--app-secondary-soft-strong",
        hexToRgba(secondary, 0.24),
    );
    root.style.setProperty(
        "--app-gradient",
        `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
    );
    root.style.setProperty(
        "--app-gradient-soft",
        `linear-gradient(135deg, ${hexToRgba(primary, 0.18)} 0%, ${hexToRgba(
            secondary,
            0.24,
        )} 100%)`,
    );
    root.style.setProperty("--app-page-background", pageBackground);
    root.style.setProperty(
        "--app-content-panel-background",
        contentPanelBackground,
    );
    root.style.setProperty(
        "--app-main-surface-background",
        mainSurfaceBackground,
    );
    root.style.setProperty("--app-ring", hexToRgba(primary, 0.3));
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
            secondaryColor: normalizeOptionalHex(parsed.secondaryColor),
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
                setAppearance((current) => {
                    const hasSecondaryUpdate = Object.prototype.hasOwnProperty.call(
                        updates,
                        "secondaryColor",
                    );

                    return {
                        ...current,
                        ...updates,
                        primaryColor: updates.primaryColor
                            ? clampHex(updates.primaryColor)
                            : current.primaryColor,
                        secondaryColor: hasSecondaryUpdate
                            ? normalizeOptionalHex(updates.secondaryColor)
                            : current.secondaryColor,
                        fontPreset:
                            updates.fontPreset && updates.fontPreset in FONT_PRESETS
                                ? updates.fontPreset
                                : current.fontPreset,
                        fontScale:
                            updates.fontScale && updates.fontScale in FONT_SCALES
                                ? updates.fontScale
                                : current.fontScale,
                        radiusPreset:
                            updates.radiusPreset &&
                            updates.radiusPreset in RADIUS_PRESETS
                                ? updates.radiusPreset
                                : current.radiusPreset,
                    };
                }),
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
