import React, { useEffect, useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { Input, InputNumber, Modal, message, Spin, Progress, Button } from "antd";
import { auth } from "../firebase/config";
import { budgetApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import AlertNotification from "../components/AlertNotification";

dayjs.locale("vi");

interface BudgetSummaryItem {
    _id: string;
    category: string;
    amount: number;
    spent: number;
    percent: number;
}

const Budgets: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [budgets, setBudgets] = useState<BudgetSummaryItem[]>([]);
    const [totalBudget, setTotalBudget] = useState(0);
    const [totalSpent, setTotalSpent] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({ id: "", category: "", amount: 0 });
    const [editing, setEditing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            const res: any = await budgetApi.getBudgetSummary({ month: dayjs().month() + 1, year: dayjs().year() }, token);
            setBudgets(res?.items || []);
            setTotalBudget(res?.totalBudget || 0);
            setTotalSpent(res?.totalSpent || 0);
        } catch (e) { message.error("Lỗi tải dữ liệu"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Spin size="large" /></div>;

    const remaining = totalBudget - totalSpent;
    const spentPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return (
        <div className="flex-1 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight dark:text-white">Quản lý Ngân sách</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Thiết lập giới hạn chi tiêu để tối ưu hóa dòng tiền</p>
                </div>
                <button onClick={() => { setEditing(false); setFormData({ id: "", category: "", amount: 0 }); setModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined">add_task</span>
                    <span>Tạo ngân sách</span>
                </button>
            </div>

            {/* Summary Section (Template Style) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <p className="text-slate-500 text-sm font-medium">Tổng ngân sách</p>
                        <span className="material-symbols-outlined text-primary">account_balance</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
                    <div className="flex items-center gap-1 text-emerald-500 text-sm font-bold">
                        <span className="material-symbols-outlined text-sm">trending_up</span>
                        <span>+5.2% so với tháng trước</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <p className="text-slate-500 text-sm font-medium">Đã chi tiêu</p>
                        <span className="material-symbols-outlined text-primary">shopping_cart</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
                    <div className="flex items-center gap-1 text-sm font-bold" style={{ color: spentPercent > 85 ? '#ef4444' : '#10b981' }}>
                        <span className="material-symbols-outlined text-sm">{spentPercent > 85 ? 'warning' : 'check_circle'}</span>
                        <span>{spentPercent > 85 ? 'Sắp chạm hạn mức' : `Dưới hạn mức ${Math.round(100 - spentPercent)}%`}</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <p className="text-slate-500 text-sm font-medium">Còn lại</p>
                        <span className="material-symbols-outlined text-primary">savings</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(remaining)}</p>
                    <div className="flex items-center gap-1 text-slate-500 text-sm font-medium">
                        <span>Cho {dayjs().daysInMonth() - dayjs().date()} ngày còn lại</span>
                    </div>
                </div>
            </div>

            {/* Category Grid (Template Style) */}
            <section className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold dark:text-white">Chi tiết danh mục</h3>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">Tháng này</button>
                        <button className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold border border-primary/10">Tùy chỉnh</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {budgets.map(b => {
                        const statusColor = b.percent > 100 ? 'red' : b.percent > 85 ? 'yellow' : 'emerald';
                        const statusText = b.percent > 100 ? `Vượt ngân sách ${formatCurrency(b.spent - b.amount)}` : b.percent > 85 ? 'Sắp chạm ngưỡng hạn mức' : b.percent < 30 ? 'Ngân sách dồi dào' : 'Đang trong tầm kiểm soát';
                        return (
                            <div key={b._id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 group hover:shadow-md transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`size-10 rounded-full bg-${statusColor}-100 dark:bg-${statusColor}-900/30 text-${statusColor}-600 flex items-center justify-center`}>
                                            <span className="material-symbols-outlined">category</span>
                                        </div>
                                        <h4 className="font-bold dark:text-white">{b.category}</h4>
                                    </div>
                                    <span className="text-sm font-medium text-slate-500">{Math.round(b.percent)}%</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                                        <span>Đã tiêu: {formatCurrency(b.spent)}</span>
                                        <span>Hạn mức: {formatCurrency(b.amount)}</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-1000 ${b.percent > 100 ? 'bg-red-500' : b.percent > 85 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(b.percent, 100)}%` }}></div>
                                    </div>
                                </div>
                                <p className={`text-xs font-medium text-${statusColor}-500`}>{statusText}</p>
                                <div className="pt-2 border-t border-slate-50 dark:border-slate-800 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); setEditing(true); setFormData({ id: b._id, category: b.category, amount: b.amount }); setModalOpen(true); }} className="text-primary text-xs font-bold uppercase tracking-wide hover:underline">Điều chỉnh</button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add Category Card (Template Style) */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border-dashed border-2 border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
                        <button onClick={() => { setEditing(false); setFormData({ id: "", category: "", amount: 0 }); setModalOpen(true); }} className="flex flex-col items-center justify-center gap-2 h-full py-8 text-slate-400 hover:text-primary transition-colors group">
                            <div className="size-12 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center group-hover:border-primary">
                                <span className="material-symbols-outlined text-3xl">add</span>
                            </div>
                            <span className="font-bold text-sm">Thêm danh mục mới</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Recommendation Section (Template Style) */}
            <section className="bg-primary/5 rounded-2xl p-8 border border-primary/10 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 flex flex-col gap-2">
                    <span className="px-3 py-1 bg-primary text-white text-xs font-bold uppercase tracking-wide rounded-full w-fit">Gợi ý AI</span>
                    <h4 className="text-xl font-bold dark:text-white">Tối ưu hóa chi phí đi lại</h4>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">Chúng tôi nhận thấy bạn đã vượt 10% ngân sách di chuyển. Hãy thử sử dụng các phương tiện công cộng hoặc đi chung xe để tiết kiệm khoảng 500.000 ₫ mỗi tháng.</p>
                    <button className="mt-4 text-primary text-sm font-bold flex items-center gap-1 hover:underline w-fit">
                        Xem chi tiết phân tích
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                </div>
                <div className="w-full md:w-64 bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                            <span>Tiết kiệm dự kiến</span>
                            <span className="text-primary">+15%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: '65%' }}></div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="size-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                            </div>
                            <p className="text-xs font-medium dark:text-white">Đặt mục tiêu tiết kiệm ngay</p>
                        </div>
                    </div>
                </div>
            </section>

            <Modal title={editing ? "Cập nhật ngân sách" : "Tạo ngân sách mới"} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} centered className="premium-modal">
                <div className="py-2 space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên danh mục</label>
                        <Input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Ví dụ: Ăn uống, Giải trí..." size="large" className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Hạn mức tháng (₫)</label>
                        <InputNumber style={{ width: '100%' }} value={formData.amount} onChange={v => setFormData({ ...formData, amount: Number(v) })} size="large" className="rounded-xl h-11" placeholder="0" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} parser={v => parseFloat(v!.replace(/\$\s?|(,*)/g, "")) || 0} />
                    </div>
                    <div className="flex justify-end pt-4 gap-3">
                        <button onClick={() => setModalOpen(false)} className="h-11 px-8 rounded-xl uppercase text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">Bỏ qua</button>
                        <button onClick={async () => {
                            const token = await auth.currentUser?.getIdToken();
                            if (!token) return;
                            if (editing) await budgetApi.updateBudget(formData.id, { ...formData, month: dayjs().month() + 1, year: dayjs().year() }, token);
                            else await budgetApi.createBudget({ ...formData, month: dayjs().month() + 1, year: dayjs().year() }, token);
                            fetchData(); setModalOpen(false); message.success("Đã lưu thành công!");
                        }} className="bg-primary text-white h-11 px-8 rounded-xl uppercase text-xs font-bold shadow-lg shadow-primary/20">Lưu ngân sách</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};


export default Budgets;
