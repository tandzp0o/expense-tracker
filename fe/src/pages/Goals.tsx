import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { DatePicker, Input, InputNumber, Modal, Select, message, Spin, Progress } from "antd";
import { auth } from "../firebase/config";
import { goalApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import AlertNotification from "../components/AlertNotification";

dayjs.locale("vi");

interface Goal {
    _id: string;
    title: string;
    description?: string;
    targetAmount: number;
    currentAmount: number;
    deadline?: string;
    status: "active" | "completed" | "expired";
}

const Goals: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Goal | null>(null);
    const [form, setForm] = useState({ title: "", targetAmount: 0, currentAmount: 0, deadline: "", description: "" });

    const fetchData = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            const res = await goalApi.getGoals(token);
            setGoals(Array.isArray(res) ? res : []);
        } catch (e) { message.error("Lỗi tải dữ liệu"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const goalImages: Record<string, string> = {
        'nhà': '/goal_house_1773570040002.png',
        'xe': '/goal_car_1773570089171.png',
        'du lịch': '/goal_travel_1773570106243.png',
        'default': '/goal_house_1773570040002.png'
    };

    const getGoalImage = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('nhà') || t.includes('home')) return goalImages['nhà'];
        if (t.includes('xe') || t.includes('car')) return goalImages['xe'];
        if (t.includes('lịch') || t.includes('travel')) return goalImages['du lịch'];
        return goalImages['default'];
    };

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Spin size="large" /></div>;

    return (
        <div className="flex-1 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight dark:text-white">Mục tiêu tài chính</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Theo dõi và quản lý các mục tiêu tiết kiệm của bạn</p>
                </div>
                <button onClick={() => { setEditing(null); setForm({ title: "", targetAmount: 0, currentAmount: 0, deadline: "", description: "" }); setModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined">add</span>
                    <span>Thêm mục tiêu mới</span>
                </button>
            </div>

            {/* Summary Stats (Template Style) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">Tổng số tiền đã tiết kiệm</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-bold">{formatCurrency(goals.reduce((s, g) => s + g.currentAmount, 0))}</h3>
                        <span className="text-emerald-500 text-sm font-bold flex items-center">
                            <span className="material-symbols-outlined text-sm">trending_up</span> 12%
                        </span>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">Mục tiêu hoàn thành</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-bold">{goals.filter(g => g.currentAmount >= g.targetAmount).length}/{goals.length}</h3>
                        <span className="text-slate-400 text-sm font-medium">Tháng này: +0</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">Tiến độ trung bình</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-bold">{goals.length > 0 ? Math.round(goals.reduce((s, g) => s + Math.min((g.currentAmount / g.targetAmount) * 100, 100), 0) / goals.length) : 0}%</h3>
                        <span className="text-emerald-500 text-sm font-bold flex items-center">
                            <span className="material-symbols-outlined text-sm">trending_up</span> 5%
                        </span>
                    </div>
                </div>
            </div>

            {/* Goals Grid (Template Style) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {goals.map(g => {
                    const progress = Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100);
                    const circumference = 2 * Math.PI * 24; // r=24
                    const dashOffset = circumference - (progress / 100) * circumference;
                    return (
                        <div key={g._id} className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl transition-shadow cursor-pointer" onClick={() => { setEditing(g); setForm({ title: g.title, targetAmount: g.targetAmount, currentAmount: g.currentAmount, deadline: g.deadline || "", description: g.description || "" }); setModalOpen(true); }}>
                            {/* Image header */}
                            <div className="h-48 w-full bg-cover bg-center" style={{ backgroundImage: `url(${getGoalImage(g.title)})` }}></div>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-xl font-bold mb-1 dark:text-white">{g.title}</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{g.description || 'Tiết kiệm cho mục tiêu'}</p>
                                    </div>
                                    <div className="relative flex items-center justify-center">
                                        <svg className="w-14 h-14">
                                            <circle className="text-slate-100 dark:text-slate-800" cx="28" cy="28" fill="transparent" r="24" stroke="currentColor" strokeWidth="4"></circle>
                                            <circle className="text-primary" cx="28" cy="28" fill="transparent" r="24" stroke="currentColor" strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" strokeWidth="4" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}></circle>
                                        </svg>
                                        <span className="absolute text-xs font-bold text-primary">{progress}%</span>
                                    </div>
                                </div>
                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Đã lưu:</span>
                                        <span className="font-bold dark:text-white">{formatCurrency(g.currentAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Mục tiêu:</span>
                                        <span className="font-bold dark:text-white">{formatCurrency(g.targetAmount)}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <span className="material-symbols-outlined text-sm">event</span>
                                    Dự kiến: {g.deadline ? dayjs(g.deadline).format('MM/YYYY') : 'Linh hoạt'}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Create New Goal Card */}
                <div onClick={() => { setEditing(null); setForm({ title: "", targetAmount: 0, currentAmount: 0, deadline: "", description: "" }); setModalOpen(true); }} className="bg-white/50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-300 hover:border-primary hover:text-primary transition-all cursor-pointer group min-h-[350px]">
                    <div className="size-16 rounded-full border-2 border-dashed border-slate-200 group-hover:border-primary group-hover:bg-primary/5 flex items-center justify-center mb-4 transition-all">
                        <span className="material-symbols-outlined text-3xl group-hover:scale-125 transition-transform">add_circle</span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide">Thiết lập mục tiêu mới</span>
                </div>
            </div>

            {/* Motivational Quote or AI Suggestion */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-white flex items-center gap-6 shadow-xl relative overflow-hidden">
                <div className="size-14 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-white/10">
                    <span className="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
                </div>
                <div>
                    <h4 className="text-lg font-bold mb-1">FinTrack Tip: Quy tắc 50/30/20</h4>
                    <p className="text-slate-400 text-sm italic font-medium">"Dành 20% thu nhập mỗi tháng cho các mục tiêu này sẽ giúp bạn đạt được tự do tài chính nhanh hơn 5 năm so với bình thường."</p>
                </div>
                <div className="absolute bottom-0 right-0 p-2 opacity-5">
                    <span className="material-symbols-outlined text-8xl">rocket</span>
                </div>
            </div>

            <Modal title={editing ? "Cập nhật mục tiêu" : "Thiết lập mục tiêu mới"} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} centered className="premium-modal">
                <div className="py-2 space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên mục tiêu</label>
                        <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ví dụ: Mua iPhone 16 Pro Max, Tiết kiệm học phí..." size="large" className="rounded-xl h-11" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Mục tiêu (₫)</label>
                            <InputNumber style={{ width: '100%' }} value={form.targetAmount} onChange={v => setForm({ ...form, targetAmount: Number(v) })} size="large" className="rounded-xl h-11" placeholder="0" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} parser={v => parseFloat(v!.replace(/\$\s?|(,*)/g, "")) || 0} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Đã có (₫)</label>
                            <InputNumber style={{ width: '100%' }} value={form.currentAmount} onChange={v => setForm({ ...form, currentAmount: Number(v) })} size="large" className="rounded-xl h-11" placeholder="0" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} parser={v => parseFloat(v!.replace(/\$\s?|(,*)/g, "")) || 0} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Hạn chót mong muốn</label>
                        <DatePicker className="w-full h-11 rounded-xl" format="DD/MM/YYYY" placeholder="Chọn ngày..." value={form.deadline ? dayjs(form.deadline) : null} onChange={d => setForm({ ...form, deadline: d ? d.toISOString() : "" })} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Mô tả mục tiêu</label>
                        <Input.TextArea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Động lực của bạn là gì?" className="rounded-xl bg-slate-50 dark:bg-slate-800 border-none" />
                    </div>
                    <div className="flex justify-end pt-4 gap-3">
                        <button onClick={() => setModalOpen(false)} className="h-11 px-8 rounded-xl uppercase text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">Để sau</button>
                        <button onClick={async () => {
                            const token = await auth.currentUser?.getIdToken();
                            if (!token) return;
                            if (editing) await goalApi.updateGoal(editing._id, form, token);
                            else await goalApi.createGoal(form, token);
                            fetchData(); setModalOpen(false); message.success("Đã lưu mục tiêu!");
                        }} className="bg-primary text-white h-11 px-8 rounded-xl uppercase text-xs font-bold shadow-lg shadow-primary/20">Lưu mục tiêu</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};


export default Goals;
