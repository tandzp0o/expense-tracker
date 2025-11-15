// import React, { useCallback, useEffect, useState } from "react";
// import {
//     Button,
//     Table,
//     Space,
//     Modal,
//     Form,
//     Input,
//     Select,
//     DatePicker,
//     InputNumber,
//     message,
// } from "antd";
// import {
//     PlusOutlined,
//     SearchOutlined,
//     EditOutlined,
//     DeleteOutlined,
// } from "@ant-design/icons";
// import type { ColumnsType } from "antd/es/table";
// import dayjs, { Dayjs } from "dayjs";
// import "dayjs/locale/vi";
// import { useAuth } from "../contexts/AuthContext";
// import axios from "axios";
// import { formatCurrency } from "../utils/formatters";
// import { useDebounce } from "../hooks/useDebounce";
// dayjs.locale("vi");

// const { Option } = Select;
// const { RangePicker } = DatePicker;
// const API_URL = "http://localhost:5000/api/transactions";
// const API_URL_WALLET = "http://localhost:5000/api/wallets";

// type TransactionType = "INCOME" | "EXPENSE";

// interface Transaction {
//     _id: string;
//     userId: string;
//     walletId: string;
//     type: TransactionType;
//     amount: number;
//     category: string;
//     date: string;
//     note?: string;
// }

// interface Wallet {
//     _id: string;
//     name: string;
//     balance: number;
// }

// const categories = [
//     { type: "INCOME", name: "Lương" },
//     { type: "INCOME", name: "Thưởng" },
//     { type: "INCOME", name: "Đầu tư" },
//     { type: "INCOME", name: "Khác" },
//     { type: "EXPENSE", name: "Ăn uống" },
//     { type: "EXPENSE", name: "Mua sắm" },
//     { type: "EXPENSE", name: "Hóa đơn" },
//     { type: "EXPENSE", name: "Giải trí" },
//     { type: "EXPENSE", name: "Y tế" },
//     { type: "EXPENSE", name: "Khác" },
// ];

// const Transactions: React.FC = () => {
//     const [form] = Form.useForm();
//     const [isModalVisible, setIsModalVisible] = useState(false);
//     const [loading, setLoading] = useState(false);
//     const [editingTransaction, setEditingTransaction] =
//         useState<Transaction | null>(null);
//     const [showCustomCategory, setShowCustomCategory] = useState(false);
//     const [customCategory, setCustomCategory] = useState("");
//     const [wallets, setWallets] = useState<Wallet[]>([]);
//     const [transactions, setTransactions] = useState<Transaction[]>([]);
//     const { currentUser } = useAuth();
//     const [searchParams, setSearchParams] = useState({
//         dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null,
//         type: undefined as string | undefined,
//         category: undefined as string | undefined,
//         walletId: undefined as string | undefined,
//         note: "",
//     });
//     const [filterableCategories, setFilterableCategories] = useState<string[]>(
//         []
//     );
//     const [noteInput, setNoteInput] = useState("");
//     const debouncedNote = useDebounce(noteInput, 500);

//     // Lấy danh sách ví từ API
//     const fetchWallets = useCallback(async () => {
//         try {
//             const token = await currentUser?.getIdToken();
//             const response = await axios.get(API_URL_WALLET, {
//                 headers: {
//                     Authorization: `Bearer ${token}`,
//                     "Content-Type": "application/json",
//                 },
//             });

//             if (response.data && response.data.wallets) {
//                 setWallets(response.data.wallets);
//             } else {
//                 setWallets([]); // Đảm bảo luôn là mảng
//             }
//         } catch (error) {
//             console.error("Lỗi khi tải danh sách ví:", error);
//             message.error("Không thể tải danh sách ví");
//             setWallets([]); // Đảm bảo luôn là mảng ngay cả khi có lỗi
//         }
//     }, [currentUser]);

//     // lấy danh sách giao dịch từ API
//     const fetchTransactions = useCallback(async () => {
//         try {
//             setLoading(true);
//             const token = await currentUser?.getIdToken();

//             // Tạo đối tượng params từ searchParams
//             const params: any = {};

//             if (searchParams.dateRange?.[0] && searchParams.dateRange?.[1]) {
//                 params.startDate =
//                     searchParams.dateRange[0].format("YYYY-MM-DD");
//                 params.endDate = searchParams.dateRange[1].format("YYYY-MM-DD");
//             }

//             if (searchParams.type) params.type = searchParams.type;
//             if (searchParams.category) params.category = searchParams.category;
//             if (searchParams.walletId) params.walletId = searchParams.walletId;
//             if (searchParams.note) params.note = searchParams.note;

//             const response = await axios.get(API_URL, {
//                 headers: {
//                     Authorization: `Bearer ${token}`,
//                     "Content-Type": "application/json",
//                 },
//                 params,
//             });

