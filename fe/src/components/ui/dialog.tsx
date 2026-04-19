import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
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
        <div className="fixed inset-0 z-[1800] flex items-center justify-center p-4">
            <button
                aria-label="Close dialog"
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                onClick={onClose}
                type="button"
            />
            <div
                className={cn(
                    "relative z-[1] w-full max-w-2xl rounded-[var(--app-radius-xl)] border border-border bg-card text-card-foreground shadow-2xl",
                    className,
                )}
            >
                <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
                    <div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                        {description ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    <button
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>,
        document.body,
    );
};
