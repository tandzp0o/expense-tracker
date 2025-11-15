// import React, { useState, useEffect } from "react";
// import {
//     Card,
//     Button,
//     Table,
//     Space,
//     Modal,
//     Form,
//     Input,
//     InputNumber,
//     message,
//     Tag,
//     Select,
//     Spin,
// } from "antd";
// import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
// import { useAuth } from "../contexts/AuthContext";
// import axios from "axios";

// const API_URL = "http://localhost:5000/api/wallets";

// interface Wallet {
//     _id: string;
//     userId: string;
//     name: string;
//     accountNumber?: string;
//     description?: string;
//     balance: number;
//     initialBalance: number;
//     createdAt: string;
//     updatedAt: string;
// }

// const Wallets: React.FC = () => {
//     const [isModalVisible, setIsModalVisible] = useState(false);
//     const [form] = Form.useForm();
//     const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
//     const [loading, setLoading] = useState(false);
//     const [wallets, setWallets] = useState<Wallet[]>([]);
//     const [totalBalance, setTotalBalance] = useState(0);
//     const { currentUser } = useAuth();

//     // Lấy danh sách ví từ API
//     const fetchWallets = async () => {
//         try {
//             setLoading(true);
//             const token = await currentUser?.getIdToken();
//             const response = await axios.get(API_URL, {
//                 headers: {
//                     Authorization: `Bearer ${token}`,
//                     "Content-Type": "application/json",
//                 },
//             });

//             if (response.data && response.data.wallets) {
//                 setWallets(response.data.wallets);
//                 setTotalBalance(response.data.totalBalance || 0);
//             }
//         } catch (error) {
//             console.error("Lỗi khi tải danh sách ví:", error);
//             message.error("Không thể tải danh sách ví");
//         } finally {
//             setLoading(false);
//         }
//     };

//     // Gọi API khi component được mount
//     useEffect(() => {
//         if (currentUser) {
//             fetchWallets();
//         }
//     }, [currentUser]);

//     // Tạo mới hoặc cập nhật ví
//     const handleSubmit = async (values: any) => {
//         try {
//             setLoading(true);
//             const token = await currentUser?.getIdToken();

//             if (editingWallet) {
//                 // Cập nhật ví
//                 await axios.put(`${API_URL}/${editingWallet._id}`, values, {
//                     headers: {
//                         Authorization: `Bearer ${token}`,
//                         "Content-Type": "application/json",
//                     },
//                 });
//                 message.success("Cập nhật ví thành công");
//             } else {
//                 // Tạo mới ví
//                 await axios.post(API_URL, values, {
//                     headers: {
//                         Authorization: `Bearer ${token}`,
//                         "Content-Type": "application/json",
//                     },
//                 });
//                 message.success("Thêm ví mới thành công");
//             }

//             setIsModalVisible(false);
//             form.resetFields();
//             fetchWallets();
//         } catch (error) {
//             console.error("Lỗi khi lưu ví:", error);
//             message.error("Có lỗi xảy ra khi lưu ví");
//         } finally {
//             setLoading(false);
//         }
//     };

//     // Xóa ví
//     const handleDelete = async (id: string) => {
//         if (!window.confirm("Bạn có chắc chắn muốn xóa ví này?")) {
//             return;
//         }

//         try {
//             setLoading(true);
//             const token = await currentUser?.getIdToken();

//             // Sửa lại URL API
//             await axios.delete(`${API_URL}/${id}`, {
//                 headers: {
//                     Authorization: `Bearer ${token}`,
//                 },
//             });

//             message.success("Xóa ví thành công");
//             fetchWallets();
//         } catch (error) {
//             console.error("Lỗi khi xóa ví:", error);
//             message.error("Có lỗi xảy ra khi xóa ví");
//         } finally {
//             setLoading(false);
//         }
//     };

//     const columns = [
//         {
//             title: "Tên ví",
//             dataIndex: "name",
//             key: "name",
//         },
//         {
//             title: "Số tài khoản",
//             dataIndex: "accountNumber",
//             key: "accountNumber",
//             render: (text: string) => text || "---",
//         },
//         {
//             title: "Mô tả",
//             dataIndex: "description",
//             key: "description",
//             render: (text: string) => text || "---",
//         },
//         {
//             title: "Số dư",
//             dataIndex: "balance",
//             key: "balance",
//             render: (balance: number) => (
//                 <span style={{ color: balance >= 0 ? "#389e0d" : "#cf1322" }}>
//                     {balance.toLocaleString("vi-VN")} VND
//                 </span>
//             ),
//         },
//         {
//             title: "Số dư ban đầu",
//             dataIndex: "initialBalance",
//             key: "initialBalance",
//             render: (balance: number) =>
//                 balance.toLocaleString("vi-VN") + " VND",
//         },
//         {
//             title: "Ngày tạo",
//             dataIndex: "createdAt",
//             key: "createdAt",
//             render: (date: string) =>
//                 new Date(date).toLocaleDateString("vi-VN"),
//         },
//         {
//             title: "Thao tác",
//             key: "action",
//             render: (_: any, record: Wallet) => (
//                 <Space size="middle">
//                     <Button
//                         type="text"
//                         icon={<EditOutlined />}
//                         onClick={() => {
//                             setEditingWallet(record);
//                             form.setFieldsValue({
//                                 name: record.name,
//                                 accountNumber: record.accountNumber,
//                                 description: record.description,
//                                 initialBalance: record.initialBalance,
//                             });
//                             setIsModalVisible(true);
//                         }}
//                     />
//                     {/* <Button
//             type="text"
//             danger
//             icon={<DeleteOutlined />}
//             onClick={() => {
//               Modal.confirm({
//                 title: 'Xác nhận xóa',
//                 content: 'Bạn có chắc chắn muốn xóa ví này?',
//                 onOk: () => handleDelete(record._id),
//               });
//             }}
//           /> */}
//                     <Button
//                         type="text"
//                         danger
//                         icon={<DeleteOutlined />}
//                         onClick={() => handleDelete(record._id)}
//                         loading={loading}
//                     />
//                 </Space>
//             ),
//         },
//     ];