//             if (response.data && response.data.data.transactions) {
//                 setTransactions(response.data.data.transactions);
//             }
//         } catch (error) {
//             console.error("Lỗi khi tải giao dịch:", error);
//             message.error("Không thể tải danh sách giao dịch");
//         } finally {
//             setLoading(false);
//         }
//     }, [currentUser, searchParams]);

//     useEffect(() => {
//         if (currentUser) {
//             fetchWallets();
//             fetchTransactions();
//         }
//     }, [currentUser, fetchWallets, fetchTransactions]);

//     // useEffect này sẽ chạy mỗi khi danh sách giao dịch thay đổi
//     // useEffect này sẽ chạy lại mỗi khi danh sách giao dịch HOẶC loại giao dịch được chọn thay đổi
//     useEffect(() => {
//         const selectedType = searchParams.type;

//         // 1. Lọc danh sách danh mục MẪU dựa trên loại đã chọn
//         const filteredPredefined = categories
//             // Giữ lại danh mục nếu: chưa chọn loại HOẶC loại của danh mục khớp với loại đã chọn
//             .filter((cat) => !selectedType || cat.type === selectedType)
//             .map((cat) => cat.name);

//         // 2. Lọc danh sách danh mục TỪ GIAO DỊCH dựa trên loại đã chọn
//         const filteredFromTransactions = transactions
//             // Giữ lại giao dịch nếu: chưa chọn loại HOẶC loại của giao dịch khớp với loại đã chọn
//             .filter((trans) => !selectedType || trans.type === selectedType)
//             .map((trans) => trans.category);

//         // 3. Kết hợp cả hai danh sách và loại bỏ trùng lặp
//         const finalCategories = Array.from(
//             new Set([...filteredPredefined, ...filteredFromTransactions])
//         );

//         // Sắp xếp và cập nhật state
//         finalCategories.sort();
//         setFilterableCategories(finalCategories);
//     }, [transactions, searchParams.type, categories]); // Thêm searchParams.type vào mảng phụ thuộc

//     useEffect(() => {
//         setSearchParams((prevParams) => ({
//             ...prevParams,
//             note: debouncedNote,
//         }));
//     }, [debouncedNote]); // Chỉ gọi API khi giá trị đã được debounce thay đổi

//     // Hàm xử lý tìm kiếm
//     const handleSearch = () => {
//         fetchTransactions();
//     };

//     // Hàm reset bộ lọc
//     const handleReset = () => {
//         setSearchParams({
//             dateRange: null,
//             type: undefined,
//             category: undefined,
//             walletId: undefined,
//             note: "",
//         });
//         setNoteInput("");
//     };

//     const columns: ColumnsType<Transaction> = [
//         {
//             title: "Ngày",
//             dataIndex: "date",
//             key: "date",
//             render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
//             sorter: (a, b) =>
//                 new Date(a.date).getTime() - new Date(b.date).getTime(),
//         },
//         {
//             title: "Loại",
//             dataIndex: "type",
//             key: "type",
//             render: (type: TransactionType) => (
//                 <span
//                     style={{ color: type === "INCOME" ? "#52c41a" : "#f5222d" }}
//                 >
//                     {type === "INCOME" ? "Thu nhập" : "Chi tiêu"}
//                 </span>
//             ),
//             filters: [
//                 { text: "Thu nhập", value: "INCOME" },
//                 { text: "Chi tiêu", value: "EXPENSE" },
//             ],
//             onFilter: (value, record) => record.type === value,
//         },
//         {
//             title: "Danh mục",
//             dataIndex: "category",
//             key: "category",
//         },
//         {
//             title: "Số tiền",
//             dataIndex: "amount",
//             key: "amount",
//             render: (amount: number, record: Transaction) => (
//                 <span
//                     style={{
//                         color: record.type === "INCOME" ? "#52c41a" : "#f5222d",
//                     }}
//                 >
//                     {record.type === "EXPENSE" ? "-" : ""}₫
//                     {amount.toLocaleString()}
//                 </span>
//             ),
//             sorter: (a, b) => a.amount - b.amount,
//         },
//         {
//             title: "Ghi chú",
//             dataIndex: "note",
//             key: "note",
//             ellipsis: true,
//         },
//         {
//             title: "Hành động",
//             key: "action",
//             render: (_, record) => (
//                 <Space size="middle" key={record._id}>
//                     <Button
//                         type="text"
//                         icon={<EditOutlined />}
//                         onClick={() => handleEdit(record)}
//                     />
//                     <Button
//                         type="text"
//                         danger
//                         icon={<DeleteOutlined />}
//                         onClick={() => handleDelete(record._id)}
//                     />
//                 </Space>
//             ),
//         },
//     ];

