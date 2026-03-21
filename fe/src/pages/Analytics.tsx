import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { DatePicker, Select, Spin, message } from "antd";
import { auth } from "../firebase/config";
import { transactionApi, walletApi, goalApi, budgetApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";

dayjs.locale("vi");

const { RangePicker } = DatePicker;

interface Transaction {
    _id: string;
    type: "INCOME" | "EXPENSE";
    amount: number | string;
    category: string;
    date: string;
    note?: string;
}

const Analytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("current_month");
    const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

    const parseAmount = (raw: unknown) => {
        if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
        if (typeof raw === "string") {
            const v = Number(raw.replace(/[^0-9.-]/g, ""));
            return Number.isFinite(v) ? v : 0;
        }
        return 0;
    };

    const getDateRange = () => {
        const now = dayjs();
        switch (selectedPeriod) {
            case "current_month": return { start: now.startOf("month"), end: now.endOf("month") };
            case "last_month": return { start: now.subtract(1, "month").startOf("month"), end: now.subtract(1, "month").endOf("month") };
            case "last_3_months": return { start: now.subtract(3, "month").startOf("month"), end: now.endOf("month") };
            case "last_6_months": return { start: now.subtract(6, "month").startOf("month"), end: now.endOf("month") };
            case "custom": return customRange ? { start: customRange[0].startOf("day"), end: customRange[1].endOf("day") } : { start: now.startOf("month"), end: now.endOf("month") };
            default: return { start: now.startOf("month"), end: now.endOf("month") };
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) return;
                const token = await firebaseUser.getIdToken();
                const range = getDateRange();
                const txRes = await transactionApi.getTransactions({ startDate: range.start.toISOString(), endDate: range.end.toISOString(), limit: 1000 }, token);
                setTransactions(txRes?.data?.transactions || []);
            } catch (e) {
                message.error("Lỗi khi tải dữ liệu");
            } finally { setLoading(false); }
        };
        fetchData();
    }, [selectedPeriod, customRange]);

    const range = getDateRange();
    const stats = useMemo(() => {
        const income = transactions.filter(t => t.type === "INCOME").reduce((s, t) => s + parseAmount(t.amount), 0);
        const expense = transactions.filter(t => t.type === "EXPENSE").reduce((s, t) => s + parseAmount(t.amount), 0);
        return { income, expense, net: income - expense, count: transactions.length };
    }, [transactions]);

    const breakdown = useMemo(() => {
        const map: Record<string, number> = {};
        transactions.filter(t => t.type === "EXPENSE").forEach(t => { map[t.category] = (map[t.category] || 0) + parseAmount(t.amount); });
        const total = Object.values(map).reduce((s, v) => s + v, 0);
        const colors = ["#4137cd", "#10b981", "#ef4444", "#f59e0b", "#6366f1", "#14b8a6", "#ec4899"];
        return Object.entries(map).sort((a,b) => b[1] - a[1]).map(([name, val], i) => ({
            name, val, percent: total > 0 ? (val/total)*100 : 0, color: colors[i % colors.length]
        })).slice(0, 5);
    }, [transactions]);

    const chartData = useMemo(() => {
        const months = [];
        for (let i = 5; i >= 0; i--) {
            months.push(dayjs().subtract(i, 'month'));
        }

        const labels = months.map(m => `T${m.month() + 1}`);
        const incomeData = months.map(m => {
            return transactions
                .filter(t => t.type === "INCOME" && dayjs(t.date).isSame(m, 'month'))
                .reduce((sum, t) => sum + parseAmount(t.amount), 0);
        });
        const expenseData = months.map(m => {
            return transactions
                .filter(t => t.type === "EXPENSE" && dayjs(t.date).isSame(m, 'month'))
                .reduce((sum, t) => sum + parseAmount(t.amount), 0);
        });

        return {
            labels,
            datasets: [
                { label: "Thu nhập", data: incomeData, borderColor: "#10b981", tension: 0.4 },
                { label: "Chi tiêu", data: expenseData, borderColor: "#ef4444", tension: 0.4 }
            ]
        };
    }, [transactions]);

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Spin size="large" /></div>;

    const savingRate = stats.income > 0 ? (stats.net / stats.income) * 100 : 0;

    return (
        <div className="flex-1 space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Báo cáo & Phân tích</h2>
                    <p className="text-sm text-slate-500 mt-1">Cái nhìn tổng thể về sức khỏe tài chính của bạn</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedPeriod} onChange={setSelectedPeriod} className="w-40 h-10" options={[
                        { value: "current_month", label: "Tháng này" },
                        { value: "last_month", label: "Tháng trước" },
                        { value: "last_3_months", label: "3 tháng gần đây" },
                        { value: "custom", label: "Tùy chỉnh" },
                    ]} />
                    {selectedPeriod === "custom" && <RangePicker onChange={(d: any) => setCustomRange(d)} format="DD/MM/YYYY" className="h-10 rounded-xl" />}
                </div>
            </div>

            {/* Key Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: "Tổng thu nhập", val: stats.income, color: "text-emerald-500", icon: "payments", bg: "bg-emerald-50" },
                    { label: "Tổng chi tiêu", val: stats.expense, color: "text-red-500", icon: "shopping_bag", bg: "bg-red-50" },
                    { label: "Số dư ròng", val: stats.net, color: "text-primary", icon: "account_balance", bg: "bg-indigo-50" },
                    { label: "Tổng giao dịch", val: stats.count, color: "text-slate-600", icon: "receipt_long", bg: "bg-slate-50", format: false },
                ].map((s, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`size-10 rounded-xl ${s.bg} dark:bg-opacity-10 flex items-center justify-center`}>
                                <span className={`material-symbols-outlined ${s.color} text-xl`}>{s.icon}</span>
                            </div>
                            <span className="material-symbols-outlined text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">north_east</span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">{s.label}</p>
                        <h3 className={`text-2xl font-bold dark:text-white`}>
                            {s.format !== false ? formatCurrency(s.val) : s.val}
                        </h3>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-12 gap-8">
                {/* Trend Chart */}
                <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-lg font-bold dark:text-white uppercase tracking-tight">Biến động Thu & Chi</h3>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="size-2 rounded-full bg-emerald-500"></span>
                                <span className="text-xs font-bold text-slate-400 uppercase">Thu nhập</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="size-2 rounded-full bg-red-500"></span>
                                <span className="text-xs font-bold text-slate-400 uppercase">Chi tiêu</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-80">
                        <LineChart data={chartData} options={{ maintainAspectRatio: false, scales: { y: { display: false }, x: { grid: { display: false } } } }} />
                    </div>
                </div>

                {/* Categories Breakdown */}
                <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold dark:text-white uppercase tracking-tight mb-8">Chi tiêu theo hạng mục</h3>
                    <div className="space-y-6">
                        {breakdown.map((b, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                                    <span className="text-slate-500">{b.name}</span>
                                    <span className="text-slate-900 dark:text-white">{Math.round(b.percent)}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${b.percent}%`, backgroundColor: b.color }}></div>
                                </div>
                                <p className="text-xs font-bold text-slate-400 text-right">{formatCurrency(b.val)}</p>
                            </div>
                        ))}
                        {breakdown.length === 0 && (
                            <div className="h-60 flex flex-col items-center justify-center text-slate-400 space-y-2">
                                <span className="material-symbols-outlined text-4xl opacity-20">analytics</span>
                                <p className="italic text-sm">Chưa có dữ liệu chi tiêu</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary Insights */}
            <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden group">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-primary">insights</span>
                            <span className="text-xs font-bold uppercase tracking-wide text-primary">Tóm tắt Hiệu suất</span>
                        </div>
                        <h4 className="text-xl font-bold mb-2 uppercase tracking-tight">Cân bằng Tài chính</h4>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xl italic font-medium">
                            Bạn đã chi tiêu **{Math.round((stats.expense/stats.income)*100 || 0)}%** tổng thu nhập. Duy trì tỷ lệ này dưới 70% để đảm bảo khả năng tích lũy bền vững.
                        </p>
                    </div>
                    <div className="flex gap-12 text-center">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Tỷ lệ tiết kiệm</p>
                            <p className={`text-2xl font-bold ${savingRate > 20 ? 'text-emerald-500' : 'text-orange-500'}`}>{Math.round(savingRate)}%</p>
                        </div>
                        <div className="w-px h-12 bg-white/10 hidden md:block"></div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Dự phóng năm</p>
                            <p className="text-2xl font-bold text-primary">{formatCurrency(stats.net * 12)}</p>
                        </div>
                    </div>
                </div>
                {/* Decoration */}
                <div className="absolute top-0 right-0 size-64 bg-primary/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
            </div>
        </div>
    );
};


export default Analytics;
