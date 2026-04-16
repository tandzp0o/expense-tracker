import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { App, DatePicker, Input, InputNumber, Modal, Spin } from "antd";
import { auth } from "../firebase/config";
import { goalApi } from "../services/api";

dayjs.locale("vi");

interface Goal {
    _id: string;
    title: string;
    description?: string;
    targetAmount: number;
    currentAmount: number;
    category: string;
    deadline?: string;
    status: "active" | "completed" | "expired";
    imageUrl?: string;
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" })
        .format(amount)
        .replace("₫", "₫");

const Goals: React.FC = () => {
    const { message } = App.useApp();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Goal | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        title: "",
        targetAmount: 0,
        currentAmount: 0,
        deadline: "",
        description: "",
        category: "general",
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");

    const loadGoals = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            const data = await goalApi.getGoals(token);
            setGoals(Array.isArray(data) ? data : []);
        } catch (error: any) {
            message.error(error.message || "Lỗi tải danh sách mục tiêu");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGoals();
    }, []);

    const resetForm = () => {
        setEditing(null);
        setForm({
            title: "",
            targetAmount: 0,
            currentAmount: 0,
            deadline: "",
            description: "",
            category: "general",
        });
        setImageFile(null);
        setImagePreview("");
    };

    const openCreate = () => {
        resetForm();
        setModalOpen(true);
    };

    const openEdit = (goal: Goal) => {
        setEditing(goal);
        setForm({
            title: goal.title,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            deadline: goal.deadline || "",
            description: goal.description || "",
            category: goal.category || "general",
        });
        setImageFile(null);
        setImagePreview(goal.imageUrl || "");
        setModalOpen(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleDelete = async (goalId: string) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            await goalApi.deleteGoal(goalId, token);
            message.success("Đã xóa mục tiêu");
            loadGoals();
        } catch (error: any) {
            message.error(error.message || "Lỗi xóa mục tiêu");
        }
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) {
            message.warning("Vui lòng nhập tên mục tiêu");
            return;
        }
        if (form.targetAmount <= 0) {
            message.warning("Mục tiêu phải lớn hơn 0");
            return;
        }

        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            const formData = new FormData();
            formData.append("title", form.title);
            formData.append("targetAmount", form.targetAmount.toString());
            formData.append("currentAmount", form.currentAmount.toString());
            formData.append("category", form.category || "general");
            if (form.deadline) formData.append("deadline", form.deadline);
            if (form.description) formData.append("description", form.description);
            if (imageFile) formData.append("image", imageFile);

            if (editing) {
                await goalApi.updateGoal(editing._id, formData, token);
                message.success("Đã cập nhật mục tiêu");
            } else {
                await goalApi.createGoal(formData, token);
                message.success("Đã tạo mục tiêu");
            }

            setModalOpen(false);
            resetForm();
            loadGoals();
        } catch (error: any) {
            message.error(error.message || "Lỗi lưu mục tiêu");
        } finally {
            setSaving(false);
        }
    };

    const totalSaved = useMemo(
        () => goals.reduce((sum, goal) => sum + goal.currentAmount, 0),
        [goals],
    );
    const completedCount = useMemo(
        () => goals.filter((goal) => goal.status === "completed").length,
        [goals],
    );
    const avgProgress = useMemo(() => {
        if (goals.length === 0) return 0;
        return Math.round(
            goals.reduce((sum, goal) => {
                const progress =
                    goal.targetAmount > 0
                        ? Math.min(
                              (goal.currentAmount / goal.targetAmount) * 100,
                              100,
                          )
                        : 0;
                return sum + progress;
            }, 0) / goals.length,
        );
    }, [goals]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2 dark:text-white">
                        Mục tiêu tài chính
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">
                        Theo dõi các kế hoạch tiết kiệm bằng dữ liệu thật từ tài khoản của bạn
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined">add</span>
                    Thêm mục tiêu mới
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">
                        Tổng số tiền đã tiết kiệm
                    </p>
                    <h3 className="text-3xl font-bold dark:text-white">
                        {formatCurrency(totalSaved)}
                    </h3>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">
                        Mục tiêu hoàn thành
                    </p>
                    <h3 className="text-3xl font-bold dark:text-white">
                        {completedCount}/{goals.length}
                    </h3>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">
                        Tiến độ trung bình
                    </p>
                    <h3 className="text-3xl font-bold dark:text-white">
                        {avgProgress}%
                    </h3>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {goals.map((goal) => {
                    const progress =
                        goal.targetAmount > 0
                            ? Math.min(
                                  Math.round(
                                      (goal.currentAmount / goal.targetAmount) *
                                          100,
                                  ),
                                  100,
                              )
                            : 0;

                    return (
                        <div
                            key={goal._id}
                            className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl transition-shadow"
                        >
                            <div
                                className="h-48 w-full bg-cover bg-center cursor-pointer"
                                style={{
                                    backgroundImage: `url(${goal.imageUrl || "https://via.placeholder.com/400x200/4137cd/ffffff?text=" + encodeURIComponent(goal.title)})`,
                                }}
                                onClick={() => openEdit(goal)}
                            />

                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div
                                        className="cursor-pointer"
                                        onClick={() => openEdit(goal)}
                                    >
                                        <h4 className="text-xl font-bold mb-1 dark:text-white">
                                            {goal.title}
                                        </h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {goal.description || "Chưa có mô tả"}
                                        </p>
                                    </div>
                                    <span
                                        className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                                            goal.status === "completed"
                                                ? "bg-emerald-100 text-emerald-600"
                                                : goal.status === "expired"
                                                  ? "bg-red-100 text-red-600"
                                                  : "bg-primary/10 text-primary"
                                        }`}
                                    >
                                        {goal.status}
                                    </span>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">
                                            Đã lưu
                                        </span>
                                        <span className="font-bold dark:text-white">
                                            {formatCurrency(goal.currentAmount)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">
                                            Mục tiêu
                                        </span>
                                        <span className="font-bold dark:text-white">
                                            {formatCurrency(goal.targetAmount)}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${
                                                progress >= 100
                                                    ? "bg-emerald-500"
                                                    : "bg-primary"
                                            }`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">
                                        {progress}% hoàn thành
                                    </p>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {goal.deadline
                                            ? `Hạn: ${dayjs(goal.deadline).format("DD/MM/YYYY")}`
                                            : "Không có hạn"}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openEdit(goal)}
                                            className="text-xs font-bold uppercase tracking-wide text-primary hover:underline"
                                        >
                                            Sửa
                                        </button>
                                        <button
                                            onClick={() => handleDelete(goal._id)}
                                            className="text-xs font-bold uppercase tracking-wide text-red-500 hover:underline"
                                        >
                                            Xóa
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {goals.length === 0 && (
                    <div className="col-span-full bg-white/50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 min-h-[280px]">
                        <span className="material-symbols-outlined text-5xl mb-4">
                            savings
                        </span>
                        <p className="text-sm font-bold uppercase tracking-wide">
                            Chưa có mục tiêu nào
                        </p>
                    </div>
                )}
            </div>

            <Modal
                title={editing ? "Cập nhật mục tiêu" : "Thiết lập mục tiêu mới"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                footer={null}
                centered
            >
                <div className="py-2 space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Tên mục tiêu
                        </label>
                        <Input
                            value={form.title}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    title: e.target.value,
                                }))
                            }
                            size="large"
                            className="rounded-xl h-11"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Mục tiêu (₫)
                            </label>
                            <InputNumber
                                style={{ width: "100%" }}
                                value={form.targetAmount}
                                onChange={(v) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        targetAmount: Number(v) || 0,
                                    }))
                                }
                                size="large"
                                className="rounded-xl h-11"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Đã có (₫)
                            </label>
                            <InputNumber
                                style={{ width: "100%" }}
                                value={form.currentAmount}
                                onChange={(v) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        currentAmount: Number(v) || 0,
                                    }))
                                }
                                size="large"
                                className="rounded-xl h-11"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Hạn chót
                        </label>
                        <DatePicker
                            className="w-full h-11 rounded-xl"
                            format="DD/MM/YYYY"
                            value={form.deadline ? dayjs(form.deadline) : null}
                            onChange={(d) =>
                                setForm((prev) => ({
                                    ...prev,
                                    deadline: d ? d.toISOString() : "",
                                }))
                            }
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Ảnh minh họa
                        </label>
                        <div className="space-y-3">
                            {imagePreview ? (
                                <img
                                    src={imagePreview}
                                    alt="Goal preview"
                                    className="w-full h-32 object-cover rounded-lg"
                                />
                            ) : null}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Mô tả
                        </label>
                        <Input.TextArea
                            rows={3}
                            value={form.description}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                }))
                            }
                            className="rounded-xl bg-slate-50 dark:bg-slate-800 border-none"
                        />
                    </div>

                    <div className="flex justify-end pt-4 gap-3">
                        <button
                            onClick={() => setModalOpen(false)}
                            className="h-11 px-8 rounded-xl uppercase text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="bg-primary text-white h-11 px-8 rounded-xl uppercase text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-60"
                        >
                            {saving ? "Đang lưu..." : editing ? "Cập nhật" : "Tạo mục tiêu"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Goals;
