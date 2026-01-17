import React, { useState, useEffect } from "react";
import {
    Alert,
    Card,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    message,
    Row,
    Col,
    Statistic,
    Descriptions,
    List,
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    WalletOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { walletApi } from "../services/api";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase/config";
import { formatCurrency } from "../utils/formatters";

import mastercard from "../assets/images/mastercard-logo.png";
import paypal from "../assets/images/paypal-logo-2.png";
import visa from "../assets/images/visa-logo.png";

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
            message.error(
                "Xác thực người dùng thất bại. Vui lòng đăng nhập lại.",
            );
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
                message.success(
                    "Tạo ví đầu tiên thành công! Đang chuyển hướng bạn...",
                );

                updateUserStatus(false);

                setTimeout(() => {
                    navigate("/");
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

    const showModal = () => {
        setEditingWallet(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    return (
        <>
            {currentUser?.newUser && (
                <Alert
                    message="Chào mừng bạn đến với ứng dụng quản lý tài chính!"
                    description={
                        <div>
                            <p>
                                Để bắt đầu, bạn cần tạo ví đầu tiên của mình (ví
                                dụ: Tiền mặt, Ngân hàng...).
                            </p>
                            <p>
                                Vui lòng nhấn nút <strong>"Thêm ví mới"</strong>{" "}
                                và điền thông tin.
                            </p>
                            <p>
                                Bạn sẽ không thể sử dụng các tính năng khác cho
                                đến khi hoàn tất bước này.
                            </p>
                            <Button
                                type="link"
                                danger
                                onClick={logout}
                                style={{ padding: 0 }}
                            >
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

            {/* Statistics Section */}
            <Row gutter={[24, 0]} className="mb-24">
                <Col xs={24} md={16}>
                    <Row gutter={[24, 0]}>
                        <Col xs={24} xl={12} className="mb-24">
                            <Card
                                bordered={false}
                                className="card-credit header-solid h-ful"
                                title={
                                    <img
                                        src={mastercard}
                                        alt="mastercard"
                                        style={{ height: 26 }}
                                    />
                                }
                            >
                                <h5 className="card-number">Tổng số dư</h5>
                                <div className="card-footer">
                                    <div className="mr-30">
                                        <p>Số dư</p>
                                        <h6>{formatCurrency(totalBalance)}</h6>
                                    </div>
                                    <div className="mr-30">
                                        <p>Số ví</p>
                                        <h6>{wallets.length}</h6>
                                    </div>
                                    <div className="card-footer-col col-logo ml-auto">
                                        <img
                                            src={visa}
                                            alt="visa"
                                            style={{ height: 22 }}
                                        />
                                    </div>
                                </div>
                            </Card>
                        </Col>
                        <Col xs={12} xl={6} className="mb-24">
                            <Card bordered={false} className="widget-2 h-full">
                                <Statistic
                                    title={
                                        <>
                                            <div className="icon">
                                                <img
                                                    src={paypal}
                                                    alt="paypal"
                                                />
                                            </div>
                                            <h6>Số ví</h6>
                                            <p>Đang quản lý</p>
                                        </>
                                    }
                                    value={wallets.length}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} xl={6} className="mb-24">
                            <Card bordered={false} className="widget-2 h-full">
                                <Statistic
                                    title={
                                        <>
                                            <div className="icon">
                                                <WalletOutlined
                                                    style={{ fontSize: 20 }}
                                                />
                                            </div>
                                            <h6>Trung bình/ví</h6>
                                            <p>Ước tính</p>
                                        </>
                                    }
                                    value={
                                        wallets.length > 0
                                            ? formatCurrency(
                                                  totalBalance / wallets.length,
                                              )
                                            : formatCurrency(0)
                                    }
                                />
                            </Card>
                        </Col>
                    </Row>
                </Col>

                <Col span={24} md={8} className="mb-24">
                    <Card
                        bordered={false}
                        className="header-solid h-full ant-invoice-card"
                        title={[
                            <h6 className="font-semibold m-0">
                                Các ví gần đây
                            </h6>,
                        ]}
                        extra={[
                            <Button
                                key="add"
                                type="primary"
                                onClick={showModal}
                            >
                                <span>THÊM VÍ</span>
                            </Button>,
                        ]}
                    >
                        <List
                            itemLayout="horizontal"
                            className="invoice-list"
                            dataSource={[...wallets]
                                .sort(
                                    (a, b) =>
                                        new Date(b.createdAt).getTime() -
                                        new Date(a.createdAt).getTime(),
                                )
                                .slice(0, 5)}
                            renderItem={(wallet) => (
                                <List.Item
                                    actions={[
                                        <Button
                                            key="edit"
                                            type="link"
                                            onClick={() => {
                                                setEditingWallet(wallet);
                                                form.setFieldsValue(wallet);
                                                setIsModalVisible(true);
                                            }}
                                        >
                                            Sửa
                                        </Button>,
                                    ]}
                                >
                                    <List.Item.Meta
                                        title={wallet.name}
                                        description={
                                            wallet.accountNumber || "---"
                                        }
                                    />
                                    <div className="amount">
                                        {formatCurrency(wallet.balance)}
                                    </div>
                                </List.Item>
                            )}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Wallets List */}
            <Row gutter={[24, 0]}>
                <Col span={24} className="mb-24">
                    <Card
                        className="header-solid h-full"
                        bordered={false}
                        title={[
                            <h6 className="font-semibold m-0">Danh sách ví</h6>,
                        ]}
                        extra={[
                            <Button
                                key="add"
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={showModal}
                            >
                                THÊM VÍ MỚI
                            </Button>,
                        ]}
                        bodyStyle={{ paddingTop: "0" }}
                    >
                        <Row gutter={[24, 24]}>
                            {wallets.length > 0 ? (
                                wallets.map((wallet) => (
                                    <Col span={24} key={wallet._id}>
                                        <Card
                                            className="card-billing-info"
                                            bordered={false}
                                        >
                                            <div className="col-info">
                                                <Descriptions
                                                    title={wallet.name}
                                                >
                                                    <Descriptions.Item
                                                        label="Số dư"
                                                        span={3}
                                                    >
                                                        <span
                                                            style={{
                                                                color:
                                                                    wallet.balance >=
                                                                    0
                                                                        ? "#52c41a"
                                                                        : "#ff4d4f",
                                                                fontWeight:
                                                                    "bold",
                                                            }}
                                                        >
                                                            {formatCurrency(
                                                                wallet.balance,
                                                            )}
                                                        </span>
                                                    </Descriptions.Item>
                                                    <Descriptions.Item
                                                        label="Số tài khoản"
                                                        span={3}
                                                    >
                                                        {wallet.accountNumber ||
                                                            "---"}
                                                    </Descriptions.Item>
                                                    <Descriptions.Item
                                                        label="Mô tả"
                                                        span={3}
                                                    >
                                                        {wallet.description ||
                                                            "---"}
                                                    </Descriptions.Item>
                                                </Descriptions>
                                            </div>
                                            <div className="col-action">
                                                <Button
                                                    type="link"
                                                    danger
                                                    onClick={() =>
                                                        handleDelete(wallet._id)
                                                    }
                                                >
                                                    <DeleteOutlined /> XÓA
                                                </Button>
                                                <Button
                                                    type="link"
                                                    className="darkbtn"
                                                    onClick={() => {
                                                        setEditingWallet(
                                                            wallet,
                                                        );
                                                        form.setFieldsValue(
                                                            wallet,
                                                        );
                                                        setIsModalVisible(true);
                                                    }}
                                                >
                                                    <EditOutlined /> SỬA
                                                </Button>
                                            </div>
                                        </Card>
                                    </Col>
                                ))
                            ) : (
                                <Col span={24}>
                                    <Card
                                        style={{
                                            textAlign: "center",
                                            padding: "40px",
                                        }}
                                    >
                                        <p style={{ marginBottom: "20px" }}>
                                            Chưa có ví nào
                                        </p>
                                        <Button
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={showModal}
                                        >
                                            Tạo ví đầu tiên
                                        </Button>
                                    </Card>
                                </Col>
                            )}
                        </Row>
                    </Card>
                </Col>
            </Row>

            {/* Modal */}
            <Modal
                title={editingWallet ? "Chỉnh sửa ví" : "Thêm ví mới"}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={[
                    <Button
                        key="back"
                        onClick={() => setIsModalVisible(false)}
                        disabled={loading}
                    >
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={loading}
                        onClick={() => form.submit()}
                    >
                        {editingWallet ? "Cập nhật" : "Thêm mới"}
                    </Button>,
                ]}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ initialBalance: 0 }}
                >
                    <Form.Item
                        name="name"
                        label="Tên ví"
                        rules={[
                            { required: true, message: "Vui lòng nhập tên ví" },
                        ]}
                    >
                        <Input placeholder="Ví dụ: Ví tiền mặt, Ngân hàng, Thẻ tín dụng..." />
                    </Form.Item>
                    <Form.Item name="accountNumber" label="Số tài khoản">
                        <Input placeholder="Nhập số tài khoản" />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea
                            rows={3}
                            placeholder="Nhập mô tả ngắn về ví (nếu có)"
                        />
                    </Form.Item>
                    {!editingWallet && (
                        <Form.Item
                            name="initialBalance"
                            label="Số dư ban đầu"
                            rules={[
                                {
                                    required: true,
                                    message: "Vui lòng nhập số dư ban đầu",
                                },
                            ]}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                formatter={(value) =>
                                    `${value}`.replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ",",
                                    )
                                }
                                parser={(value) =>
                                    (value
                                        ? Number(
                                              value.replace(/[^0-9.-]+/g, ""),
                                          )
                                        : 0) as 0
                                }
                                min={0}
                            />
                        </Form.Item>
                    )}
                </Form>
            </Modal>
        </>
    );
};

export default Wallets;
