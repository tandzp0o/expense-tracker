import React, { useMemo, useState } from "react";
import { Check, Palette } from "lucide-react";
import {
    AppearanceSettings,
    FontPreset,
    FontScale,
    RadiusPreset,
    ThemeMode,
    useTheme,
} from "../contexts/ThemeContext";
import { useLocale } from "../contexts/LocaleContext";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Sheet } from "./ui/sheet";
import { cn } from "../lib/utils";

const colorPresets = [
    "#2563eb",
    "#0f766e",
    "#7c3aed",
    "#dc2626",
    "#ea580c",
    "#0891b2",
];

const fontPresets: Array<{ label: string; value: FontPreset; preview: string }> =
    [
        { label: "Sans", value: "sans", preview: "Modern UI" },
        { label: "Serif", value: "serif", preview: "Editorial" },
        { label: "Mono", value: "mono", preview: "System log" },
        { label: "Rounded", value: "rounded", preview: "Friendly" },
    ];

const fontScales: Array<{ label: string; value: FontScale }> = [
    { label: "S", value: "sm" },
    { label: "M", value: "md" },
    { label: "L", value: "lg" },
];

const radiusPresets: Array<{
    value: RadiusPreset;
    preview: string;
}> = [
    { value: "compact", preview: "12px" },
    { value: "balanced", preview: "20px" },
    { value: "rounded", preview: "28px" },
];

