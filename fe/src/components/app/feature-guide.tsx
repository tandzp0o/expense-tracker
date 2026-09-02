import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LucideIcon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { hexToRgba } from "../../lib/utils";
import { useTheme } from "../../contexts/ThemeContext";
import { Button } from "../ui/button";
import { Dialog, DialogFooter } from "../ui/dialog";

export interface FeatureGuideSlide {
    icon: LucideIcon;
    title: string;
    description: string;
    bullets: { icon: LucideIcon; label: string }[];
}

export interface FeatureGuideCopy {
    eyebrow: string;
    title: string;
    description: string;
    /** Label of the primary call to action, e.g. "Tạo ngân sách". */
    actionLabel: string;
    slides: FeatureGuideSlide[];
}

interface FeatureGuideDialogProps {
    open: boolean;
    copy: FeatureGuideCopy;
    icon: LucideIcon;
    isVietnamese: boolean;
    onSkip: () => void;
    onAction: () => void;
}

const guideStorageKey = (uid: string, feature: string) =>
    `tonfin-guide:${uid}:${feature}`;

/**
 * First-visit guide state for one feature screen. The dialog opens once per
 * account per feature; dismissing it (either button) never shows it again
 * unless the user reopens it from the page itself.
 */
export const useFeatureGuide = (feature: string, enabled: boolean) => {
    const { currentUser } = useAuth();
    const [open, setOpen] = useState(false);
    const storageKey = currentUser?.uid
        ? guideStorageKey(currentUser.uid, feature)
        : "";

    useEffect(() => {
        if (!enabled || !storageKey) {
            return;
        }

        if (window.localStorage.getItem(storageKey) === "seen") {
            return;
        }

        setOpen(true);
    }, [enabled, storageKey]);

    const dismiss = useCallback(() => {
        if (storageKey) {
            window.localStorage.setItem(storageKey, "seen");
        }
        setOpen(false);
    }, [storageKey]);

    const reopen = useCallback(() => setOpen(true), []);

    return { open, dismiss, reopen };
};

export const FeatureGuideDialog: React.FC<FeatureGuideDialogProps> = ({
    open,
    copy,
    icon,
    isVietnamese,
    onSkip,
    onAction,
}) => {
    const { appearance } = useTheme();
    const primaryColor = appearance.primaryColor;
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (open) {
            setIndex(0);
        }
    }, [open]);

    const slide = useMemo(
        () => copy.slides[Math.min(index, copy.slides.length - 1)],
        [copy.slides, index],
    );

    if (!slide) {
        return null;
    }

    const isLast = index === copy.slides.length - 1;
    const SlideIcon = slide.icon;

    return (
        <Dialog
            description={copy.description}
            eyebrow={copy.eyebrow}
            icon={icon}
            onClose={onSkip}
            open={open}
            title={copy.title}
            tone="wallet"
        >
            <div className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-start gap-3.5">
                    <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--app-radius-md)]"
                        style={{
                            backgroundColor: hexToRgba(primaryColor, 0.12),
                            color: primaryColor,
                        }}
                    >
                        <SlideIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground sm:text-lg">
                            {slide.title}
                        </h3>
                        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                            {slide.description}
                        </p>
                    </div>
                </div>

                <ul className="flex flex-col gap-2">
                    {slide.bullets.map((bullet) => {
                        const BulletIcon = bullet.icon;

                        return (
                            <li
                                className="flex items-center gap-3 rounded-[var(--app-radius-md)] border border-border/70 bg-muted/30 px-3 py-2.5"
                                key={bullet.label}
                            >
                                <BulletIcon
                                    className="h-4 w-4 shrink-0"
                                    style={{ color: primaryColor }}
                                />
                                <span className="text-sm text-foreground/90">
                                    {bullet.label}
                                </span>
                            </li>
                        );
                    })}
                </ul>

                <div className="flex items-center justify-center gap-1.5 pt-1">
                    {copy.slides.map((item, slideIndex) => (
                        <button
                            aria-label={`${isVietnamese ? "Bước" : "Step"} ${slideIndex + 1}`}
                            className="h-1.5 rounded-full transition-all"
                            key={item.title}
                            onClick={() => setIndex(slideIndex)}
                            style={{
                                width: slideIndex === index ? 22 : 8,
                                backgroundColor:
                                    slideIndex === index
                                        ? primaryColor
                                        : hexToRgba(primaryColor, 0.22),
                            }}
                            type="button"
                        />
                    ))}
                </div>
            </div>

            <DialogFooter>
                <Button
                    className="w-full sm:w-auto"
                    onClick={onSkip}
                    variant="ghost"
                >
                    {isVietnamese ? "Để sau" : "Maybe later"}
                </Button>
                {!isLast ? (
                    <Button
                        className="w-full sm:w-auto"
                        onClick={() => setIndex((current) => current + 1)}
                        variant="outline"
                    >
                        {isVietnamese ? "Tiếp tục" : "Next"}
                    </Button>
                ) : null}
                <Button className="w-full sm:w-auto" onClick={onAction}>
                    {copy.actionLabel}
                </Button>
            </DialogFooter>
        </Dialog>
    );
};

export default FeatureGuideDialog;
