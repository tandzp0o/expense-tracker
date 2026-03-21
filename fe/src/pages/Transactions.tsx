import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { DatePicker, Input, InputNumber, Modal, Select, Spin, message, Popconfirm } from "antd";
import { auth } from "../firebase/config";
import { transactionApi, walletApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";

dayjs.locale("vi");

interface Transaction {
    _id: string;
    walletId: string | { _id: string; name?: string };
    type: "INCOME" | "EXPENSE" | "GOAL_DEPOSIT" | "GOAL_WITHDRAW";
    amount: number | string;
    category: string;
    date: string;
    note?: string;
}

const Transactions: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [wallets, setWallets] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Transaction | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [formValues, setFormValues] = useState({
        type: "EXPENSE" as "INCOME" | "EXPENSE",
        amount: 0,
        note: "",
        category: "Ăn uống",
        walletId: "",
        date: dayjs().toISOString()
    });

    const categories = [
        "Ăn uống", "Di chuyển", "Mua sắm", "Giải trí", "Sức khỏe", "Giáo dục", "Hóa đơn", "Khác"
    ];

    const fetchAll = useCallback(async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            const [walletRes, txRes] = await Promise.all([
                walletApi.getWallets(token),
                transactionApi.getTransactions({ limit: 1000 }, token),
            ]);
            const walletList = walletRes?.wallets || [];
            if (walletList.length > 0 && !formValues.walletId) {
                setFormValues(prev => ({ ...prev, walletId: walletList[0]._id }));
            }
            setWallets(walletList);
            setTransactions(txRes?.data?.transactions || []);
        } catch (e) { message.error("Lỗi tải dữ liệu"); }
        finally { setLoading(false); }
    }, [formValues.walletId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const filtered = useMemo(() => {
        return transactions.filter(t => 
            t.note?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            t.category?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [transactions, searchQuery]);

    const parseAmount = (raw: any) => {
        if (typeof raw === 'number') return raw;
        if (typeof raw === 'string') return parseFloat(raw.replace(/[^0-9.-]/g, '')) || 0;
        return 0;
    };

    const handleOpenModal = (t: Transaction | null = null) => {
        if (t) {
            setEditing(t);
            setFormValues({
                type: (t.type === "INCOME" || t.type === "EXPENSE") ? t.type : "EXPENSE",
                amount: parseAmount(t.amount),
                note: t.note || "",
                category: t.category,
                walletId: typeof t.walletId === 'string' ? t.walletId : t.walletId?._id || "",
                date: t.date
            });
        } else {
            setEditing(null);
            setFormValues({
                type: "EXPENSE",
                amount: 0,
                note: "",
                category: "Ăn uống",
                walletId: wallets[0]?._id || "",
                date: dayjs().toISOString()
            });
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formValues.walletId) {
            message.warning("Vui lòng chọn ví");
            return;
        }
        if (formValues.amount <= 0) {
            message.warning("Vui lòng nhập số tiền hợp lệ");
            return;
        }

        setSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            if (editing) {
                await transactionApi.updateTransaction(editing._id, formValues, token);
                message.success("Đã cập nhật giao dịch");
            } else {
                await transactionApi.createTransaction(formValues, token);
                message.success("Đã thêm giao dịch mới");
            }
            setModalOpen(false);
            fetchAll();
        } catch (e: any) {
            message.error(e.message || "Lỗi lưu giao dịch");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            await transactionApi.deleteTransaction(id, token);
            message.success("Đã xóa giao dịch");
            fetchAll();
        } catch (e: any) {
            message.error(e.message || "Lỗi xóa giao dịch");
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Spin size="large" /></div>;

    return (
        <div className="flex-1 space-y-8 animate-in fade-in duration-500">
            {/* Page Title & Add Button */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight dark:text-white">Giao dịch</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Tra cứu và quản lý tất cả các hoạt động tài chính của bạn</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()} 
                    className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    <span>Thêm giao dịch</span>
                </button>
            </div>

            {/* Filters Section (Template Style) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                         <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                         <input 
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary dark:text-slate-200" 
                            placeholder="Tìm kiếm giao dịch theo ghi chú hoặc hạng mục..." 
                            type="text" 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:border-primary/50 transition-colors dark:text-slate-300">
                        <span className="material-symbols-outlined text-lg">calendar_today</span>
                        Khoảng ngày
                        <span className="material-symbols-outlined text-lg">expand_more</span>
                    </button>
                    
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:border-primary/50 transition-colors dark:text-slate-300">
                        <span className="material-symbols-outlined text-lg">category</span>
                        Hạng mục
                        <span className="material-symbols-outlined text-lg">expand_more</span>
                    </button>

                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:border-primary/50 transition-colors dark:text-slate-300">
                        <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                        Ví tiền
                        <span className="material-symbols-outlined text-lg">expand_more</span>
                    </button>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <button className="text-primary text-sm font-semibold hover:underline" onClick={() => setSearchQuery("")}>Xóa bộ lọc</button>
                </div>
            </div>

            {/* Transaction Table Card (Sync with Dashboard Style) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mô tả</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hạng mục</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ngày & Giờ</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ví</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Số tiền</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filtered.map(t => (
                                <tr 
                                    key={t._id} 
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer" 
                                    onClick={() => handleOpenModal(t)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-10 rounded-lg flex items-center justify-center ${t.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'} dark:bg-opacity-10 shadow-sm transition-transform group-hover:scale-105`}>
                                                <span className="material-symbols-outlined text-lg">{t.type === 'INCOME' ? 'payments' : 'shopping_cart'}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{t.note || 'Không có ghi chú'}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">ID: {t._id.slice(-6).toUpperCase()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase italic ${t.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                                            {t.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                        {formatDate(t.date)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                        {typeof t.walletId === 'string' ? t.walletId : (t.walletId as any)?.name || 'Ví chính'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-bold ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(parseAmount(t.amount))}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Popconfirm
                                            title="Bạn có chắc chắn muốn xóa giao dịch này?"
                                            onConfirm={(e) => { e?.stopPropagation(); handleDelete(t._id); }}
                                            onCancel={(e) => e?.stopPropagation()}
                                            okText="Xóa"
                                            cancelText="Hủy"
                                            okButtonProps={{ danger: true }}
                                        >
                                            <button 
                                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </Popconfirm>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (Template Style) */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Hiển thị {filtered.length} giao dịch</p>
                    <div className="flex items-center gap-2">
                        <button className="size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed">
                            <span className="material-symbols-outlined text-lg">chevron_left</span>
                        </button>
                        <button className="size-8 flex items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">1</button>
                        <button className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-sm dark:text-slate-300 border border-slate-200 dark:border-slate-700">2</button>
                        <button className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-sm dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-lg text-slate-400">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            <Modal 
                title={editing ? "Sửa giao dịch" : "Thêm giao dịch mới"} 
                open={modalOpen} 
                onCancel={() => setModalOpen(false)} 
                onOk={handleSubmit}
                confirmLoading={submitting}
                okText={editing ? "Cập nhật" : "Lưu lại"}
                cancelText="Hủy"
                centered 
                className="premium-modal"
                width={600}
                footer={null}
            >
                <div className="py-2 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Loại</label>
                            <Select 
                                className="w-full h-11" 
                                options={[{ label: 'Chi tiêu', value: 'EXPENSE' }, { label: 'Thu nhập', value: 'INCOME' }]} 
                                placeholder="Chọn loại..." 
                                value={formValues.type}
                                onChange={v => setFormValues(prev => ({ ...prev, type: v as any }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Số tiền (₫)</label>
                            <InputNumber 
                                className="w-full h-11 rounded-xl" 
                                size="large" 
                                placeholder="0" 
                                value={formValues.amount}
                                onChange={v => setFormValues(prev => ({ ...prev, amount: Number(v) || 0 }))}
                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} 
                                parser={v => parseFloat(v!.replace(/\$\s?|(,*)/g, "")) || 0}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Hạng mục</label>
                            <Select 
                                className="w-full h-11" 
                                options={categories.map(c => ({ label: c, value: c }))} 
                                placeholder="Chọn hạng mục..." 
                                value={formValues.category}
                                onChange={v => setFormValues(prev => ({ ...prev, category: v }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Ví tiền</label>
                            <Select 
                                className="w-full h-11" 
                                options={wallets.map(w => ({ label: w.name, value: w._id }))} 
                                placeholder="Chọn ví..." 
                                value={formValues.walletId}
                                onChange={v => setFormValues(prev => ({ ...prev, walletId: v }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Ngày giao dịch</label>
                        <DatePicker 
                            className="w-full h-11 rounded-xl"
                            format="DD/MM/YYYY"
                            value={dayjs(formValues.date)}
                            onChange={(d) => setFormValues(prev => ({ ...prev, date: d ? d.toISOString() : dayjs().toISOString() }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Ghi chú</label>
                        <Input.TextArea 
                            rows={3} 
                            placeholder="Mô tả nội dung giao dịch..." 
                            className="rounded-xl bg-slate-50 dark:bg-slate-800 border-none" 
                            value={formValues.note}
                            onChange={e => setFormValues(prev => ({ ...prev, note: e.target.value }))}
                        />
                    </div>

                    <div className="flex justify-end pt-4 gap-3">
                        <button 
                            onClick={() => setModalOpen(false)} 
                            className="h-11 px-8 rounded-xl uppercase text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            disabled={submitting}
                        >
                            Hủy
                        </button>
                        <button 
                            className="bg-primary text-white h-11 px-8 rounded-xl uppercase text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? <Spin size="small" className="mr-2" /> : null}
                            {editing ? "Cập nhật" : "Lưu lại"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Transactions;
