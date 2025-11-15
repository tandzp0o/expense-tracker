import React, { useCallback, useEffect, useState } from "react";
import {
    Button,
    Table,
    Space,
    Modal,
    Form,
    Input,
    Select,
    DatePicker,
    InputNumber,
    message,
} from "antd";
import {
    PlusOutlined,
    SearchOutlined,
    EditOutlined,
    DeleteOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/vi";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/formatters";
import { useDebounce } from "../hooks/useDebounce";
import { transactionApi, walletApi } from "../services/api";
import { auth } from "../firebase/config"; // <-- ĐÃ THÊM

dayjs.locale("vi");

const { Option } = Select;
const { RangePicker } = DatePicker;

type TransactionType = "INCOME" | "EXPENSE";

interface Transaction {
    _id: string;
    userId: string;
    walletId: string;
    type: TransactionType;
    amount: number;
    category: string;
    date: string;
    note?: string;
}

interface Wallet {
    _id: string;
    name: string;
    balance: number;
}

const categories = [
    { type: "INCOME", name: "Lương" },
    { type: "INCOME", name: "Thưởng" },
    { type: "INCOME", name: "Đầu tư" },
    { type: "INCOME", name: "Khác" },
    { type: "EXPENSE", name: "Ăn uống" },
    { type: "EXPENSE", name: "Mua sắm" },
    { type: "EXPENSE", name: "Hóa đơn" },
    { type: "EXPENSE", name: "Giải trí" },
    { type: "EXPENSE", name: "Y tế" },
    { type: "EXPENSE", name: "Khác" },
];

const Transactions: React.FC = () => {
    const [form] = Form.useForm();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingTransaction, setEditingTransaction] =
        useState<Transaction | null>(null);
    const [customCategory, setCustomCategory] = useState("");
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const { currentUser } = useAuth(); // Dùng để trigger useEffect
    const [searchParams, setSearchParams] = useState({
        dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null,
        type: undefined as string | undefined,
        category: undefined as string | undefined,
        walletId: undefined as string | undefined,
        note: "",
    });
    const [filterableCategories, setFilterableCategories] = useState<string[]>(
        []
    );
    const [noteInput, setNoteInput] = useState("");
    const debouncedNote = useDebounce(noteInput, 500);
    
    // Hàm helper để lấy token một cách an toàn
    const getToken = async (): Promise<string | null> => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            message.error("Người dùng chưa được xác thực.");
            return null;
        }
        return firebaseUser.getIdToken();
    };

    // Lấy danh sách ví từ API
    const fetchWallets = useCallback(async () => {
        try {
            const token = await getToken();
            if (!token) return;

            const response = await walletApi.getWallets(token);
            if (response && response.wallets) {
                setWallets(response.wallets);
            } else {
                setWallets([]);
            }
        } catch (error: any) {
            console.error("Lỗi khi tải danh sách ví:", error);
            message.error(error.message || "Không thể tải danh sách ví");
            setWallets([]);
        }
    }, [currentUser]); // Phụ thuộc vào currentUser để fetch lại khi người dùng thay đổi

    // lấy danh sách giao dịch từ API
    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const token = await getToken();
            if (!token) {
                setLoading(false);
                return;
            };

            const params: any = {};
            if (searchParams.dateRange?.[0] && searchParams.dateRange?.[1]) {
                params.startDate = searchParams.dateRange[0].format("YYYY-MM-DD");
                params.endDate = searchParams.dateRange[1].format("YYYY-MM-DD");
            }
            if (searchParams.type) params.type = searchParams.type;
            if (searchParams.category) params.category = searchParams.category;
            if (searchParams.walletId) params.walletId = searchParams.walletId;
            if (searchParams.note) params.note = searchParams.note;

            const response = await transactionApi.getTransactions(params, token);

            if (response && response.data.transactions) {
                setTransactions(response.data.transactions);
            }
        } catch (error: any) {
            console.error("Lỗi khi tải giao dịch:", error);
            message.error(error.message || "Không thể tải danh sách giao dịch");
        } finally {
            setLoading(false);
        }
    }, [currentUser, searchParams]);

    useEffect(() => {
        if (currentUser) {
            fetchWallets();
            fetchTransactions();
        }
    }, [currentUser, fetchWallets, fetchTransactions]);

    useEffect(() => {
        const selectedType = searchParams.type;
        const filteredPredefined = categories
            .filter((cat) => !selectedType || cat.type === selectedType)
            .map((cat) => cat.name);
        const filteredFromTransactions = transactions
            .filter((trans) => !selectedType || trans.type === selectedType)
            .map((trans) => trans.category);
        const finalCategories = Array.from(
            new Set([...filteredPredefined, ...filteredFromTransactions])
        );
        finalCategories.sort();
        setFilterableCategories(finalCategories);
    }, [transactions, searchParams.type]);

    useEffect(() => {
        setSearchParams((prevParams) => ({
            ...prevParams,
            note: debouncedNote,
        }));
    }, [debouncedNote]);

    const handleSearch = () => {
        fetchTransactions();
    };

    const handleReset = () => {
        setSearchParams({
            dateRange: null, type: undefined, category: undefined,
            walletId: undefined, note: "",
        });
        setNoteInput("");
    };

    const columns: ColumnsType<Transaction> = [
        { title: "Ngày", dataIndex: "date", key: "date", render: (date: string) => dayjs(date).format("DD/MM/YYYY"), sorter: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() },
        { title: "Loại", dataIndex: "type", key: "type", render: (type: TransactionType) => <span style={{ color: type === "INCOME" ? "#52c41a" : "#f5222d" }}>{type === "INCOME" ? "Thu nhập" : "Chi tiêu"}</span> },
        { title: "Danh mục", dataIndex: "category", key: "category" },
        { title: "Số tiền", dataIndex: "amount", key: "amount", render: (amount: number, record: Transaction) => <span style={{ color: record.type === "INCOME" ? "#52c41a" : "#f5222d" }}>{record.type === "EXPENSE" ? "-" : "+"} {formatCurrency(amount)}</span>, sorter: (a, b) => a.amount - b.amount },
        { title: "Ghi chú", dataIndex: "note", key: "note", ellipsis: true },
        { title: "Hành động", key: "action", render: (_, record) => (
            <Space size="middle" key={record._id}>
                <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id)} />
            </Space>
        )},
    ];

    const showModal = () => {
        setEditingTransaction(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (transaction: Transaction) => {
        const walletIdValue = typeof transaction.walletId === "object" && transaction.walletId !== null
            ? (transaction.walletId as any)._id : transaction.walletId;

        form.setFieldsValue({ ...transaction, walletId: walletIdValue, date: dayjs(transaction.date) });
        setEditingTransaction(transaction);
        setIsModalVisible(true);
    };

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);
            const token = await getToken();
            if (!token) { setLoading(false); return; }

            const transactionData = {
                ...values,
                date: values.date.format("YYYY-MM-DD"),
                amount: Number(values.amount),
                category: values.category || customCategory
            };

            if (editingTransaction) {
                await transactionApi.updateTransaction(editingTransaction._id, transactionData, token);
                message.success("Cập nhật giao dịch thành công");
            } else {
                await transactionApi.createTransaction(transactionData, token);
                message.success("Thêm giao dịch thành công");
            }

            setIsModalVisible(false);
            form.resetFields();
            setCustomCategory("");
            setEditingTransaction(null);

            await Promise.all([fetchTransactions(), fetchWallets()]);
        } catch (error: any) {
            console.error("Lỗi khi lưu giao dịch:", error);
            message.error(error.message || "Đã xảy ra lỗi. Vui lòng thử lại sau.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa giao dịch này?")) {
            return;
        }

        try {
            setLoading(true);
            const token = await getToken();
            if (!token) { setLoading(false); return; }

            await transactionApi.deleteTransaction(id, token);
            message.success("Xóa giao dịch thành công");
            
            await Promise.all([fetchTransactions(), fetchWallets()]);
        } catch (error: any) {
            console.error("Lỗi khi xóa giao dịch:", error);
            message.error(error.message || "Có lỗi xảy ra khi xóa giao dịch");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: 'center' }}>
                <h2>Quản lý giao dịch</h2>
                <Button type="primary" icon={<PlusOutlined />} onClick={showModal}>
                    Thêm giao dịch
                </Button>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
                    <Space wrap>
                        <RangePicker value={searchParams.dateRange} onChange={(dates) => setSearchParams({ ...searchParams, dateRange: dates as [Dayjs, Dayjs] | null })} format="DD/MM/YYYY" />
                        <Select placeholder="Chọn loại giao dịch" style={{ width: 150 }} value={searchParams.type} onChange={(value) => setSearchParams({ ...searchParams, type: value, category: undefined })} allowClear>
                            <Option value="INCOME">Thu nhập</Option>
                            <Option value="EXPENSE">Chi tiêu</Option>
                        </Select>
                        <Select placeholder="Chọn danh mục" style={{ width: 150 }} value={searchParams.category} onChange={(value) => setSearchParams({ ...searchParams, category: value })} allowClear showSearch optionFilterProp="children">
                            {filterableCategories.map((cat) => (<Option key={cat} value={cat}>{cat}</Option>))}
                        </Select>
                        <Select placeholder="Chọn ví" style={{ width: 150 }} value={searchParams.walletId} onChange={(value) => setSearchParams({ ...searchParams, walletId: value })} allowClear>
                            {wallets.map((wallet) => (<Option key={wallet._id} value={wallet._id}>{wallet.name}</Option>))}
                        </Select>
                        <Input placeholder="Tìm kiếm ghi chú" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} onPressEnter={handleSearch} style={{ width: 200 }} />
                        {/* <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />}>Tìm kiếm</Button> */}
                        <Button onClick={handleReset}>Đặt lại</Button>
                    </Space>
                </Space>
            </div>

            <Table columns={columns} dataSource={transactions} rowKey="_id" loading={loading} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} giao dịch` }} scroll={{ x: 'max-content' }} />

            <Modal title={editingTransaction ? "Chỉnh sửa giao dịch" : "Thêm giao dịch mới"} open={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null} width={600}>
                <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ type: "EXPENSE", walletId: wallets[0]?._id, date: dayjs() }}>
                    <Form.Item name="type" label="Loại giao dịch" rules={[{ required: true, message: "Vui lòng chọn loại giao dịch" }]}>
                        <Select onChange={() => form.setFieldsValue({ category: undefined })}>
                            <Option value="INCOME">Thu nhập</Option>
                            <Option value="EXPENSE">Chi tiêu</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}>
                        {({ getFieldValue }) => (
                            <Form.Item name="category" label="Danh mục" rules={[{ required: true, message: "Vui lòng chọn hoặc nhập danh mục" }]}>
                                <Select placeholder="Chọn danh mục hoặc nhập mới" popupRender={(menu) => (
                                    <div>
                                        {menu}
                                        <div style={{ padding: "8px", borderTop: "1px solid #f0f0f0" }}>
                                            <Input placeholder="Thêm danh mục mới" value={customCategory} onChange={(e) => {
                                                const value = e.target.value;
                                                setCustomCategory(value);
                                                if (value) { form.setFieldsValue({ category: value }); }
                                            }} />
                                        </div>
                                    </div>
                                )}>
                                    {categories.filter((cat) => cat.type === getFieldValue("type")).map((cat) => (<Option key={cat.name} value={cat.name}>{cat.name}</Option>))}
                                </Select>
                            </Form.Item>
                        )}
                    </Form.Item>
                    <Form.Item name="amount" label="Số tiền" rules={[{ required: true, message: "Vui lòng nhập số tiền" }]}>
                        <InputNumber style={{ width: "100%" }} formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} parser={(value) => (value ? Number(value.replace(/[^0-9.-]+/g, "")) : 0) as 0} min={0} />
                    </Form.Item>
                    <Form.Item name="walletId" label="Ví" rules={[{ required: true, message: "Vui lòng chọn ví" }]}>
                        <Select placeholder="Chọn ví" allowClear={false} showSearch>
                            {wallets.map((wallet) => (
                                <Option key={wallet._id} value={wallet._id}>{`${wallet.name} (${formatCurrency(wallet.balance)})`}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="date" label="Ngày giao dịch">
                        <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                    </Form.Item>
                    <Form.Item name="note" label="Ghi chú">
                        <Input.TextArea rows={3} placeholder="Nhập ghi chú (nếu có)" />
                    </Form.Item>
                    <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
                        <Button style={{ marginRight: 8 }} onClick={() => setIsModalVisible(false)} disabled={loading}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={loading}>{editingTransaction ? "Cập nhật" : "Thêm mới"}</Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Transactions;