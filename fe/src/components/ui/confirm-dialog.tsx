import React from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";

interface ConfirmDialogProps {
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
    const busyLabel =
        typeof document !== "undefined" && document.documentElement.lang === "en"
            ? "Working..."
            : "Đang xử lý...";

    return (
        <Dialog
            description={description}
            onClose={onClose}
            open={open}
            title={title}
        >
            <div className="flex justify-end gap-3">
                <Button disabled={busy} onClick={onClose} variant="outline">
                    {cancelLabel}
                </Button>
                <Button
                    disabled={busy}
                    onClick={() => void onConfirm()}
                    variant={variant === "destructive" ? "destructive" : "default"}
                >
                    {busy ? busyLabel : confirmLabel}
                </Button>
            </div>
        </Dialog>
    );
};
