import React, { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { App, Input, InputNumber, Modal, Spin } from "antd";
import { auth } from "../firebase/config";
import { budgetApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";

dayjs.locale("vi");

interface BudgetSummaryItem {
    _id: string;
    category: string;
    amount: number;
    spent: number;
    percent: number;
}

const Budgets: React.FC = () => {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [budgets, setBudgets] = useState<BudgetSummaryItem[]>([]);
    const [growth, setGrowth] = useState(0);
    const [totalBudget, setTotalBudget] = useState(0);
    const [totalSpent, setTotalSpent] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        id: "",
        category: "",
        amount: 0,
    });

    const fetchData = useCallback(async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            const res: any = await budgetApi.getBudgetSummary(
                { month: dayjs().month() + 1, year: dayjs().year() },
                token,
            );
            setBudgets(res?.items || []);
            setTotalBudget(res?.totalBudget || 0);
            setTotalSpent(res?.totalSpent || 0);
            setGrowth(res?.growth || 0);
        } catch (error: any) {
            message.error(error.message || "Lỗi tải dữ liệu");
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openCreate = () => {
        setEditing(false);
        setFormData({ id: "", category: "", amount: 0 });
        setModalOpen(true);
    };

    const openEdit = (budget: BudgetSummaryItem) => {
        setEditing(true);
        setFormData({
            id: budget._id,
            category: budget.category,
            amount: budget.amount,
        });
        setModalOpen(true);
    };

    const handleDelete = async (budgetId: string) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            await budgetApi.deleteBudget(budgetId, token);
            message.success("Đã xóa ngân sách");
            fetchData();
        } catch (error: any) {
            message.error(error.message || "Lỗi xóa ngân sách");
        }
    };

    const handleSubmit = async () => {
        if (!formData.category.trim()) {
            message.warning("Vui lòng nhập tên danh mục");
            return;
        }
        if (formData.amount <= 0) {
            message.warning("Vui lòng nhập hạn mức hợp lệ");
            return;
        }

        try {
            setSubmitting(true);
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            const payload = {
                category: formData.category.trim(),
                amount: formData.amount,
                month: dayjs().month() + 1,
                year: dayjs().year(),
            };

            if (editing) {
                await budgetApi.updateBudget(formData.id, payload, token);
                message.success("Đã cập nhật ngân sách");
            } else {
                await budgetApi.createBudget(payload, token);
                message.success("Đã tạo ngân sách");
            }

            setModalOpen(false);
            fetchData();
        } catch (error: any) {
            message.error(error.message || "Lỗi lưu ngân sách");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spin size="large" />
            </div>
        );
    }

    const remaining = totalBudget - totalSpent;
    const spentPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return (
        <div className="flex-1 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight dark:text-white">
                        Quản lý Ngân sách
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Thiết lập giới hạn chi tiêu để tối ưu hóa dòng tiền
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined">add_task</span>
                    <span>Tạo ngân sách</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <p className="text-slate-500 text-sm font-medium">
                            Tổng ngân sách
                        </p>
                        <span className="material-symbols-outlined text-primary">
                            account_balance
                        </span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white">
                        {formatCurrency(totalBudget)}
                    </p>
                    <div
                        className={`flex items-center gap-1 ${
                            growth >= 0 ? "text-emerald-500" : "text-red-500"
                        } text-sm font-bold`}
                    >
                        <span className="material-symbols-outlined text-sm">
                            {growth >= 0 ? "trending_up" : "trending_down"}
                        </span>
                        <span>
                            {growth > 0 ? "+" : ""}
                            {growth}% so với tháng trước
                        </span>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <p className="text-slate-500 text-sm font-medium">
                            Đã chi tiêu
                        </p>
                        <span className="material-symbols-outlined text-primary">
                            shopping_cart
                        </span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white">
                        {formatCurrency(totalSpent)}
                    </p>
                    <div
                        className="flex items-center gap-1 text-sm font-bold"
                        style={{
                            color: spentPercent > 85 ? "#ef4444" : "#10b981",
                        }}
                    >
                        <span className="material-symbols-outlined text-sm">
                            {spentPercent > 85 ? "warning" : "check_circle"}
                        </span>
                        <span>
                            {spentPercent > 85
                                ? "Sắp chạm hạn mức"
                                : `Dưới hạn mức ${Math.max(
                                      0,
                                      Math.round(100 - spentPercent),
                                  )}%`}
                        </span>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <p className="text-slate-500 text-sm font-medium">
                            Còn lại
                        </p>
                        <span className="material-symbols-outlined text-primary">
                            savings
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                        {formatCurrency(remaining)}
                    </p>
                    <div className="flex items-center gap-1 text-slate-500 text-sm font-medium dark:text-slate-400">
                        <span>
                            Cho {dayjs().daysInMonth() - dayjs().date() + 1} ngày
                            còn lại
                        </span>
                    </div>
                </div>
            </div>

            <section className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold dark:text-white">
                        Chi tiết danh mục
                    </h3>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                            Tháng này
                        </button>
                        <button className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold border border-primary/10">
                            Tùy chỉnh
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {budgets.map((budget) => {
                        const statusText =
                            budget.percent > 100
                                ? `Vượt ngân sách ${formatCurrency(
                                      budget.spent - budget.amount,
                                  )}`
                                : budget.percent > 85
                                  ? "Sắp chạm ngưỡng hạn mức"
                                  : budget.percent < 30
                                    ? "Ngân sách dồi dào"
                                    : "Đang trong tầm kiểm soát";

                        return (
                            <div
                                key={budget._id}
                                className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 group hover:shadow-md transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                            <span className="material-symbols-outlined">
                                                category
                                            </span>
                                        </div>
                                        <h4 className="font-bold dark:text-white">
                                            {budget.category}
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-500">
                                            {Math.round(budget.percent)}%
                                        </span>
                                        <button
                                            onClick={() =>
                                                handleDelete(budget._id)
                                            }
                                            className="size-8 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <span className="material-symbols-outlined text-sm">
                                                delete
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                                        <span>
                                            Đã tiêu: {formatCurrency(budget.spent)}
                                        </span>
                                        <span>
                                            Hạn mức: {formatCurrency(budget.amount)}
                                        </span>
                                    </div>
                                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${
                                                budget.percent > 100
                                                    ? "bg-red-500"
                                                    : budget.percent > 85
                                                      ? "bg-yellow-500"
                                                      : "bg-emerald-500"
                                            }`}
                                            style={{
                                                width: `${Math.min(
                                                    budget.percent,
                                                    100,
                                                )}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs font-medium text-slate-500">
                                    {statusText}
                                </p>
                                <div className="pt-2 border-t border-slate-50 dark:border-slate-800 flex justify-end">
                                    <button
                                        onClick={() => openEdit(budget)}
                                        className="text-primary text-xs font-bold uppercase tracking-wide hover:underline"
                                    >
                                        Điều chỉnh
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border-dashed border-2 border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
                        <button
                            onClick={openCreate}
                            className="flex flex-col items-center justify-center gap-2 h-full py-8 text-slate-400 hover:text-primary transition-colors group"
                        >
                            <div className="size-12 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center group-hover:border-primary">
                                <span className="material-symbols-outlined text-3xl">
                                    add
                                </span>
                            </div>
                            <span className="font-bold text-sm">
                                Thêm danh mục mới
                            </span>
                        </button>
                    </div>
                </div>
            </section>

            <Modal
                title={editing ? "Cập nhật ngân sách" : "Tạo ngân sách mới"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                footer={null}
                centered
                className="premium-modal"
            >
                <div className="py-2 space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Tên danh mục
                        </label>
                        <Input
                            value={formData.category}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    category: e.target.value,
                                }))
                            }
                            placeholder="Ví dụ: Ăn uống, Giải trí..."
                            size="large"
                            className="rounded-xl h-11"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Hạn mức tháng (₫)
                        </label>
                        <InputNumber
                            style={{ width: "100%" }}
                            value={formData.amount}
                            onChange={(v) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    amount: Number(v) || 0,
                                }))
                            }
                            size="large"
                            className="rounded-xl h-11"
                            placeholder="0"
                        />
                    </div>
                    <div className="flex justify-end pt-4 gap-3">
                        <button
                            onClick={() => setModalOpen(false)}
                            className="h-11 px-8 rounded-xl uppercase text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Bỏ qua
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="bg-primary text-white h-11 px-8 rounded-xl uppercase text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-60"
                        >
                            {submitting
                                ? "Đang lưu..."
                                : editing
                                  ? "Cập nhật"
                                  : "Lưu ngân sách"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Budgets;