//     const showModal = () => {
//         setEditingTransaction(null);
//         form.resetFields();
//         setIsModalVisible(true);
//     };

//     const handleEdit = async (transaction: Transaction) => {
//         try {
//             setLoading(true);
//             // Bạn không cần fetch lại wallets mỗi lần edit nếu danh sách ví ít thay đổi.
//             // Tuy nhiên, giữ lại cũng không sao để đảm bảo dữ liệu mới nhất.
//             await fetchWallets();

//             // THAY ĐỔI QUAN TRỌNG Ở ĐÂY
//             // Kiểm tra xem transaction.walletId có phải là object không.
//             // Nếu đúng, chỉ lấy _id. Nếu không (chỉ là string), giữ nguyên.
//             const walletIdValue =
//                 typeof transaction.walletId === "object" &&
//                 transaction.walletId !== null
//                     ? (transaction.walletId as any)._id
//                     : transaction.walletId;

//             form.setFieldsValue({
//                 ...transaction,
//                 walletId: walletIdValue, // Sử dụng giá trị ID đã được trích xuất
//                 date: dayjs(transaction.date),
//             });

//             setEditingTransaction(transaction);
//             setIsModalVisible(true);
//         } catch (error) {
//             console.error("Lỗi khi tải dữ liệu:", error);
//             message.error("Không thể tải dữ liệu ví");
//         } finally {
//             setLoading(false);
//         }
//     };

//     // hàm tạo mới hoặc cập nhật giao dịch
//     const handleSubmit = async (values: any) => {
//         try {
//             setLoading(true);
//             const token = await currentUser?.getIdToken();
//             const walletId =
//                 typeof values.walletId === "object"
//                     ? values.walletId._id
//                     : values.walletId;

//             // Lấy thông tin ví để kiểm tra số dư
//             const wallet = wallets.find((w) => w._id === walletId);

//             // Kiểm tra nếu là giao dịch chi tiêu và số dư không đủ
//             if (
//                 values.type === "EXPENSE" &&
//                 wallet &&
//                 wallet.balance < values.amount
//             ) {
//                 const confirmMessage =
//                     `Số dư của ví ${wallet.name} không đủ để thực hiện giao dịch này.\n\n` +
//                     `Số dư hiện tại: ${formatCurrency(wallet.balance)}\n` +
//                     `Số tiền cần chi: ${formatCurrency(values.amount)}\n` +
//                     `Thiếu: ${formatCurrency(
//                         values.amount - wallet.balance
//                     )}\n\n`;

//                 if (!window.confirm(confirmMessage)) {
//                     setLoading(false);
//                     return;
//                 }
//             }

//             // Xác nhận trước khi tạo/cập nhật giao dịch
//             const action = editingTransaction ? "cập nhật" : "tạo mới";
//             const confirmMessage =
//                 `Bạn có chắc chắn muốn ${action} giao dịch này?\n\n` +
//                 `Số tiền: ${formatCurrency(values.amount)}\n` +
//                 `Loại: ${
//                     values.type === "INCOME" ? "Thu nhập" : "Chi tiêu"
//                 }\n` +
//                 `Danh mục: ${values.category}`;

//             if (!window.confirm(confirmMessage)) {
//                 setLoading(false);
//                 return;
//             }

//             const transactionData = {
//                 ...values,
//                 walletId,
//                 date: values.date.format("YYYY-MM-DD"),
//                 amount: Number(values.amount),
//             };

//             if (editingTransaction) {
//                 // Nếu đang cập nhật giao dịch, kiểm tra thêm
//                 if (values.type === "EXPENSE" && wallet) {
//                     const oldTransaction = transactions.find(
//                         (t) => t._id === editingTransaction._id
//                     );
//                     const oldAmount = oldTransaction?.amount || 0;
//                     const amountDiff = values.amount - oldAmount;

//                     if (amountDiff > 0 && wallet.balance < amountDiff) {
//                         const confirmMessage =
//                             `Số dư không đủ để cập nhật giao dịch.\n\n` +
//                             `Số dư hiện tại: ${formatCurrency(
//                                 wallet.balance
//                             )}\n` +
//                             `Số tiền tăng thêm: ${formatCurrency(
//                                 amountDiff
//                             )}\n` +
//                             `Thiếu: ${formatCurrency(
//                                 amountDiff - wallet.balance
//                             )}\n\n` +
//                             `Bạn có chắc chắn muốn tiếp tục?`;

//                         if (!window.confirm(confirmMessage)) {
//                             setLoading(false);
//                             return;
//                         }
//                     }
//                 }