//     const showModal = () => {
//         setEditingWallet(null);
//         form.resetFields();
//         setIsModalVisible(true);
//     };

//     return (
//         <Card
//             title={
//                 <div
//                     style={{
//                         display: "flex",
//                         justifyContent: "space-between",
//                         alignItems: "center",
//                     }}
//                 >
//                     <span>Danh sách ví</span>
//                     <div>
//                         <span style={{ marginRight: 16 }}>
//                             <strong>Tổng số dư: </strong>
//                             <span
//                                 style={{
//                                     color:
//                                         totalBalance >= 0
//                                             ? "#389e0d"
//                                             : "#cf1322",
//                                     fontWeight: "bold",
//                                 }}
//                             >
//                                 {totalBalance.toLocaleString("vi-VN")} VND
//                             </span>
//                         </span>
//                         <Button
//                             type="primary"
//                             icon={<PlusOutlined />}
//                             onClick={() => {
//                                 setEditingWallet(null);
//                                 form.resetFields();
//                                 setIsModalVisible(true);
//                             }}
//                         >
//                             Thêm ví mới
//                         </Button>
//                     </div>
//                 </div>
//             }
//         >
//             <Table
//                 columns={columns}
//                 dataSource={wallets}
//                 rowKey="_id"
//                 pagination={false}
//                 scroll={{ x: 'max-content' }}
//             />

//             <Modal
//                 title={editingWallet ? "Chỉnh sửa ví" : "Thêm ví mới"}
//                 open={isModalVisible}
//                 onCancel={() => setIsModalVisible(false)}
//                 footer={[
//                     <Button
//                         key="back"
//                         onClick={() => setIsModalVisible(false)}
//                         disabled={loading}
//                     >
//                         Hủy
//                     </Button>,
//                     <Button
//                         key="submit"
//                         type="primary"
//                         loading={loading}
//                         onClick={() => form.submit()}
//                         disabled={loading}
//                     >
//                         {editingWallet ? "Cập nhật" : "Thêm mới"}
//                     </Button>,
//                 ]}
//             >
//                 <Form
//                     form={form}
//                     layout="vertical"
//                     onFinish={handleSubmit}
//                     initialValues={{
//                         currency: "VND",
//                         initialBalance: 0,
//                     }}
//                 >
//                     <Form.Item
//                         name="name"
//                         label="Tên ví"
//                         rules={[
//                             { required: true, message: "Vui lòng nhập tên ví" },
//                         ]}
//                     >
//                         <Input placeholder="Ví dụ: Ví tiền mặt, Ngân hàng, Thẻ tín dụng..." />
//                     </Form.Item>

//                     <Form.Item name="accountNumber" label="Số tài khoản">
//                         <Input placeholder="Nhập số tài khoản" />
//                     </Form.Item>

//                     <Form.Item name="description" label="Mô tả">
//                         <Input.TextArea
//                             rows={3}
//                             placeholder="Nhập mô tả ngắn về ví (nếu có)"
//                         />
//                     </Form.Item>

//                     {!editingWallet && (
//                         <Form.Item
//                             name="initialBalance"
//                             label="Số dư ban đầu"
//                             rules={[
//                                 {
//                                     required: true,
//                                     message: "Vui lòng nhập số dư ban đầu",
//                                 },
//                             ]}
//                         >
//                             <InputNumber
//                                 style={{ width: "100%" }}
//                                 formatter={(value) =>
//                                     `${value}`.replace(
//                                         /\B(?=(\d{3})+(?!\d))/g,
//                                         ","
//                                     )
//                                 }
//                                 parser={(value) =>
//                                     (value
//                                         ? Number(
//                                               value.replace(/[^0-9.-]+/g, "")
//                                           )
//                                         : 0) as 0
//                                 }
//                                 min={0}
//                             />
//                         </Form.Item>
//                     )}

