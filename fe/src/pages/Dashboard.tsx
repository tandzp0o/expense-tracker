import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { message, Spin } from "antd";
import { auth } from "../firebase/config";
import { walletApi, transactionApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import LineChart from "../components/charts/LineChart";

dayjs.locale("vi");

interface Transaction {
    _id: string;
    type: "INCOME" | "EXPENSE";
    amount: number | string;
    category: string;
    date: string;
    note?: string;
    status?: string;
}

interface Wallet {
    _id: string;
    name: string;
    balance: number;
}

const Dashboard: React.FC = () => {
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const parseAmount = (raw: unknown) => {
        if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
        if (typeof raw === "string") {
            const v = Number(raw.replace(/[^0-9.-]/g, ""));
            return Number.isFinite(v) ? v : 0;
        }
        return 0;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) return;
                const token = await firebaseUser.getIdToken();
                const now = dayjs();
                const startDate = now.subtract(6, "month").startOf("month").toISOString();
                const endDate = now.endOf("day").toISOString();

                const [walletsRes, txRes] = await Promise.all([
                    walletApi.getWallets(token),
                    transactionApi.getTransactions({ startDate, endDate }, token),
                ]);

                setWallets(walletsRes?.wallets || []);
                setTransactions(txRes?.data?.transactions || []);
            } catch (e) { message.error("Lỗi tải dữ liệu"); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const totalBalance = useMemo(() => wallets.reduce((sum, w) => sum + (w.balance || 0), 0), [wallets]);
    const monthlyIncome = useMemo(() => {
        const start = dayjs().startOf("month");
        return transactions.filter(t => t.type === "INCOME" && dayjs(t.date).isAfter(start)).reduce((sum, t) => sum + parseAmount(t.amount), 0);
    }, [transactions]);
    const monthlyExpense = useMemo(() => {
        const start = dayjs().startOf("month");
        return transactions.filter(t => t.type === "EXPENSE" && dayjs(t.date).isAfter(start)).reduce((sum, t) => sum + parseAmount(t.amount), 0);
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
                { label: "Thu nhập", data: incomeData, borderColor: "#10b981", tension: 0.4, fill: true, backgroundColor: "rgba(16, 185, 129, 0.05)" },
                { label: "Chi tiêu", data: expenseData, borderColor: "#f59e0b", tension: 0.4 }
            ]
        };
    }, [transactions]);

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Spin size="large" /></div>;

    return (
        <div className="flex-1 space-y-8 animate-in fade-in duration-500">
            {/* Header Area correctly handled by MainLayout, but keeping internal title for Dash view */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold dark:text-white">Tổng quan</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Chào mừng trở lại! Đây là tóm tắt tài chính của bạn.</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Balance */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Tổng số dư</p>
                        <h3 className="text-2xl font-bold mb-2 dark:text-white">{formatCurrency(totalBalance)}</h3>
                        <div className="flex items-center gap-1 text-emerald-500 text-sm font-bold">
                            <span className="material-symbols-outlined text-sm">trending_up</span>
                            <span>+5.2% tháng này</span>
                        </div>
                    </div>
                    {/* Decorative Trend Line (SVG) from template */}
                    <div className="absolute bottom-0 right-0 w-full h-16 opacity-30 pointer-events-none group-hover:opacity-40 transition-opacity">
                        <svg className="w-full h-full fill-none stroke-primary stroke-[3]" preserveAspectRatio="none" viewBox="0 0 500 100">
                            <path d="M0,80 Q50,60 100,70 T200,40 T300,50 T400,20 T500,10" strokeLinecap="round"></path>
                        </svg>
                    </div>
                </div>

                {/* Monthly Income */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center justify-between mb-4">
                        <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">call_received</span>
                        </div>
                        <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 px-2 py-1 rounded-md text-xs font-bold">+12%</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Thu nhập tháng này</p>
                    <h3 className="text-2xl font-bold mt-1 dark:text-white">{formatCurrency(monthlyIncome)}</h3>
                </div>

                {/* Monthly Expense */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center justify-between mb-4">
                        <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">call_made</span>
                        </div>
                        <span className="bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-1 rounded-md text-xs font-bold">-5%</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Chi tiêu tháng này</p>
                    <h3 className="text-2xl font-bold mt-1 dark:text-white">{formatCurrency(monthlyExpense)}</h3>
                </div>
            </div>

            {/* Middle Section: Analytics & Wallets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Analytics Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold dark:text-white">Thu nhập vs Chi tiêu</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Dữ liệu 6 tháng gần nhất</p>
                        </div>
                        <select className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm py-1.5 pl-3 pr-8 focus:ring-primary dark:text-slate-300">
                            <option>Năm 2024</option>
                            <option>Năm 2023</option>
                        </select>
                    </div>
                    <div className="h-64">
                         <LineChart data={chartData} options={{ maintainAspectRatio: false }} />
                    </div>
                    <div className="mt-6 flex justify-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="size-3 bg-primary rounded-full"></div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Thu nhập</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="size-3 bg-primary/20 rounded-full"></div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Chi tiêu</span>
                        </div>
                    </div>
                </div>

                {/* Wallets Preview Section */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold dark:text-white">Ví của tôi</h3>
                        <button className="text-primary text-sm font-bold hover:underline">Xem tất cả</button>
                    </div>
                    <div className="space-y-4">
                        {/* Primary Card Preview (Template Style) */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-primary to-[#6e64f1] text-white shadow-lg relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform">
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <span className="text-xs opacity-80 uppercase tracking-wide">{wallets[0]?.name || 'Visa Debit'}</span>
                                    <span className="material-symbols-outlined">contactless</span>
                                </div>
                                <p className="text-lg tracking-wide font-mono mb-4 text-center">**** **** **** 8899</p>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-xs uppercase opacity-70">Số dư</p>
                                        <p className="font-bold text-lg">{formatCurrency(wallets[0]?.balance || 0)}</p>
                                    </div>
                                    <div className="size-8 opacity-40 bg-white rounded-full"></div>
                                </div>
                            </div>
                            <div className="absolute -right-12 -bottom-12 size-36 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
                        </div>

                        {/* List items for other wallets */}
                        {wallets.slice(1, 4).map(w => (
                            <div key={w._id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold dark:text-white">{w.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Số dư hiện tại</p>
                                    </div>
                                </div>
                                <p className="text-sm font-bold dark:text-white">{formatCurrency(w.balance)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-lg font-bold dark:text-white">Giao dịch gần đây</h3>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold transition-all">Tất cả</button>
                        <button className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-500 transition-all">Thu nhập</button>
                        <button className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-500 transition-all">Chi tiêu</button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mô tả</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Danh mục</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ngày</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Số tiền</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {transactions.slice(0, 6).map(t => (
                                <tr key={t._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-8 ${t.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'} rounded-lg flex items-center justify-center`}>
                                                <span className="material-symbols-outlined text-base">{t.type === 'INCOME' ? 'payments' : 'shopping_bag'}</span>
                                            </div>
                                            <span className="text-sm font-medium dark:text-slate-200">{t.note || 'Giao dịch không tên'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{t.category}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{formatDate(t.date)}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap font-bold text-sm ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(parseAmount(t.amount))}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 text-xs font-bold rounded-full uppercase">
                                            Hoàn tất
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