//                 // Cập nhật giao dịch
//                 await axios.put(
//                     `${API_URL}/${editingTransaction._id}`,
//                     transactionData,
//                     {
//                         headers: {
//                             Authorization: `Bearer ${token}`,
//                             "Content-Type": "application/json",
//                         },
//                     }
//                 );
//                 message.success("Cập nhật giao dịch thành công");
//             } else {
//                 // Tạo mới giao dịch
//                 await axios.post(API_URL, transactionData, {
//                     headers: {
//                         Authorization: `Bearer ${token}`,
//                         "Content-Type": "application/json",
//                     },
//                 });
//                 message.success("Thêm giao dịch thành công");
//             }

//             // Đóng modal và reset form
//             setIsModalVisible(false);
//             form.resetFields();
//             setCustomCategory("");
//             setEditingTransaction(null);

//             await fetchTransactions(); // Làm mới danh sách
//         } catch (error: any) {
//             console.error("Lỗi khi lưu giao dịch:", error);
//             const errorMessage =
//                 error.response?.data?.message ||
//                 "Đã xảy ra lỗi. Vui lòng thử lại sau.";

//             // Sử dụng alert thay vì message để đảm bảo hiển thị
//             window.alert(`Lỗi: ${errorMessage}`);
//         } finally {
//             setLoading(false);
//         }
//     };

//     // Hàm xử lý khi thay đổi danh mục
//     const handleCategoryChange = (value: string) => {
//         setShowCustomCategory(value === "Khác");
//         if (value !== "Khác") {
//             form.setFieldsValue({ category: value });
//         }
//     };

//     // Xóa giao dịch
//     const handleDelete = async (id: string) => {
//         if (!window.confirm("Bạn có chắc chắn muốn xóa giao dịch này?")) {
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

//             message.success("Xóa giao dịch thành công");
//             fetchTransactions();
//         } catch (error) {
//             console.error("Lỗi khi xóa giao dịch:", error);
//             message.error("Có lỗi xảy ra khi xóa giao dịch");
//         } finally {
//             setLoading(false);
//         }
//     };

//     // const handleSubmit = async (values: any) => {
//     //     try {
//     //         setLoading(true);
//     //         const transactionData = {
//     //             ...values,
//     //             date: values.date.format("YYYY-MM-DD"),
//     //         };

//     //         // Gọi API tạo/cập nhật giao dịch
//     //         if (editingTransaction) {
//     //             // Cập nhật giao dịch
//     //             message.success("Cập nhật giao dịch thành công");
//     //         } else {
//     //             // Tạo mới giao dịch
//     //             message.success("Thêm giao dịch thành công");
//     //         }

//     //         setIsModalVisible(false);
//     //         form.resetFields();
//     //     } catch (error) {
//     //         message.error("Đã xảy ra lỗi. Vui lòng thử lại sau.");
//     //     } finally {
//     //         setLoading(false);
//     //     }
//     // };

//     return (
//         <div>
//             <div
//                 style={{
//                     marginBottom: 16,
//                     display: "flex",
//                     justifyContent: "space-between",
//                 }}
//             >
//                 <h2>Quản lý giao dịch</h2>
//                 <Button
//                     type="primary"
//                     icon={<PlusOutlined />}
//                     onClick={showModal}
//                 >
//                     Thêm giao dịch
//                 </Button>
//             </div>

