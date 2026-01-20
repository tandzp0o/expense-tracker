import React from "react";
import { Modal, message } from "antd";

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
    confirmText = "Xác nhận",
    cancelText = "Hủy",
    type = "warning",
}) => {
    return (
        <Modal
            open={visible}
            onCancel={onCancel}
            footer={[
                <button
                    key="cancel"
                    onClick={onCancel}
                    style={{
                        backgroundColor:
                            type === "error" ? "#cfceceff" : "#faad14",
                        color: "black",
                        border: "none",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        marginRight: "10px",
                    }}
                >
                    {cancelText}
                </button>,
                <button
                    key="confirm"
                    onClick={onConfirm}
                    style={{
                        backgroundColor:
                            type === "error" ? "#ff4d4f" : "#faad14",
                        color: "white",
                        border: "none",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        cursor: "pointer",
                    }}
                >
                    {confirmText}
                </button>,
            ]}
            title={title}
            width={400}
        >
            <p style={{ fontSize: 16, lineHeight: 1.5 }}>{content}</p>
        </Modal>
    );
};

export default AlertNotification;
