import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SheetProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    side?: "left" | "right";
    children: React.ReactNode;
    className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
    open,
    onClose,
    title,
    description,
    side = "right",
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
        <div className="fixed inset-0 z-[1700]">
            <button
                aria-label="Close panel"
                className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
                onClick={onClose}
                type="button"
            />
            <div
                className={cn(
                    "absolute top-0 flex h-full w-full max-w-md flex-col border-border bg-card text-card-foreground shadow-2xl",
                    side === "right"
                        ? "right-0 rounded-l-[var(--app-radius-xl)] border-l"
                        : "left-0 rounded-r-[var(--app-radius-xl)] border-r",
                    className,
                )}
            >
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                    <div>
                        <h2 className="text-base font-semibold">{title}</h2>
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
                <div className="flex-1 overflow-y-auto p-5">{children}</div>
            </div>
        </div>,
        document.body,
    );
};