//             <div style={{ marginBottom: 16 }}>
//                 <Space
//                     direction="vertical"
//                     style={{ width: "100%", marginBottom: 16 }}
//                 >
//                     <Space wrap>
//                         <RangePicker
//                             value={searchParams.dateRange}
//                             onChange={(dates) =>
//                                 setSearchParams({
//                                     ...searchParams,
//                                     dateRange: dates as [Dayjs, Dayjs] | null,
//                                 })
//                             }
//                             format="DD/MM/YYYY"
//                         />
//                         <Select
//                             placeholder="Chọn loại giao dịch"
//                             style={{ width: 150 }}
//                             value={searchParams.type}
//                             onChange={(value) =>
//                                 setSearchParams({
//                                     ...searchParams,
//                                     type: value,
//                                     category: undefined, // THÊM DÒNG NÀY: Tự động reset danh mục
//                                 })
//                             }
//                             allowClear
//                         >
//                             <Option value="INCOME">Thu nhập</Option>
//                             <Option value="EXPENSE">Chi tiêu</Option>
//                         </Select>
//                         {/* <Select
//                             placeholder="Chọn danh mục"
//                             style={{ width: 150 }}
//                             value={searchParams.category}
//                             onChange={(value) =>
//                                 setSearchParams({
//                                     ...searchParams,
//                                     category: value,
//                                 })
//                             }
//                             allowClear
//                         >
//                         </Select> */}
//                         <Select
//                             placeholder="Chọn danh mục"
//                             style={{ width: 150 }}
//                             value={searchParams.category}
//                             onChange={(value) =>
//                                 setSearchParams({
//                                     ...searchParams,
//                                     category: value,
//                                 })
//                             }
//                             allowClear
//                             showSearch // Thêm showSearch để người dùng có thể gõ tìm kiếm
//                             optionFilterProp="children"
//                             filterOption={(input, option) =>
//                                 (option?.children as unknown as string)
//                                     .toLowerCase()
//                                     .includes(input.toLowerCase())
//                             }
//                         >
//                             {filterableCategories.map((cat) => (
//                                 <Option key={cat} value={cat}>
//                                     {cat}
//                                 </Option>
//                             ))}
//                         </Select>
//                         <Select
//                             placeholder="Chọn ví"
//                             style={{ width: 150 }}
//                             value={searchParams.walletId}
//                             onChange={(value) =>
//                                 setSearchParams({
//                                     ...searchParams,
//                                     walletId: value,
//                                 })
//                             }
//                             allowClear
//                         >
//                             {wallets.map((wallet) => (
//                                 <Option key={wallet._id} value={wallet._id}>
//                                     {wallet.name}
//                                 </Option>
//                             ))}
//                         </Select>
//                         <Input
//                             placeholder="Tìm kiếm ghi chú"
//                             value={noteInput}
//                             onChange={(e) => setNoteInput(e.target.value)}
//                             onPressEnter={handleSearch}
//                             style={{ width: 200 }}
//                         />
//                         <Button
//                             style={{ display: "none" }}
//                             type="primary"
//                             onClick={handleSearch}
//                             icon={<SearchOutlined />}
//                         >
//                             Tìm kiếm
//                         </Button>
//                         <Button onClick={handleReset}>Đặt lại</Button>
//                     </Space>
//                 </Space>
//             </div>

//             <Table
//                 columns={columns}
//                 dataSource={transactions}
//                 rowKey="_id"
//                 pagination={{
//                     pageSize: 10,
//                     showSizeChanger: true,
//                     showTotal: (total) => `Tổng ${total} giao dịch`,
//                 }}
//                 scroll={{ x: 'max-content' }}
//             />

//             <Modal
//                 title={
//                     editingTransaction
//                         ? "Chỉnh sửa giao dịch"
//                         : "Thêm giao dịch mới"
//                 }
//                 open={isModalVisible}
//                 onCancel={() => setIsModalVisible(false)}
//                 footer={null}
//                 width={600}
//             >
//                 <Form
//                     form={form}
//                     layout="vertical"
//                     onFinish={handleSubmit}
//                     initialValues={{
//                         type: "EXPENSE",
//                         walletId: wallets[0]?._id,
//                         date: dayjs(),
//                     }}
//                 >
//                     <Form.Item
//                         name="type"
//                         label="Loại giao dịch"
//                         rules={[
//                             {
//                                 required: true,
//                                 message: "Vui lòng chọn loại giao dịch",
//                             },
//                         ]}
//                     >
//                         <Select>
//                             <Option value="INCOME">Thu nhập</Option>
//                             <Option value="EXPENSE">Chi tiêu</Option>
//                         </Select>
//                     </Form.Item>

//                     {/* <Form.Item
//                         noStyle
//                         shouldUpdate={(prevValues, currentValues) =>
//                             prevValues.type !== currentValues.type
//                         }
//                     >
//                         {({ getFieldValue }) => (
//                             <Form.Item
//                                 name="category"
//                                 label="Danh mục"
//                                 rules={[
//                                     {
//                                         required: true,
//                                         message: "Vui lòng chọn danh mục",
//                                     },
//                                 ]}
//                             >
//                                 <Select placeholder="Chọn danh mục">
//                                     {categories
//                                         .filter(
//                                             (cat) =>
//                                                 cat.type ===
//                                                 getFieldValue("type")
//                                         )
//                                         .map((cat) => (
//                                             <Option
//                                                 key={cat.name}
//                                                 value={cat.name}
//                                             >
//                                                 {cat.name}
//                                             </Option>
//                                         ))}
//                                 </Select>
//                             </Form.Item>
//                         )}
//                     </Form.Item> */}

