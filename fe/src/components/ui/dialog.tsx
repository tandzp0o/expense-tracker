import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, LucideIcon, X } from "lucide-react";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";
import { cn } from "../../lib/utils";
import { Button } from "./button";

type DialogTone =
    | "default"
    | "transaction"
    | "wallet"
    | "budget"
    | "goal"
    | "dish"
    | "warning"
    | "destructive";

const dialogToneClassNames: Record<
    DialogTone,
    {
        glow: string;
        icon: string;
        eyebrow: string;
    }
> = {
    default: {
        glow: "from-primary/16 via-primary/6 to-transparent",
        icon: "border-primary/15 bg-primary/10 text-primary",
        eyebrow: "border-border/70 bg-background/80 text-muted-foreground",
    },
    transaction: {
        glow: "from-emerald-500/18 via-cyan-500/10 to-transparent",
        icon: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        eyebrow:
            "border-emerald-500/18 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    wallet: {
        glow: "from-sky-500/18 via-amber-400/10 to-transparent",
        icon: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        eyebrow: "border-sky-500/18 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    budget: {
        glow: "from-amber-500/18 via-orange-500/10 to-transparent",
        icon: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        eyebrow:
            "border-amber-500/18 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    goal: {
        glow: "from-cyan-500/18 via-blue-500/10 to-transparent",
        icon: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
        eyebrow: "border-cyan-500/18 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    },
    dish: {
        glow: "from-rose-500/18 via-orange-500/10 to-transparent",
        icon: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        eyebrow: "border-rose-500/18 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
    warning: {
        glow: "from-amber-500/20 via-yellow-500/10 to-transparent",
        icon: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        eyebrow:
            "border-amber-500/18 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    destructive: {
        glow: "from-rose-500/20 via-red-500/12 to-transparent",
        icon: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        eyebrow: "border-rose-500/18 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
};

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
    tone?: DialogTone;
    icon?: LucideIcon;
    eyebrow?: string;
}

export const Dialog: React.FC<DialogProps> = ({
    open,
    onClose,
    title,
    description,
    children,
    className,
    tone = "default",
    icon: Icon,
    eyebrow,
}) => {
    useLockBodyScroll(open);
    const toneClasses = dialogToneClassNames[tone];

    useEffect(() => {
        if (!open) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose, open]);

    if (!open || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[1800] flex items-end justify-center overscroll-none p-2.5 pt-8 sm:items-center sm:p-4">
            <button
                aria-label="Close dialog"
                className="absolute inset-0 touch-none bg-slate-950/60 backdrop-blur-sm sm:bg-slate-950/50"
                onClick={onClose}
                type="button"
            />
            <div
                className={cn(
                    "relative z-[1] flex max-h-[calc(100vh-0.5rem)] w-full max-w-2xl flex-col overflow-hidden border border-border/80 bg-card text-card-foreground shadow-[0_24px_80px_-32px_rgba(15,23,42,0.42)] sm:max-h-[calc(100vh-2rem)]",
                    "rounded-t-[calc(var(--app-radius-xl)+4px)] sm:rounded-[var(--app-radius-xl)]",
                    className,
                )}
                data-spotlight-boundary="dialog"
                role="dialog"
                aria-modal="true"
            >
                <div className="mx-auto mt-2.5 h-1 w-11 rounded-full bg-muted-foreground/20 sm:hidden" />
                <div className="relative overflow-hidden border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4 lg:px-6 lg:py-5">
                    <div
                        className={cn(
                            "pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-br",
                            toneClasses.glow,
                        )}
                    />
                    <div className="pointer-events-none absolute -right-12 top-0 h-24 w-24 rounded-full bg-white/25 blur-3xl dark:bg-white/10" />
                    <div className="relative flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3.5">
                            {Icon ? (
                                <div
                                    className={cn(
                                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm sm:h-12 sm:w-12",
                                        toneClasses.icon,
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                </div>
                            ) : null}
                            <div className="min-w-0">
                                {eyebrow ? (
                                    <span
                                        className={cn(
                                            "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                                            toneClasses.eyebrow,
                                        )}
                                    >
                                        {eyebrow}
                                    </span>
                                ) : null}
                                <h2 className="mt-2 text-base font-semibold tracking-tight sm:text-lg">
                                    {title}
                                </h2>
                                {description ? (
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
                                        {description}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <button
                            className="shrink-0 rounded-full border border-border/70 bg-background/70 p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            onClick={onClose}
                            type="button"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="overflow-y-auto overscroll-contain bg-muted/[0.16] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.875rem)] pt-4 sm:p-5 lg:p-6">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
};

interface DialogSectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export const DialogSection: React.FC<DialogSectionProps> = ({
    title,
    description,
    children,
    className,
}) => (
    <section
        className={cn(
            "rounded-[calc(var(--app-radius-xl)+2px)] border border-border/70 bg-background/90 p-3.5 shadow-sm sm:p-4",
            className,
        )}
    >
        <div className="mb-3">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
            {description ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            ) : null}
        </div>
        <div className="space-y-3">{children}</div>
    </section>
);

interface DialogFooterProps {
    children: React.ReactNode;
    className?: string;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({
    children,
    className,
}) => (
    <div
        className={cn(
            "sticky bottom-0 z-[1] flex flex-col-reverse gap-2 rounded-[calc(var(--app-radius-xl)+2px)] border border-border/70 bg-background/95 p-2.5 shadow-[0_-16px_28px_-28px_rgba(15,23,42,0.8)] backdrop-blur-sm sm:flex-row sm:justify-end sm:gap-3 sm:p-3",
            className,
        )}
    >
        {children}
    </div>
);

export interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
    busy?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "default",
    busy = false,
}) => {
    const isEnglish =
        typeof document !== "undefined" && document.documentElement.lang === "en";
    const busyLabel = isEnglish ? "Working..." : "\u0110ang x\u1eed l\u00fd...";

    return (
        <Dialog
            description={description}
            eyebrow={
                variant === "destructive"
                    ? isEnglish
                        ? "Sensitive action"
                        : "Thao t\u00e1c nh\u1ea1y c\u1ea3m"
                    : isEnglish
                      ? "Please review"
                      : "Vui l\u00f2ng xem l\u1ea1i"
            }
            icon={AlertTriangle}
            onClose={onClose}
            open={open}
            title={title}
            tone={variant === "destructive" ? "destructive" : "warning"}
        >
            <DialogFooter>
                <Button
                    className="w-full sm:w-auto"
                    disabled={busy}
                    onClick={onClose}
                    variant="outline"
                >
                    {cancelLabel}
                </Button>
                <Button
                    className="w-full sm:w-auto"
                    disabled={busy}
                    onClick={() => void onConfirm()}
                    variant={variant === "destructive" ? "destructive" : "default"}
                >
                    {busy ? busyLabel : confirmLabel}
                </Button>
            </DialogFooter>
        </Dialog>
    );
};
