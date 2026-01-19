import React, { useEffect, useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { Input, InputNumber, Modal, message, Spin } from "antd";
import { auth } from "../firebase/config";
import { budgetApi, transactionApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { useTheme } from "../contexts/ThemeContext";
import LineChart from "../components/charts/LineChart";
import AlertNotification from "../components/AlertNotification";

dayjs.locale("vi");

// --- Các Interface ---
interface Transaction {
    _id: string;
    type: "INCOME" | "EXPENSE" | "GOAL_DEPOSIT" | "GOAL_WITHDRAW";
    amount: number | string;
    category: string;
    date: string;
}

interface BudgetSummaryItem {
    _id: string;
    category: string;
    amount: number;
    spent: number;
    percent: number;
    month: number;
    year: number;
    note?: string;
}

interface BudgetSummaryResponse {
    month: number;
    year: number;
    totalBudget: number;
    totalSpent: number;
    items: BudgetSummaryItem[];
}

const moneyFormatter = (value: any) => `${value ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const moneyParser = (value: any) => value ? Number(String(value).replace(/[^0-9.-]+/g, "")) : 0;

const Budgets_new: React.FC = () => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryResponse | null>(null);

    // Trạng thái cho Modals
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [alertVisible, setAlertVisible] = useState(false);
    
    // Trạng thái Loading cho Actions
    const [submitting, setSubmitting] = useState(false);
    const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);

    // Dữ liệu Form
    const [formData, setFormData] = useState({
        id: "",
        category: "",
        amount: 0,
        note: ""
    });

    // --- Lấy dữ liệu ---
    const fetchData = useCallback(async () => {
        try {
            const firebaseUser = auth.currentUser;
            if (!firebaseUser) return;
            const token = await firebaseUser.getIdToken();

            const month = dayjs().month() + 1;
            const year = dayjs().year();

            const [summaryRes, txRes] = await Promise.all([
                budgetApi.getBudgetSummary({ month, year }, token),
                transactionApi.getTransactions({ 
                    startDate: dayjs().subtract(1, 'year').toISOString(), 
                    endDate: dayjs().toISOString(), 
                    type: "EXPENSE", 
                    limit: 1000 
                }, token),
            ]);

            setBudgetSummary(summaryRes as BudgetSummaryResponse);
            setTransactions(txRes?.data?.transactions || []);

            // Chọn mặc định category đầu tiên nếu chưa có category nào active
            const items = (summaryRes as BudgetSummaryResponse).items;
            if (!activeCategory && items.length > 0) {
                setActiveCategory(items[0].category);
            }
        } catch (e) {
            message.error("Không thể tải dữ liệu ngân sách");
        } finally {
            setLoading(false);
        }
    }, [activeCategory]);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            if (user) fetchData();
            else setLoading(false);
        });
        return () => unsub();
    }, [fetchData]);

    // --- Tính toán dữ liệu hiển thị ---
    const budgetItems = useMemo(() => {
        const colors = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#14b8a6", "#eab308"];
        return (budgetSummary?.items || []).map((b, idx) => ({
            ...b,
            color: colors[idx % colors.length],
        })).sort((a, b) => b.spent - a.spent);
    }, [budgetSummary]);

    const selectedBudget = useMemo(() => 
        budgetItems.find(b => b.category === activeCategory) || null
    , [activeCategory, budgetItems]);

    // --- Handlers cho Thêm/Sửa/Xóa ---
    const handleOpenCreate = () => {
        setFormData({ id: "", category: "", amount: 0, note: "" });
        setCreateOpen(true);
    };

    const handleOpenEdit = () => {
        if (!selectedBudget) return;
        setFormData({
            id: selectedBudget._id,
            category: selectedBudget.category,
            amount: selectedBudget.amount,
            note: selectedBudget.note || ""
        });
        setEditOpen(true);
    };

    const handleDeleteClick = () => {
        if (!selectedBudget) return;
        setBudgetToDelete(selectedBudget._id);
        setAlertVisible(true);
    };

    const handleAction = async (actionType: "create" | "update") => {
        if (!formData.category.trim() || formData.amount <= 0) {
            return message.warning("Vui lòng nhập đầy đủ thông tin");
        }

        try {
            setSubmitting(true);
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            const payload = {
                category: formData.category,
                amount: formData.amount,
                month: dayjs().month() + 1,
                year: dayjs().year(),
                note: formData.note
            };

            if (actionType === "create") {
                await budgetApi.createBudget(payload, token);
                message.success("Đã thêm ngân sách");
            } else {
                await budgetApi.updateBudget(formData.id, payload, token);
                message.success("Đã cập nhật ngân sách");
            }

            setCreateOpen(false);
            setEditOpen(false);
            setActiveCategory(formData.category);
            fetchData(); // Tải lại dữ liệu
        } catch (e: any) {
            message.error(e.message || "Thao tác thất bại");
        } finally {
            setSubmitting(false);
        }
    };

    const confirmDelete = async () => {
        if (!budgetToDelete) return;
        try {
            setSubmitting(true);
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            await budgetApi.deleteBudget(budgetToDelete, token);
            message.success("Đã xóa ngân sách");
            setAlertVisible(false);
            setActiveCategory(null);
            fetchData();
        } catch (e) {
            message.error("Không thể xóa ngân sách");
        } finally {
            setSubmitting(false);
            setBudgetToDelete(null);
        }
    };

    if (loading) return <div style={{ textAlign: "center", padding: "100px" }}><Spin size="large" /></div>;

    return (
        <div className="ekash_page">
            <div className="ekash_page_header">
                <div>
                    <h2 className="ekash_title">Ngân sách</h2>
                    <p className="ekash_subtitle">Quản lý hạn mức chi tiêu theo tháng</p>
                </div>
            </div>

            <div className="ekash_grid_main">
                {/* Danh sách ngân sách bên trái */}
                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Tất cả ngân sách</p>
                    </div>
                    <div className="ekash_list">
                        {budgetItems.map((b) => (
                            <button
                                key={b._id}
                                className={`ekash_list_row ${b.category === activeCategory ? "is_active" : ""}`}
                                onClick={() => setActiveCategory(b.category)}
                            >
                                <span className="left">
                                    <span className="dot" style={{ backgroundColor: b.color }} />
                                    <span className="name">{b.category}</span>
                                </span>
                                <span className="right">
                                    <span className="amt">{formatCurrency(b.spent)}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                    <button className="ekash_add_budget" onClick={handleOpenCreate}>
                        + Thêm ngân sách
                    </button>
                </div>

                {/* Chi tiết bên phải */}
                <div className="ekash_card">
                    {selectedBudget ? (
                        <>
                            <div className="ekash_card_header">
                                <p className="ekash_card_title">{selectedBudget.category}</p>
                                <span className="ekash_card_hint">Tháng {selectedBudget.month}</span>
                            </div>
                            
                            <div className="ekash_budget_summary">
                                <div className="ekash_budget_summary_row">
                                    <div className="left">
                                        <div className="label">Đã tiêu</div>
                                        <div className="value">{formatCurrency(selectedBudget.spent)}</div>
                                    </div>
                                    <div className="right">
                                        <div className="label">Hạn mức</div>
                                        <div className="value">{formatCurrency(selectedBudget.amount)}</div>
                                    </div>
                                </div>
                                <div className="ekash_progress ekash_progress_lg">
                                    <span 
                                        className="bar" 
                                        style={{ 
                                            width: `${Math.min(selectedBudget.percent, 100)}%`, 
                                            backgroundColor: selectedBudget.color 
                                        }} 
                                    />
                                </div>
                                <p style={{ marginTop: 10, fontSize: 13, color: '#64748b' }}>
                                    Còn lại: {formatCurrency(Math.max(selectedBudget.amount - selectedBudget.spent, 0))}
                                </p>
                            </div>

                            <div className="ekash_actions" style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                                <button className="ekash_btn" onClick={handleOpenEdit}>Cập nhật</button>
                                <button className="ekash_btn danger" onClick={handleDeleteClick}>Xóa</button>
                            </div>
                        </>
                    ) : (
                        <div className="ekash_empty">Vui lòng chọn ngân sách để xem chi tiết</div>
                    )}
                </div>
            </div>

            {/* Modal Thêm/Sửa */}
            <Modal
                title={editOpen ? "Cập nhật ngân sách" : "Thêm ngân sách mới"}
                open={createOpen || editOpen}
                onCancel={() => { setCreateOpen(false); setEditOpen(false); }}
                onOk={() => handleAction(editOpen ? "update" : "create")}
                confirmLoading={submitting}
                destroyOnClose
            >
                <div className="ekash_form" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 10 }}>
                    <div>
                        <div style={{ marginBottom: 4 }}>Tên danh mục</div>
                        <Input 
                            value={formData.category} 
                            onChange={e => setFormData({...formData, category: e.target.value})}
                            placeholder="Ví dụ: Ăn uống, Di chuyển..."
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: 4 }}>Hạn mức chi tiêu</div>
                        <InputNumber
                            style={{ width: '100%' }}
                            value={formData.amount}
                            onChange={v => setFormData({...formData, amount: v || 0})}
                            formatter={moneyFormatter}
                            parser={moneyParser as any}
                            min={0}
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: 4 }}>Ghi chú</div>
                        <Input 
                            value={formData.note} 
                            onChange={e => setFormData({...formData, note: e.target.value})}
                        />
                    </div>
                </div>
            </Modal>

            {/* Alert xác nhận xóa (Sử dụng đúng Component bạn đã gửi) */}
            <AlertNotification
                visible={alertVisible}
                onConfirm={confirmDelete}
                onCancel={() => setAlertVisible(false)}
                title="Xác nhận xóa ngân sách"
                content={`Bạn có chắc chắn muốn xóa ngân sách cho danh mục "${selectedBudget?.category}" không? Dữ liệu chi tiêu cũ vẫn sẽ được giữ lại.`}
                confirmText={submitting ? "Đang xóa..." : "Xóa ngay"}
                type="error"
            />
        </div>
    );
};

export default Budgets_new;