//                     <Form.Item
//                         noStyle
//                         shouldUpdate={(prevValues, currentValues) =>
//                             prevValues.type !== currentValues.type
//                         }
//                     >
//                         {({ getFieldValue }) => (
//                             <Form.Item
//                                 name="category"
//                                 label="Danh mục"
//                                 rules={[
//                                     {
//                                         required: true,
//                                         message:
//                                             "Vui lòng chọn hoặc nhập danh mục",
//                                     },
//                                 ]}
//                             >
//                                 <Select
//                                     placeholder="Chọn danh mục"
//                                     popupRender={(menu) => (
//                                         <div>
//                                             {menu}
//                                             <div
//                                                 style={{
//                                                     padding: "8px",
//                                                     borderTop:
//                                                         "1px solid #f0f0f0",
//                                                 }}
//                                             >
//                                                 <Input
//                                                     placeholder="Nhập tên danh mục khác"
//                                                     value={customCategory}
//                                                     onChange={(e) => {
//                                                         const value =
//                                                             e.target.value;
//                                                         setCustomCategory(
//                                                             value
//                                                         );
//                                                         if (value) {
//                                                             form.setFieldsValue(
//                                                                 {
//                                                                     category:
//                                                                         value,
//                                                                 }
//                                                             );
//                                                         }
//                                                     }}
//                                                     style={{ width: "100%" }}
//                                                 />
//                                             </div>
//                                         </div>
//                                     )}
//                                 >
//                                     {categories
//                                         .filter(
//                                             (cat) =>
//                                                 cat.type ===
//                                                 getFieldValue("type")
//                                         )
//                                         .map((cat) => (
//                                             <Option
//                                                 key={cat.name}
//                                                 value={cat.name}
//                                             >
//                                                 {cat.name}
//                                             </Option>
//                                         ))}
//                                 </Select>
//                             </Form.Item>
//                         )}
//                     </Form.Item>

//                     <Form.Item
//                         name="amount"
//                         label="Số tiền"
//                         rules={[
//                             {
//                                 required: true,
//                                 message: "Vui lòng nhập số tiền",
//                             },
//                         ]}
//                     >
//                         <InputNumber
//                             style={{ width: "100%" }}
//                             formatter={(value) =>
//                                 `₫ ${value}`.replace(
//                                     /\B(?=(\d{3})+(?!\d))/g,
//                                     ","
//                                 )
//                             }
//                             parser={(value) =>
//                                 (value
//                                     ? Number(value.replace(/[^0-9.-]+/g, ""))
//                                     : 0) as 0
//                             }
//                             min={0}
//                         />
//                     </Form.Item>

//                     <Form.Item
//                         name="walletId"
//                         label="Ví"
//                         rules={[
//                             { required: true, message: "Vui lòng chọn ví" },
//                         ]}
//                     >
//                         <Select
//                             placeholder="Chọn ví"
//                             allowClear={false}
//                             showSearch
//                             optionFilterProp="children"
//                             filterOption={(input, option) =>
//                                 (option?.children as unknown as string)
//                                     .toLowerCase()
//                                     .includes(input.toLowerCase())
//                             }
//                         >
//                             {wallets.map((wallet) => (
//                                 <Option key={wallet._id} value={wallet._id}>
//                                     {wallet.name}
//                                 </Option>
//                             ))}
//                         </Select>
//                     </Form.Item>

//                     <Form.Item name="date" label="Ngày giao dịch">
//                         <DatePicker
//                             style={{ width: "100%" }}
//                             format="DD/MM/YYYY"
//                         />
//                     </Form.Item>

//                     <Form.Item name="note" label="Ghi chú">
//                         <Input.TextArea
//                             rows={3}
//                             placeholder="Nhập ghi chú (nếu có)"
//                         />
//                     </Form.Item>

//                     <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
//                         <Button
//                             style={{ marginRight: 8 }}
//                             onClick={() => setIsModalVisible(false)}
//                         >
//                             Hủy
//                         </Button>
//                         <Button
//                             type="primary"
//                             htmlType="submit"
//                             loading={loading}
//                         >
//                             {editingTransaction ? "Cập nhật" : "Thêm mới"}
//                         </Button>
//                     </Form.Item>
//                 </Form>
//             </Modal>
//         </div>
//     );
// };

