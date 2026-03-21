import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { Input, InputNumber, Modal, Spin, message, Select, Popconfirm } from "antd";
import { auth } from "../firebase/config";
import { walletApi, transactionApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";

dayjs.locale("vi");

interface Wallet {
    _id: string;
    name: string;
    accountNumber?: string;
    balance: number;
    updatedAt: string;
}

const Wallets: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editing, setEditing] = useState<Wallet | null>(null);

    // Form states for Create/Update
    const [formValues, setFormValues] = useState({
        name: "",
        accountNumber: "",
        balance: 0
    });

    // Form states for Transfer
    const [transferValues, setTransferValues] = useState({
        fromWalletId: "",
        toWalletId: "",
        amount: 0
    });

    const fetchData = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            const res = await walletApi.getWallets(token);
            const walletList = res?.wallets || [];
            setWallets(walletList);
            if (walletList.length >= 2 && !transferValues.fromWalletId) {
                setTransferValues({
                    fromWalletId: walletList[0]._id,
                    toWalletId: walletList[1]._id,
                    amount: 0
                });
            }
        } catch (e) { message.error("Lỗi tải dữ liệu ví"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleOpenModal = (w: Wallet | null = null) => {
        if (w) {
            setEditing(w);
            setFormValues({
                name: w.name,
                accountNumber: w.accountNumber || "",
                balance: w.balance
            });
        } else {
            setEditing(null);
            setFormValues({ name: "", accountNumber: "", balance: 0 });
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formValues.name) {
            message.warning("Vui lòng nhập tên ví");
            return;
        }

        setSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            if (editing) {
                await walletApi.updateWallet(editing._id, formValues, token);
                message.success("Đã cập nhật ví");
            } else {
                await walletApi.createWallet(formValues, token);
                message.success("Đã tạo ví mới");
            }
            setModalOpen(false);
            fetchData();
        } catch (e: any) {
            message.error(e.message || "Lỗi lưu ví");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            await walletApi.deleteWallet(id, token);
            message.success("Đã xóa ví");
            fetchData();
        } catch (e: any) {
            message.error(e.message || "Lỗi xóa ví");
        }
    };

    const handleTransfer = async () => {
        if (!transferValues.fromWalletId || !transferValues.toWalletId) {
            message.warning("Vui lòng chọn ví gửi và ví nhận");
            return;
        }
        if (transferValues.fromWalletId === transferValues.toWalletId) {
            message.warning("Ví gửi và ví nhận phải khác nhau");
            return;
        }
        if (transferValues.amount <= 0) {
            message.warning("Vui lòng nhập số tiền hợp lệ");
            return;
        }

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            // Chuyển tiền nội bộ (thường là 2 giao dịch: 1 EXPENSE và 1 INCOME hoặc 1 API call duy nhất nếu backend hỗ trợ)
            // Backend hiện tại không có walletApi.transfer, nên ta giả lập bằng 2 giao dịch
            await Promise.all([
                transactionApi.createTransaction({
                    type: "EXPENSE",
                    amount: transferValues.amount,
                    walletId: transferValues.fromWalletId,
                    category: "Chuyển tiền",
                    note: `Chuyển sang ${wallets.find(w => w._id === transferValues.toWalletId)?.name}`,
                    date: new Date().toISOString()
                }, token),
                transactionApi.createTransaction({
                    type: "INCOME",
                    amount: transferValues.amount,
                    walletId: transferValues.toWalletId,
                    category: "Chuyển tiền",
                    note: `Nhận từ ${wallets.find(w => w._id === transferValues.fromWalletId)?.name}`,
                    date: new Date().toISOString()
                }, token)
            ]);

            message.success("Chuyển tiền thành công");
            setTransferValues(prev => ({ ...prev, amount: 0 }));
            fetchData();
        } catch (e: any) {
            message.error(e.message || "Lỗi chuyển tiền");
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Spin size="large" /></div>;

    return (
        <div className="flex-1 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight dark:text-white">Ví của tôi</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Quản lý các nguồn tiền và tài sản của bạn</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()} 
                    className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined">add</span>
                    Thêm ví mới
                </button>
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* Left: Cards Grid & Chart */}
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    {/* Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {wallets.map((w, i) => (
                            <div 
                                key={w._id} 
                                className={`relative overflow-hidden p-6 rounded-xl shadow-xl aspect-[1.6/1] flex flex-col justify-between group cursor-pointer hover:scale-[1.02] transition-transform ${[
                                    'bg-gradient-to-br from-primary to-[#6e64f1] text-white',
                                    'bg-slate-900 text-white',
                                    'bg-emerald-600 text-white',
                                    'bg-gradient-to-br from-orange-500 to-red-600 text-white'
                                ][i % 4]}`}
                                onClick={() => handleOpenModal(w)}
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-sm font-medium opacity-80 uppercase tracking-wide">
                                        {i % 4 === 0 ? 'Visa Platinum' : i % 4 === 1 ? 'Mastercard Gold' : i % 4 === 2 ? 'Savings' : 'Cash'}
                                    </span>
                                    <div className="flex gap-2">
                                        <Popconfirm
                                            title="Xóa ví này sẽ xóa tất cả giao dịch liên quan. Tiếp tục?"
                                            onConfirm={(e) => { e?.stopPropagation(); handleDelete(w._id); }}
                                            onCancel={(e) => e?.stopPropagation()}
                                            okText="Xóa"
                                            cancelText="Hủy"
                                            okButtonProps={{ danger: true }}
                                        >
                                            <button 
                                                className="size-8 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </Popconfirm>
                                        <div className="size-8 flex items-center justify-center">
                                            <span className="material-symbols-outlined">contactless</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold mb-1">{formatCurrency(w.balance)}</p>
                                    <p className="text-sm opacity-70 tracking-[0.2em]">{w.accountNumber || '**** **** **** 8888'}</p>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-xs uppercase opacity-50">Tên ví</p>
                                        <p className="text-sm font-medium">{w.name}</p>
                                    </div>
                                    <div className={`size-8 rounded-full bg-white/20 flex items-center justify-center`}>
                                        <span className="material-symbols-outlined text-sm">edit</span>
                                    </div>
                                </div>
                                <div className={`absolute -right-10 -bottom-10 size-40 rounded-full blur-3xl bg-white/10`}></div>
                            </div>
                        ))}

                        {/* Empty / Add More Card */}
                        <div 
                            onClick={() => handleOpenModal()} 
                            className="p-6 rounded-xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-all cursor-pointer group aspect-[1.6/1]"
                        >
                            <span className="material-symbols-outlined text-4xl mb-2 group-hover:scale-110 transition-transform">add_circle</span>
                            <span className="text-xs font-bold uppercase tracking-wide">Thêm nguồn tiền mới</span>
                        </div>
                    </div>

                    {/* Balance Trends Chart Area (Template Style) - Kept as UI Placeholder with subtle changes */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold dark:text-white">Xu hướng số dư</h3>
                                <p className="text-xs text-slate-500">Thống kê 6 tháng gần nhất (Mô phỏng)</p>
                            </div>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg gap-1">
                                <button className="px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-slate-700 shadow-sm dark:text-white">Tháng</button>
                                <button className="px-3 py-1 text-xs font-bold rounded-md text-slate-500">Quý</button>
                                <button className="px-3 py-1 text-xs font-bold rounded-md text-slate-500">Năm</button>
                            </div>
                        </div>
                        <div className="h-64 flex items-end justify-between gap-4 px-2">
                             <div className="relative w-full h-full flex items-end">
                                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                                    <defs>
                                        <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="#4137cd" stopOpacity="0.2"></stop>
                                            <stop offset="100%" stopColor="#4137cd" stopOpacity="0"></stop>
                                        </linearGradient>
                                    </defs>
                                    <path d="M0,80 Q20,70 40,75 T80,40 T100,20 L100,100 L0,100 Z" fill="url(#chartGradient)"></path>
                                    <path d="M0,80 Q20,70 40,75 T80,40 T100,20" fill="none" stroke="#4137cd" strokeWidth="2"></path>
                                </svg>
                                <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs font-medium text-slate-400 -mb-6">
                                    <span>T5</span><span>T6</span><span>T7</span><span>T8</span><span>T9</span><span>T10</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Internal Transfer Area */}
                <div className="col-span-12 lg:col-span-4 space-y-8">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="text-lg font-bold dark:text-white mb-6 uppercase tracking-tight">Chuyển tiền nội bộ</h3>
                        <form className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Từ tài khoản</label>
                                <Select 
                                    className="w-full h-11" 
                                    placeholder="Chọn nguồn..." 
                                    options={wallets.map(w => ({ label: w.name, value: w._id }))} 
                                    value={transferValues.fromWalletId}
                                    onChange={v => setTransferValues(prev => ({ ...prev, fromWalletId: v }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Đến tài khoản</label>
                                <Select 
                                    className="w-full h-11" 
                                    placeholder="Chọn đích đến..." 
                                    options={wallets.map(w => ({ label: w.name, value: w._id }))} 
                                    value={transferValues.toWalletId}
                                    onChange={v => setTransferValues(prev => ({ ...prev, toWalletId: v }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số tiền (₫)</label>
                                <div className="relative">
                                    <InputNumber 
                                        className="w-full h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center pr-12 text-lg font-bold" 
                                        placeholder="0" 
                                        size="large" 
                                        value={transferValues.amount}
                                        onChange={v => setTransferValues(prev => ({ ...prev, amount: Number(v) || 0 }))}
                                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} 
                                        parser={v => parseFloat(v!.replace(/\$\s?|(,*)/g, "")) || 0}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">VND</div>
                                </div>
                            </div>
                            <button 
                                className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mt-4" 
                                type="button"
                                onClick={handleTransfer}
                            >
                                <span className="material-symbols-outlined">send</span>
                                Thực hiện giao dịch
                            </button>
                            <p className="text-xs text-center text-slate-400 mt-4 leading-relaxed italic">Giao dịch nội bộ không mất phí và được cập nhật số dư tức thì.</p>
                        </form>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-xl text-white shadow-xl relative overflow-hidden group">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-primary">verified</span>
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Gói tài khoản</span>
                            </div>
                            <h4 className="text-xl font-bold uppercase tracking-tight mb-8">Premium Active</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold opacity-60">Hạn mức chuyển</span>
                                    <span className="font-bold text-emerald-400">Vô hạn</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold opacity-60">Phí duy trì</span>
                                    <span className="font-bold text-emerald-400">0 ₫</span>
                                </div>
                                <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-wide transition-all mt-4 border border-white/5">Quản lý dịch vụ</button>
                            </div>
                        </div>
                        <div className="absolute -top-12 -right-12 size-48 bg-primary/20 blur-[80px] rounded-full group-hover:scale-110 transition-transform duration-1000"></div>
                    </div>
                </div>
            </div>

            <Modal 
                title={editing ? "Cập nhật ví" : "Tạo ví mới"} 
                open={modalOpen} 
                onCancel={() => setModalOpen(false)} 
                footer={null} 
                centered
                className="premium-modal"
            >
                <div className="py-2 space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên ví / Tài khoản</label>
                        <Input 
                            size="large" 
                            placeholder="Ví dụ: Techcombank, Tiền mặt..." 
                            className="rounded-xl h-11" 
                            value={formValues.name}
                            onChange={e => setFormValues(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Số tài khoản (Nếu có)</label>
                        <Input 
                            size="large" 
                            placeholder="**** **** **** 1234" 
                            className="rounded-xl h-11" 
                            value={formValues.accountNumber}
                            onChange={e => setFormValues(prev => ({ ...prev, accountNumber: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Số dư hiện tại (₫)</label>
                        <InputNumber 
                            className="w-full h-11 rounded-xl" 
                            size="large" 
                            placeholder="0" 
                            value={formValues.balance}
                            onChange={v => setFormValues(prev => ({ ...prev, balance: Number(v) || 0 }))}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} 
                            parser={v => parseFloat(v!.replace(/\$\s?|(,*)/g, "")) || 0}
                        />
                    </div>
                    <div className="flex justify-end pt-4 gap-3">
                        <button 
                            onClick={() => setModalOpen(false)} 
                            className="h-11 px-8 rounded-xl uppercase text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Bỏ qua
                        </button>
                        <button 
                            className="bg-primary text-white h-11 px-8 rounded-xl uppercase text-xs font-bold shadow-lg shadow-primary/20"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? <Spin size="small" className="mr-2" /> : null}
                            {editing ? "Cập nhật" : "Khởi tạo ví"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Wallets;
