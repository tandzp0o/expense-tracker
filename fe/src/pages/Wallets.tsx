import React, { useState, useEffect } from "react";
import {
    Alert,
    Card,
    Button,
    Table,
    Space,
    Modal,
    Form,
    Input,
    InputNumber,
    message,
    Select,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { walletApi } from "../services/api";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase/config";

interface Wallet {
    _id: string;
    userId: string;
    name: string;
    accountNumber?: string;
    description?: string;
    balance: number;
    initialBalance: number;
    createdAt: string;
    updatedAt: string;
}

const Wallets: React.FC = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
    const [loading, setLoading] = useState(false);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [totalBalance, setTotalBalance] = useState(0);
    const { currentUser, updateUserStatus, logout } = useAuth();
    const navigate = useNavigate();

    // Lấy danh sách ví từ API
    const fetchWallets = async () => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            console.error("Firebase user not available for fetching wallets.");
            return;
        }

        try {
            setLoading(true);
            const token = await firebaseUser.getIdToken();
            const response = await walletApi.getWallets(token);

            if (response && response.wallets) {
                setWallets(response.wallets);
                setTotalBalance(response.totalBalance || 0);
            }
        } catch (error: any) {
            console.error("Lỗi khi tải danh sách ví:", error);
            message.error(error.message || "Không thể tải danh sách ví");
        } finally {
            setLoading(false);
        }
    };

    // Gọi API khi component được mount
    useEffect(() => {
        if (currentUser) {
            fetchWallets();
        }
    }, [currentUser]);

    // Tạo mới hoặc cập nhật ví
    const handleSubmit = async (values: any) => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            message.error("Xác thực người dùng thất bại. Vui lòng đăng nhập lại.");
            return;
        }

        try {
            setLoading(true);
            const token = await firebaseUser.getIdToken();

            if (editingWallet) {
                await walletApi.updateWallet(editingWallet._id, values, token);
                message.success("Cập nhật ví thành công");
            } else {
                await walletApi.createWallet(values, token);
                message.success("Tạo ví đầu tiên thành công! Đang chuyển hướng bạn...");

                updateUserStatus(false);

                setTimeout(() => {
                    navigate('/');
                }, 1500);
            }

            setIsModalVisible(false);
            form.resetFields();
            await fetchWallets();
        } catch (error: any) {
            console.error("Lỗi khi lưu ví:", error);
            message.error(error.message || "Có lỗi xảy ra khi lưu ví");
        } finally {
            setLoading(false);
        }
    };

    // Xóa ví
    const handleDelete = async (id: string) => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) return;

        if (!window.confirm("Bạn có chắc chắn muốn xóa ví này?")) {
            return;
        }

        try {
            setLoading(true);
            const token = await firebaseUser.getIdToken();
            await walletApi.deleteWallet(id, token);
            message.success("Xóa ví thành công");
            await fetchWallets();
        } catch (error: any) {
            console.error("Lỗi khi xóa ví:", error);
            message.error(error.message || "Có lỗi xảy ra khi xóa ví");
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: "Tên ví", dataIndex: "name", key: "name" },
        { title: "Số tài khoản", dataIndex: "accountNumber", key: "accountNumber", render: (text: string) => text || "---" },
        { title: "Số dư", dataIndex: "balance", key: "balance", render: (balance: number) => (
            <span style={{ color: balance >= 0 ? "#389e0d" : "#cf1322" }}>
                {balance.toLocaleString("vi-VN")} VND
            </span>
        )},
        { title: "Thao tác", key: "action", render: (_: any, record: Wallet) => (
            <Space size="middle">
                <Button type="text" icon={<EditOutlined />} onClick={() => {
                    setEditingWallet(record);
                    form.setFieldsValue(record);
                    setIsModalVisible(true);
                }} />
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id)} />
            </Space>
        )},
    ];

    const showModal = () => {
        setEditingWallet(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    return (
        <div>
            {currentUser?.newUser && (
                <Alert
                    message="Chào mừng bạn đến với ứng dụng quản lý tài chính!"
                    description={
                        <div>
                            <p>Để bắt đầu, bạn cần tạo ví đầu tiên của mình (ví dụ: Tiền mặt, Ngân hàng...).</p>
                            <p>Vui lòng nhấn nút <strong>"Thêm ví mới"</strong> và điền thông tin.</p>
                            <p>Bạn sẽ không thể sử dụng các tính năng khác cho đến khi hoàn tất bước này.</p>
                            <Button type="link" danger onClick={logout} style={{ padding: 0 }}>
                                Đăng xuất
                            </Button>
                        </div>
                    }
                    type="info"
                    showIcon
                    closable={false}
                    style={{ marginBottom: 16 }}
                />
            )}
            <Card
                title={
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Danh sách ví</span>
                        <div>
                            <span style={{ marginRight: 16 }}>
                                <strong>Tổng số dư: </strong>
                                <span style={{ color: totalBalance >= 0 ? "#389e0d" : "#cf1322", fontWeight: "bold" }}>
                                    {totalBalance.toLocaleString("vi-VN")} VND
                                </span>
                            </span>
                            <Button type="primary" icon={<PlusOutlined />} onClick={showModal}>
                                Thêm ví mới
                            </Button>
                        </div>
                    </div>
                }
            >
                <Table
                    columns={columns}
                    dataSource={wallets}
                    rowKey="_id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    loading={loading}
                />
            </Card>
            <Modal
                title={editingWallet ? "Chỉnh sửa ví" : "Thêm ví mới"}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={[
                    <Button key="back" onClick={() => setIsModalVisible(false)} disabled={loading}>Hủy</Button>,
                    <Button key="submit" type="primary" loading={loading} onClick={() => form.submit()}>
                        {editingWallet ? "Cập nhật" : "Thêm mới"}
                    </Button>,
                ]}
            >
                <Form
                    form={form} // <-- ĐÂY LÀ DÒNG SỬA LỖI
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ initialBalance: 0 }}
                >
                    <Form.Item name="name" label="Tên ví" rules={[{ required: true, message: "Vui lòng nhập tên ví" }]}>
                        <Input placeholder="Ví dụ: Ví tiền mặt, Ngân hàng, Thẻ tín dụng..." />
                    </Form.Item>
                    <Form.Item name="accountNumber" label="Số tài khoản">
                        <Input placeholder="Nhập số tài khoản" />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={3} placeholder="Nhập mô tả ngắn về ví (nếu có)" />
                    </Form.Item>
                    {!editingWallet && (
                        <Form.Item name="initialBalance" label="Số dư ban đầu" rules={[{ required: true, message: "Vui lòng nhập số dư ban đầu" }]}>
                            <InputNumber
                                style={{ width: "100%" }}
                                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                parser={(value) => (value ? Number(value.replace(/[^0-9.-]+/g, "")) : 0) as 0}
                                min={0}
                            />
                        </Form.Item>
                    )}
                </Form>
            </Modal>
        </div>
    );
};

export default Wallets;