// export default Transactions;

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
import { transactionApi, walletApi } from "../services/api"; // <-- Import từ api.ts

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
    const { currentUser } = useAuth();
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

    // Lấy danh sách ví từ API
    const fetchWallets = useCallback(async () => {
        try {
            const token = await currentUser?.getIdToken();
            const response = await walletApi.getWallets(token); // <-- Sử dụng walletApi

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
    }, [currentUser]);

    // lấy danh sách giao dịch từ API
    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const token = await currentUser?.getIdToken();

            const params: any = {};
            if (searchParams.dateRange?.[0] && searchParams.dateRange?.[1]) {
                params.startDate =
                    searchParams.dateRange[0].format("YYYY-MM-DD");
                params.endDate = searchParams.dateRange[1].format("YYYY-MM-DD");
            }
            if (searchParams.type) params.type = searchParams.type;
            if (searchParams.category) params.category = searchParams.category;
            if (searchParams.walletId) params.walletId = searchParams.walletId;
            if (searchParams.note) params.note = searchParams.note;

            const response = await transactionApi.getTransactions(params, token); // <-- Sử dụng transactionApi

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
        }
    }, [currentUser, fetchWallets]);
    
    useEffect(() => {
        if (currentUser) {
            fetchTransactions();
        }
    }, [currentUser, fetchTransactions]);

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
            dateRange: null,
            type: undefined,
            category: undefined,
            walletId: undefined,
            note: "",
        });
        setNoteInput("");
    };

    const columns: ColumnsType<Transaction> = [
        {
            title: "Ngày",
            dataIndex: "date",
            key: "date",
            render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
            sorter: (a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
        },
        {
            title: "Loại",
            dataIndex: "type",
            key: "type",
            render: (type: TransactionType) => (
                <span
                    style={{ color: type === "INCOME" ? "#52c41a" : "#f5222d" }}
                >
                    {type === "INCOME" ? "Thu nhập" : "Chi tiêu"}
                </span>
            ),
        },
        {
            title: "Danh mục",
            dataIndex: "category",
            key: "category",
        },
        {
            title: "Số tiền",
            dataIndex: "amount",
            key: "amount",
            render: (amount: number, record: Transaction) => (
                <span
                    style={{
                        color: record.type === "INCOME" ? "#52c41a" : "#f5222d",
                    }}
                >
                    {record.type === "EXPENSE" ? "-" : "+"}
                    {formatCurrency(amount)}
                </span>
            ),
            sorter: (a, b) => a.amount - b.amount,
        },
        {
            title: "Ghi chú",
            dataIndex: "note",
            key: "note",
            ellipsis: true,
        },
        {
            title: "Hành động",
            key: "action",
            render: (_, record) => (
                <Space size="middle" key={record._id}>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    />
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record._id)}
                    />
                </Space>
            ),
        },
    ];

    const showModal = () => {
        setEditingTransaction(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = async (transaction: Transaction) => {
        setEditingTransaction(transaction);
        const walletIdValue =
                typeof transaction.walletId === "object" &&
                transaction.walletId !== null
                    ? (transaction.walletId as any)._id
                    : transaction.walletId;

        form.setFieldsValue({
            ...transaction,
            walletId: walletIdValue,
            date: dayjs(transaction.date),
        });
        setIsModalVisible(true);
    };

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);
            const token = await currentUser?.getIdToken();
            const transactionData = {
                ...values,
                date: values.date.format("YYYY-MM-DD"),
                amount: Number(values.amount),
                category: values.category || customCategory
            };

            if (editingTransaction) {
                await transactionApi.updateTransaction(
                    editingTransaction._id,
                    transactionData,
                    token
                );
                message.success("Cập nhật giao dịch thành công");
            } else {
                await transactionApi.createTransaction(transactionData, token);
                message.success("Thêm giao dịch thành công");
            }

            setIsModalVisible(false);
            form.resetFields();
            setCustomCategory("");
            setEditingTransaction(null);

            await fetchTransactions();
            await fetchWallets(); // Cập nhật lại số dư ví
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
            const token = await currentUser?.getIdToken();
            await transactionApi.deleteTransaction(id, token);
            message.success("Xóa giao dịch thành công");
            await fetchTransactions();
            await fetchWallets();
        } catch (error: any) {
            console.error("Lỗi khi xóa giao dịch:", error);
            message.error(error.message || "Có lỗi xảy ra khi xóa giao dịch");
        } finally {
            setLoading(false);
        }
    };
    
    // RENDER PART
    return (
        <div>
            <div
                style={{
                    marginBottom: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: 'center'
                }}
            >
                <h2>Quản lý giao dịch</h2>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={showModal}
                >
                    Thêm giao dịch
                </Button>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Space
                    direction="vertical"
                    style={{ width: "100%", marginBottom: 16 }}
                >
                    <Space wrap>
                        <RangePicker
                            value={searchParams.dateRange}
                            onChange={(dates) =>
                                setSearchParams({
                                    ...searchParams,
                                    dateRange: dates as [Dayjs, Dayjs] | null,
                                })
                            }
                            format="DD/MM/YYYY"
                        />
                        <Select
                            placeholder="Chọn loại giao dịch"
                            style={{ width: 150 }}
                            value={searchParams.type}
                            onChange={(value) =>
                                setSearchParams({
                                    ...searchParams,
                                    type: value,
                                    category: undefined,
                                })
                            }
                            allowClear
                        >
                            <Option value="INCOME">Thu nhập</Option>
                            <Option value="EXPENSE">Chi tiêu</Option>
                        </Select>
                        <Select
                            placeholder="Chọn danh mục"
                            style={{ width: 150 }}
                            value={searchParams.category}
                            onChange={(value) =>
                                setSearchParams({
                                    ...searchParams,
                                    category: value,
                                })
                            }
                            allowClear
                            showSearch
                            optionFilterProp="children"
                        >
                            {filterableCategories.map((cat) => (
                                <Option key={cat} value={cat}>
                                    {cat}
                                </Option>
                            ))}
                        </Select>
                        <Select
                            placeholder="Chọn ví"
                            style={{ width: 150 }}
                            value={searchParams.walletId}
                            onChange={(value) =>
                                setSearchParams({
                                    ...searchParams,
                                    walletId: value,
                                })
                            }
                            allowClear
                        >
                            {wallets.map((wallet) => (
                                <Option key={wallet._id} value={wallet._id}>
                                    {wallet.name}
                                </Option>
                            ))}
                        </Select>
                        <Input
                            placeholder="Tìm kiếm ghi chú"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            onPressEnter={handleSearch}
                            style={{ width: 200 }}
                        />
                         <Button
                            type="primary"
                            onClick={handleSearch}
                            icon={<SearchOutlined />}
                        >
                            Tìm kiếm
                        </Button>
                        <Button onClick={handleReset}>Đặt lại</Button>
                    </Space>
                </Space>
            </div>

            <Table
                columns={columns}
                dataSource={transactions}
                rowKey="_id"
                loading={loading}
                pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Tổng ${total} giao dịch`,
                }}
                scroll={{ x: 'max-content' }}
            />

            <Modal
                title={
                    editingTransaction
                        ? "Chỉnh sửa giao dịch"
                        : "Thêm giao dịch mới"
                }
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={null}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        type: "EXPENSE",
                        walletId: wallets[0]?._id,
                        date: dayjs(),
                    }}
                >
                    <Form.Item
                        name="type"
                        label="Loại giao dịch"
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn loại giao dịch",
                            },
                        ]}
                    >
                        <Select onChange={() => form.setFieldsValue({ category: undefined })}>
                            <Option value="INCOME">Thu nhập</Option>
                            <Option value="EXPENSE">Chi tiêu</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                            prevValues.type !== currentValues.type
                        }
                    >
                        {({ getFieldValue }) => (
                            <Form.Item
                                name="category"
                                label="Danh mục"
                                rules={[
                                    {
                                        required: true,
                                        message:
                                            "Vui lòng chọn hoặc nhập danh mục",
                                    },
                                ]}
                            >
                                <Select
                                    placeholder="Chọn danh mục hoặc nhập mới"
                                    popupRender={(menu) => (
                                        <div>
                                            {menu}
                                            <div
                                                style={{
                                                    padding: "8px",
                                                    borderTop:
                                                        "1px solid #f0f0f0",
                                                }}
                                            >
                                                <Input
                                                    placeholder="Thêm danh mục mới"
                                                    value={customCategory}
                                                    onChange={(e) => {
                                                        const value =
                                                            e.target.value;
                                                        setCustomCategory(
                                                            value
                                                        );
                                                        if (value) {
                                                            form.setFieldsValue(
                                                                {
                                                                    category:
                                                                        value,
                                                                }
                                                            );
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                >
                                    {categories
                                        .filter(
                                            (cat) =>
                                                cat.type ===
                                                getFieldValue("type")
                                        )
                                        .map((cat) => (
                                            <Option
                                                key={cat.name}
                                                value={cat.name}
                                            >
                                                {cat.name}
                                            </Option>
                                        ))}
                                </Select>
                            </Form.Item>
                        )}
                    </Form.Item>

                    <Form.Item
                        name="amount"
                        label="Số tiền"
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng nhập số tiền",
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
                                    ? Number(value.replace(/[^0-9.-]+/g, ""))
                                    : 0) as 0
                            }
                            min={0}
                        />
                    </Form.Item>

                    <Form.Item
                        name="walletId"
                        label="Ví"
                        rules={[
                            { required: true, message: "Vui lòng chọn ví" },
                        ]}
                    >
                        <Select
                            placeholder="Chọn ví"
                            allowClear={false}
                            showSearch
                        >
                            {wallets.map((wallet) => (
                                <Option key={wallet._id} value={wallet._id}>
                                    {`${wallet.name} (${formatCurrency(wallet.balance)})`}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="date" label="Ngày giao dịch">
                        <DatePicker
                            style={{ width: "100%" }}
                            format="DD/MM/YYYY"
                        />
                    </Form.Item>

                    <Form.Item name="note" label="Ghi chú">
                        <Input.TextArea
                            rows={3}
                            placeholder="Nhập ghi chú (nếu có)"
                        />
                    </Form.Item>

                    <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
                        <Button
                            style={{ marginRight: 8 }}
                            onClick={() => setIsModalVisible(false)}
                            disabled={loading}
                        >
                            Hủy
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                        >
                            {editingTransaction ? "Cập nhật" : "Thêm mới"}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Transactions;