const ThemePanel: React.FC<{
    appearance: AppearanceSettings;
    onApply: (updates: Partial<AppearanceSettings>) => void;
    onReset: () => void;
}> = ({ appearance, onApply, onReset }) => {
    const { isVietnamese } = useLocale();
    const previewStyle = useMemo(
        () => ({
            background: `linear-gradient(135deg, ${appearance.primaryColor}, rgba(15, 23, 42, 0.86))`,
            borderRadius: "var(--app-radius-lg)",
        }),
        [appearance.primaryColor],
    );

    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <CardTitle>
                        {isVietnamese ? "Giao diện" : "Appearance"}
                    </CardTitle>
                    <CardDescription>
                        {isVietnamese
                            ? "Người dùng có thể chỉnh chế độ sáng tối, màu chủ đạo, font chữ, cỡ chữ và độ bo góc."
                            : "User can tune mode, primary color, font family, base font size and corner radius."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div>
                        <p className="mb-2 text-sm font-medium">
                            {isVietnamese ? "Chế độ" : "Mode"}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {(["light", "dark"] as ThemeMode[]).map((mode) => (
                                <Button
                                    key={mode}
                                    className="justify-between"
                                    onClick={() => onApply({ mode })}
                                    variant={appearance.mode === mode ? "default" : "outline"}
                                >
                                    <span>
                                        {mode === "light"
                                            ? isVietnamese
                                                ? "Sáng"
                                                : "Light"
                                            : isVietnamese
                                              ? "Tối"
                                              : "Dark"}
                                    </span>
                                    {appearance.mode === mode ? (
                                        <Check className="h-4 w-4" />
                                    ) : null}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                                {isVietnamese ? "Màu chủ đạo" : "Primary color"}
                            </p>
                            <Input
                                className="h-9 w-28"
                                onChange={(event) =>
                                    onApply({ primaryColor: event.target.value })
                                }
                                type="color"
                                value={appearance.primaryColor}
                            />
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {colorPresets.map((color) => (
                                <button
                                    key={color}
                                    className={cn(
                                        "h-10 rounded-[var(--app-radius-md)] border transition-transform hover:scale-[1.03]",
                                        appearance.primaryColor === color
                                            ? "border-foreground"
                                            : "border-border",
                                    )}
                                    onClick={() => onApply({ primaryColor: color })}
                                    style={{ backgroundColor: color }}
                                    type="button"
                                >
                                    <span className="sr-only">{color}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium">
                            {isVietnamese ? "Font chữ" : "Font family"}
                        </p>
                        <div className="grid gap-2">
                            {fontPresets.map((font) => (
                                <button
                                    key={font.value}
                                    className={cn(
                                        "flex items-center justify-between rounded-[var(--app-radius-lg)] border px-3 py-3 text-left transition-colors",
                                        appearance.fontPreset === font.value
                                            ? "border-primary bg-primary-soft"
                                            : "border-border hover:bg-muted/70",
                                    )}
                                    onClick={() =>
                                        onApply({ fontPreset: font.value })
                                    }
                                    type="button"
                                >
                                    <div>
                                        <p className="text-sm font-medium">{font.label}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {font.preview}
                                        </p>
                                    </div>
                                    {appearance.fontPreset === font.value ? (
                                        <Check className="h-4 w-4 text-primary" />
                                    ) : null}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium">
                            {isVietnamese ? "Cỡ chữ" : "Font size"}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {fontScales.map((scale) => (
                                <Button
                                    key={scale.value}
                                    onClick={() => onApply({ fontScale: scale.value })}
                                    variant={
                                        appearance.fontScale === scale.value
                                            ? "default"
                                            : "outline"
                                    }
                                >
                                    {scale.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium">
                            {isVietnamese ? "Bo góc" : "Corner radius"}
                        </p>
                        <div className="grid gap-2 md:grid-cols-3">
                            {radiusPresets.map((preset) => {
                                const title =
                                    preset.value === "compact"
                                        ? isVietnamese
                                            ? "Gọn"
                                            : "Compact"
                                        : preset.value === "balanced"
                                          ? isVietnamese
                                              ? "Cân bằng"
                                              : "Balanced"
                                          : isVietnamese
                                            ? "Tròn nhiều"
                                            : "Rounded";

                                const description =
                                    preset.value === "compact"
                                        ? isVietnamese
                                            ? "Cạnh gọn hơn"
                                            : "Tighter corners"
                                        : preset.value === "balanced"
                                          ? isVietnamese
                                              ? "Mặc định mềm"
                                              : "Default feel"
                                          : isVietnamese
                                            ? "Bo góc mạnh hơn"
                                            : "More rounded";

                                return (
                                    <button
                                        key={preset.value}
                                        className={cn(
                                            "flex items-center justify-between rounded-[var(--app-radius-lg)] border px-3 py-3 text-left transition-colors",
                                            appearance.radiusPreset === preset.value
                                                ? "border-primary bg-primary-soft"
                                                : "border-border hover:bg-muted/70",
                                        )}
                                        onClick={() =>
                                            onApply({ radiusPreset: preset.value })
                                        }
                                        type="button"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{title}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {description}
                                            </p>
                                        </div>
                                        <div
                                            className="h-10 w-10 border border-border/80 bg-background"
                                            style={{ borderRadius: preset.preview }}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <Button onClick={onReset} variant="ghost">
                        {isVietnamese ? "Khôi phục mặc định" : "Reset to default"}
                    </Button>
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    <div className="p-6 text-white" style={previewStyle}>
                        <p className="text-xs uppercase tracking-[0.16em] text-white/75">
                            {isVietnamese ? "Xem trước" : "Live preview"}
                        </p>
                        <h3 className="mt-3 text-2xl font-semibold">
                            {isVietnamese
                                ? "Không gian cá nhân"
                                : "Personal workspace"}
                        </h3>
                        <p className="mt-2 max-w-sm text-sm text-white/80">
                            {isVietnamese
                                ? "Thiết lập giao diện được lưu vào local storage để ứng dụng luôn mở lại theo tùy chọn gần nhất."
                                : "Theme settings are persisted in local storage so the dashboard opens with the user preference already applied."}
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <div
                                className="border border-white/20 bg-white/10 p-4"
                                style={{ borderRadius: "var(--app-radius-lg)" }}
                            >
                                <div
                                    className="h-3 w-16 bg-white/80"
                                    style={{ borderRadius: "999px" }}
                                />
                                <div
                                    className="mt-3 h-10 bg-white/20"
                                    style={{ borderRadius: "var(--app-radius-md)" }}
                                />
                            </div>
                            <div
                                className="border border-white/20 bg-white/10 p-4"
                                style={{ borderRadius: "var(--app-radius-lg)" }}
                            >
                                <div
                                    className="h-10 bg-white text-slate-900"
                                    style={{ borderRadius: "var(--app-radius-md)" }}
                                >
                                    <div className="flex h-full items-center justify-center text-xs font-semibold">
                                        {isVietnamese ? "Nút mẫu" : "Sample button"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const ThemeSwitcher: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
    const { appearance, resetAppearance, updateAppearance } = useTheme();
    const { isVietnamese } = useLocale();
    const [open, setOpen] = useState(false);

    if (embedded) {
        return (
            <ThemePanel
                appearance={appearance}
                onApply={updateAppearance}
                onReset={resetAppearance}
            />
        );
    }

    return (
        <>
            <Button onClick={() => setOpen(true)} variant="outline">
                <Palette className="h-4 w-4" />
                <span>{isVietnamese ? "Giao diện" : "Appearance"}</span>
            </Button>

            <Sheet
                description={
                    isVietnamese
                        ? "Tùy chỉnh màu chủ đạo, chế độ sáng tối, font, cỡ chữ và bo góc."
                        : "Customize primary color, mode, font, size and corner radius."
                }
                onClose={() => setOpen(false)}
                open={open}
                title={isVietnamese ? "Cài đặt giao diện" : "Appearance settings"}
            >
                <ThemePanel
                    appearance={appearance}
                    onApply={updateAppearance}
                    onReset={resetAppearance}
                />
            </Sheet>
        </>
    );
};

export default ThemeSwitcher;
