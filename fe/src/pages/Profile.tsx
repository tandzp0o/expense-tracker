import React, { useState, useEffect, useCallback } from "react";
import { Form, Input, Avatar, Upload, message, Spin } from "antd";
import { auth } from "../firebase/config";
import { formatCurrency } from "../utils/formatters";
import { userApi } from "../services/api";

interface UserProfile {
    displayName: string;
    email: string;
    phone?: string;
    bio?: string;
    avatar?: string;
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    goalsCompleted: number;
    goalsActive: number;
}

const Profile: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const loadProfile = useCallback(async () => {
        const user = auth.currentUser;
        if (!user) return;
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const profileData = await userApi.getProfile(token);
            const fullProfile: UserProfile = {
                displayName: profileData.displayName || user.displayName || "Thành viên FinTrack",
                email: profileData.email || user.email || "",
                phone: profileData.phone || "",
                bio: profileData.bio || "",
                avatar: profileData.avatar || user.photoURL || undefined,
                totalBalance: profileData.totalBalance || 0,
                totalIncome: profileData.totalIncome || 0,
                totalExpense: profileData.totalExpense || 0,
                goalsCompleted: profileData.goalsCompleted || 0,
                goalsActive: profileData.goalsActive || 0,
            };
            setProfile(fullProfile);
            form.setFieldsValue(fullProfile);
        } catch (error) { message.error("Lỗi khi tải hồ sơ"); }
        finally { setLoading(false); }
    }, [form]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    if (loading && !profile) return <div className="flex items-center justify-center min-h-[400px]"><Spin size="large" /></div>;
    if (!profile) return null;

    return (
        <div className="w-full animate-in fade-in duration-500">
            {/* Gradient Header */}
            <div className="h-64 premium-gradient relative overflow-hidden -mx-8 -mt-8 mb-0">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                <div className="max-w-6xl mx-auto px-8 pt-12 text-white relative z-10">
                    <h1 className="text-2xl font-bold mb-2">Hồ sơ người dùng</h1>
                    <p className="text-white/80">Chào mừng trở lại, quản lý tài chính của bạn thật dễ dàng.</p>
                </div>
            </div>


            {/* Profile Content */}
            <div className="max-w-6xl mx-auto px-0 -mt-24 pb-20 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Col: User Card */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 text-center">
                            <div className="relative inline-block group">
                                <Avatar size={128} src={profile.avatar} className="border-4 border-white dark:border-slate-800 shadow-lg" />
                                <button className="absolute bottom-1 right-1 size-10 bg-primary text-white rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                            </div>
                            <h2 className="mt-6 text-2xl font-bold dark:text-white">{profile.displayName}</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">Thành viên Premium từ 2023</p>
                            <div className="space-y-4 text-left border-t border-slate-100 dark:border-slate-800 pt-6">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-slate-400">mail</span>
                                    <div>
                                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Email</p>
                                        <p className="text-sm font-medium dark:text-white">{profile.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-slate-400">phone_iphone</span>
                                    <div>
                                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Số điện thoại</p>
                                        <p className="text-sm font-medium dark:text-white">{profile.phone || '090 123 4567'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-slate-400">location_on</span>
                                    <div>
                                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Địa chỉ</p>
                                        <p className="text-sm font-medium dark:text-white">TP. Hồ Chí Minh, Việt Nam</p>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsEditing(!isEditing)} className="w-full mt-8 bg-slate-100 dark:bg-slate-800 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                {isEditing ? 'Hủy chỉnh sửa' : 'Chỉnh sửa hồ sơ'}
                            </button>
                        </div>
                    </div>

                    {/* Right Col: Stats */}
                    <div className="lg:col-span-2 space-y-6">
                        {isEditing ? (
                            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                <h3 className="text-xl font-bold mb-8 dark:text-white">Cập nhật thông tin</h3>
                                <Form form={form} layout="vertical" onFinish={async (v) => {
                                    const t = await auth.currentUser?.getIdToken();
                                    if (t) await userApi.updateProfile(v, t);
                                    message.success("Đã lưu!"); setIsEditing(false); loadProfile();
                                }} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <Form.Item name="displayName" label={<span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên hiển thị</span>}>
                                            <Input size="large" className="rounded-xl h-11" />
                                        </Form.Item>
                                        <Form.Item name="phone" label={<span className="text-xs font-bold uppercase tracking-wide text-slate-500">Số điện thoại</span>}>
                                            <Input size="large" className="rounded-xl h-11" />
                                        </Form.Item>
                                    </div>
                                    <Form.Item name="bio" label={<span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ghi chú cá nhân</span>}>
                                        <Input.TextArea rows={4} className="rounded-xl" />
                                    </Form.Item>
                                    <button type="submit" className="bg-primary text-white h-11 px-8 rounded-xl font-bold text-xs uppercase tracking-wide shadow-lg shadow-primary/20">Xác nhận thay đổi</button>
                                </Form>
                            </div>
                        ) : (
                            <>
                                {/* Financial Summary Cards (Template Style) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="size-12 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                                <span className="material-symbols-outlined">payments</span>
                                            </div>
                                            <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">trending_up</span> +12%
                                            </span>
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Tổng tài sản</p>
                                        <h3 className="text-2xl font-bold mt-1 dark:text-white">{formatCurrency(profile.totalBalance || 125000000)}</h3>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                                <span className="material-symbols-outlined">savings</span>
                                            </div>
                                            <span className="text-primary text-xs font-bold flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">event</span> Tháng này
                                            </span>
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Tiết kiệm tháng này</p>
                                        <h3 className="text-2xl font-bold mt-1 dark:text-white">{formatCurrency(profile.totalIncome - profile.totalExpense || 15200000)}</h3>
                                    </div>
                                </div>

                                {/* Growth Chart (Template Style) */}
                                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="font-bold text-xl dark:text-white">Phân tích tăng trưởng</h3>
                                        <div className="flex gap-2">
                                            <button className="px-4 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 font-medium dark:text-slate-300">6 Tháng</button>
                                            <button className="px-4 py-1.5 rounded-lg text-sm bg-primary text-white font-medium">1 Năm</button>
                                        </div>
                                    </div>
                                    <div className="h-64 flex items-end justify-between gap-2 px-4">
                                        {[40, 55, 45, 70, 65, 90].map((h, i) => (
                                            <div key={i} className={`w-full rounded-t-lg relative group ${i === 5 ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'}`} style={{ height: `${h}%` }}>
                                                <div className={`absolute inset-0 bg-primary/20 rounded-t-lg opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between mt-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wide">
                                        <span>Th1</span><span>Th3</span><span>Th5</span><span>Th7</span><span>Th9</span><span>Th11</span>
                                    </div>
                                </div>

                                {/* Recent Transactions (Template Style) */}
                                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                        <h3 className="font-bold text-xl dark:text-white">Giao dịch gần đây</h3>
                                        <button className="text-primary text-sm font-bold hover:underline">Xem tất cả</button>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="size-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-sm">shopping_cart</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold dark:text-white">Apple Store Vietnam</p>
                                                    <p className="text-xs text-slate-500">22 Tháng 10, 2023</p>
                                                </div>
                                            </div>
                                            <span className="font-bold text-red-500">- 45.000.000 đ</span>
                                        </div>
                                        <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="size-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-sm">work</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold dark:text-white">Nhận lương tháng 10</p>
                                                    <p className="text-xs text-slate-500">20 Tháng 10, 2023</p>
                                                </div>
                                            </div>
                                            <span className="font-bold text-emerald-500">+ 85.000.000 đ</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
