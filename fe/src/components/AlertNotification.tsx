import React from "react";
import { ConfirmDialog } from "./ui/confirm-dialog";

interface AlertNotificationProps {
    visible: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    content: string;
    confirmText?: string;
    cancelText?: string;
    type?: "warning" | "error";
}

const AlertNotification: React.FC<AlertNotificationProps> = ({
    visible,
    onConfirm,
    onCancel,
    title,
    content,
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = "warning",
}) => (
    <ConfirmDialog
        cancelLabel={cancelText}
        confirmLabel={confirmText}
        description={content}
        onClose={onCancel}
        onConfirm={onConfirm}
        open={visible}
        title={title}
        variant={type === "error" ? "destructive" : "default"}
    />
);

export default AlertNotification;
