import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";
import { cn } from "../../lib/utils";

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
    open,
    onClose,
    title,
    description,
    children,
    className,
}) => {
    useLockBodyScroll(open);

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
        <div className="fixed inset-0 z-[1800] flex items-end justify-center overscroll-none p-3 pt-10 sm:items-center sm:p-4">
            <button
                aria-label="Close dialog"
                className="absolute inset-0 touch-none bg-slate-950/60 backdrop-blur-sm sm:bg-slate-950/50"
                onClick={onClose}
                type="button"
            />
            <div
                className={cn(
                    "relative z-[1] flex max-h-[calc(100vh-0.75rem)] w-full max-w-2xl flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[calc(100vh-2rem)]",
                    "rounded-t-[calc(var(--app-radius-xl)+4px)] sm:rounded-[var(--app-radius-xl)]",
                    className,
                )}
                data-spotlight-boundary="dialog"
                role="dialog"
                aria-modal="true"
            >
                <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted-foreground/20 sm:hidden" />
                <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6 sm:py-5">
                    <div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                        {description ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    <button
                        className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 sm:p-6">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
};