//                     <Form.Item
//                         name="currency"
//                         label="Đơn vị tiền tệ"
//                         rules={[
//                             {
//                                 required: true,
//                                 message: "Vui lòng chọn đơn vị tiền tệ",
//                             },
//                         ]}
//                     >
//                         <Select>
//                             <Select.Option value="VND">
//                                 Việt Nam Đồng (VND)
//                             </Select.Option>
//                             {/* <Select.Option value="USD">
//                                 Đô la Mỹ (USD)
//                             </Select.Option>
//                             <Select.Option value="EUR">
//                                 Euro (EUR)
//                             </Select.Option> */}
//                         </Select>
//                     </Form.Item>
//                 </Form>
//             </Modal>
//         </Card>
//     );
// };

// export default Wallets;

import React, { useState, useEffect } from "react";
import {
    Card,
    Button,
    Table,
    Space,
    Modal,
    Form,
    Input,
    InputNumber,
    message,
    Tag,
    Select,
    Spin,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { walletApi } from "../services/api"; // <-- Import từ api.ts

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
    const { currentUser } = useAuth();

    // Lấy danh sách ví từ API
    const fetchWallets = async () => {
        try {
            setLoading(true);
            const token = await currentUser?.getIdToken();
            const response = await walletApi.getWallets(token); // <-- Sử dụng walletApi

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
        try {
            setLoading(true);
            const token = await currentUser?.getIdToken();

            if (editingWallet) {
                // Cập nhật ví
                await walletApi.updateWallet(editingWallet._id, values, token); // <-- Sử dụng walletApi
                message.success("Cập nhật ví thành công");
            } else {
                // Tạo mới ví
                await walletApi.createWallet(values, token); // <-- Sử dụng walletApi
                message.success("Thêm ví mới thành công");
            }

            setIsModalVisible(false);
            form.resetFields();
            fetchWallets(); // Tải lại danh sách ví
        } catch (error: any) {
            console.error("Lỗi khi lưu ví:", error);
            message.error(error.message || "Có lỗi xảy ra khi lưu ví");
        } finally {
            setLoading(false);
        }
    };

    // Xóa ví
    const handleDelete = async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa ví này?")) {
            return;
        }

        try {
            setLoading(true);
            const token = await currentUser?.getIdToken();

            await walletApi.deleteWallet(id, token); // <-- Sử dụng walletApi

            message.success("Xóa ví thành công");
            fetchWallets(); // Tải lại danh sách ví
        } catch (error: any) {
            console.error("Lỗi khi xóa ví:", error);
            message.error(error.message || "Có lỗi xảy ra khi xóa ví");
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: "Tên ví",
            dataIndex: "name",
            key: "name",
        },
        {
            title: "Số tài khoản",
            dataIndex: "accountNumber",
            key: "accountNumber",
            render: (text: string) => text || "---",
        },
        {
            title: "Mô tả",
            dataIndex: "description",
            key: "description",
            render: (text: string) => text || "---",
        },
        {
            title: "Số dư",
            dataIndex: "balance",
            key: "balance",
            render: (balance: number) => (
                <span style={{ color: balance >= 0 ? "#389e0d" : "#cf1322" }}>
                    {balance.toLocaleString("vi-VN")} VND
                </span>
            ),
        },
        {
            title: "Số dư ban đầu",
            dataIndex: "initialBalance",
            key: "initialBalance",
            render: (balance: number) =>
                balance.toLocaleString("vi-VN") + " VND",
        },
        {
            title: "Ngày tạo",
            dataIndex: "createdAt",
            key: "createdAt",
            render: (date: string) =>
                new Date(date).toLocaleDateString("vi-VN"),
        },
        {
            title: "Thao tác",
            key: "action",
            render: (_: any, record: Wallet) => (
                <Space size="middle">
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => {
                            setEditingWallet(record);
                            form.setFieldsValue({
                                name: record.name,
                                accountNumber: record.accountNumber,
                                description: record.description,
                                initialBalance: record.initialBalance,
                            });
                            setIsModalVisible(true);
                        }}
                    />
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record._id)}
                        loading={loading}
                    />
                </Space>
            ),
        },
    ];

    const showModal = () => {
        setEditingWallet(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    return (
        <Card
            title={
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <span>Danh sách ví</span>
                    <div>
                        <span style={{ marginRight: 16 }}>
                            <strong>Tổng số dư: </strong>
                            <span
                                style={{
                                    color:
                                        totalBalance >= 0
                                            ? "#389e0d"
                                            : "#cf1322",
                                    fontWeight: "bold",
                                }}
                            >
                                {totalBalance.toLocaleString("vi-VN")} VND
                            </span>
                        </span>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={showModal}
                        >
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
                scroll={{ x: 'max-content' }}
                loading={loading}
            />

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
                    initialValues={{
                        currency: "VND",
                        initialBalance: 0,
                    }}
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
                                        ","
                                    )
                                }
                                parser={(value) =>
                                    (value
                                        ? Number(
                                              value.replace(/[^0-9.-]+/g, "")
                                          )
                                        : 0) as 0
                                }
                                min={0}
                            />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="currency"
                        label="Đơn vị tiền tệ"
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn đơn vị tiền tệ",
                            },
                        ]}
                    >
                        <Select>
                            <Select.Option value="VND">
                                Việt Nam Đồng (VND)
                            </Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default Wallets;