/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { Goal as GoalIcon, Plus, Target, Trophy, Trash2 } from "lucide-react";
import { auth } from "../firebase/config";
import { goalApi } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { useLocale } from "../contexts/LocaleContext";
import { formatCurrency, formatDate } from "../utils/formatters";
import { PageHeader } from "../components/app/page-header";
import { MetricCard } from "../components/app/metric-card";
import { EmptyState } from "../components/app/empty-state";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Spinner } from "../components/ui/spinner";
import { Textarea } from "../components/ui/textarea";

dayjs.locale("vi");

interface GoalItem {
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

const Goals: React.FC = () => {
    const { isVietnamese } = useLocale();
    const { toast } = useToast();
    const [goals, setGoals] = useState<GoalItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<GoalItem | null>(null);
    const [pendingDelete, setPendingDelete] = useState<GoalItem | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState("");
    const [form, setForm] = useState({
        title: "",
        targetAmount: 0,
        currentAmount: 0,
        deadline: "",
        description: "",
        category: "general",
    });

    const copy = isVietnamese
        ? {
              pageTitle: "Mục tiêu tiết kiệm",
              pageDescription:
                  "Các thẻ mục tiêu lấy từ goal list API và vẫn hỗ trợ tải lên một ảnh bìa.",
              newGoal: "Thêm mục tiêu",
              saved: "Đã tích lũy",
              completed: "Hoàn thành",
              averageProgress: "Tiến độ trung bình",
              totalSavedDesc: "Tổng số tiền hiện có trên tất cả mục tiêu",
              totalGoalsDesc: (count: number) => `${count} mục tiêu tổng cộng`,
              averageProgressDesc: "Phần trăm tiến độ trung bình",
              noDescription: "Chưa có mô tả.",
              savedLabel: "Đã có",
              targetLabel: "Mục tiêu",
              noDeadline: "Chưa đặt hạn",
              deadline: "Hạn",
              edit: "Chỉnh sửa",
              noGoals: "Chưa có mục tiêu",
              noGoalsDesc:
                  "Mục tiêu giúp màn phân tích và hồ sơ hiển thị tiến độ và số lượng hoàn thành.",
              createGoal: "Tạo mục tiêu",
              formDescription:
                  "Biểu mẫu này giữ nguyên upload ảnh, tiêu đề, số tiền mục tiêu, số tiền hiện có, danh mục và hạn.",
              editGoal: "Chỉnh sửa mục tiêu",
              createGoalTitle: "Tạo mục tiêu",
              title: "Tiêu đề",
              targetAmount: "Số tiền mục tiêu",
              currentAmount: "Số tiền hiện có",
              category: "Danh mục",
              deadlineLabel: "Hạn",
              coverImage: "Ảnh bìa",
              goalPreview: "Xem trước mục tiêu",
              description: "Mô tả",
              cancel: "Hủy",
              saving: "Đang lưu...",
              updateGoal: "Cập nhật mục tiêu",
              titleRequired: "Cần nhập tiêu đề",
              titleRequiredDesc: "Tiêu đề mục tiêu không được để trống.",
              invalidTarget: "Mục tiêu không hợp lệ",
              invalidTargetDesc: "Số tiền mục tiêu phải lớn hơn 0.",
              goalUpdated: "Đã cập nhật mục tiêu",
              goalCreated: "Đã tạo mục tiêu",
              saveFailed: "Lưu thất bại",
              saveFailedDesc: "Không thể lưu mục tiêu.",
              goalDeleted: "Đã xóa mục tiêu",
              deleteFailed: "Xóa thất bại",
              deleteFailedDesc: "Không thể xóa mục tiêu.",
              keep: "Giữ lại",
              delete: "Xóa",
              deleteGoal: "Xóa mục tiêu",
              deleteGoalDesc: (title: string) => `Xóa mục tiêu "${title}"?`,
              loadFailed: "Không thể tải mục tiêu",
              retry: "Vui lòng thử lại.",
              general: "Tổng quát",
              statuses: {
                  active: "Đang thực hiện",
                  completed: "Hoàn thành",
                  expired: "Hết hạn",
              },
          }
        : {
              pageTitle: "Savings goals",
              pageDescription:
                  "Goal cards are rendered from the goal list API and keep upload support for a single cover image.",
              newGoal: "New goal",
              saved: "Saved",
              completed: "Completed",
              averageProgress: "Average progress",
              totalSavedDesc: "Current amount summed across all goals",
              totalGoalsDesc: (count: number) => `${count} total goals`,
              averageProgressDesc: "Average progress percentage",
              noDescription: "No description provided.",
              savedLabel: "Saved",
              targetLabel: "Target",
              noDeadline: "No deadline",
              deadline: "Deadline",
              edit: "Edit",
              noGoals: "No goals yet",
              noGoalsDesc:
                  "Goals help the analytics and profile screens show progress and completion counts.",
              createGoal: "Create goal",
              formDescription:
                  "This form preserves image upload, title, target, current amount, category and deadline.",
              editGoal: "Edit goal",
              createGoalTitle: "Create goal",
              title: "Title",
              targetAmount: "Target amount",
              currentAmount: "Current amount",
              category: "Category",
              deadlineLabel: "Deadline",
              coverImage: "Cover image",
              goalPreview: "Goal preview",
              description: "Description",
              cancel: "Cancel",
              saving: "Saving...",
              updateGoal: "Update goal",
              titleRequired: "Title required",
              titleRequiredDesc: "Goal title cannot be empty.",
              invalidTarget: "Invalid target",
              invalidTargetDesc: "Target amount must be greater than zero.",
              goalUpdated: "Goal updated",
              goalCreated: "Goal created",
              saveFailed: "Save failed",
              saveFailedDesc: "Goal could not be saved.",
              goalDeleted: "Goal deleted",
              deleteFailed: "Delete failed",
              deleteFailedDesc: "Goal could not be removed.",
              keep: "Keep",
              delete: "Delete",
              deleteGoal: "Delete goal",
              deleteGoalDesc: (title: string) => `Delete goal "${title}"?`,
              loadFailed: "Could not load goals",
              retry: "Please retry.",
              general: "General",
              statuses: {
                  active: "Active",
                  completed: "Completed",
                  expired: "Expired",
              },
          };

    const getStatusLabel = (status: GoalItem["status"]) => copy.statuses[status];
    const getCategoryLabel = (category: string) =>
        category === "general" ? copy.general : category;

    const loadGoals = async () => {
        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }
            const data = await goalApi.getGoals(token);
            setGoals(Array.isArray(data) ? data : []);
        } catch (error: any) {
            toast({
                title: copy.loadFailed,
                description: error.message || copy.retry,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadInitialGoals = async () => {
            setLoading(true);
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) {
                    return;
                }
                const data = await goalApi.getGoals(token);
                setGoals(Array.isArray(data) ? data : []);
            } catch (error: any) {
                toast({
                    title: copy.loadFailed,
                    description: error.message || copy.retry,
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        void loadInitialGoals();
    }, [toast]);

    const totalSaved = useMemo(
        () => goals.reduce((sum, goal) => sum + goal.currentAmount, 0),
        [goals],
    );

    const completedCount = useMemo(
        () => goals.filter((goal) => goal.status === "completed").length,
        [goals],
    );

    const averageProgress = useMemo(() => {
        if (goals.length === 0) {
            return 0;
        }
        return Math.round(
            goals.reduce((sum, goal) => {
                const progress =
                    goal.targetAmount > 0
                        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                        : 0;
                return sum + progress;
            }, 0) / goals.length,
        );
    }, [goals]);

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

    const openEdit = (goal: GoalItem) => {
        setEditing(goal);
        setForm({
            title: goal.title,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            deadline: goal.deadline ? dayjs(goal.deadline).format("YYYY-MM-DD") : "",
            description: goal.description || "",
            category: goal.category || "general",
        });
        setImageFile(null);
        setImagePreview(goal.imageUrl || "");
        setModalOpen(true);
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) {
            toast({
                title: copy.titleRequired,
                description: copy.titleRequiredDesc,
                variant: "destructive",
            });
            return;
        }

        if (form.targetAmount <= 0) {
            toast({
                title: copy.invalidTarget,
                description: copy.invalidTargetDesc,
                variant: "destructive",
            });
            return;
        }

        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }

            const formData = new FormData();
            formData.append("title", form.title);
            formData.append("targetAmount", String(form.targetAmount));
            formData.append("currentAmount", String(form.currentAmount));
            formData.append("category", form.category || "general");
            if (form.deadline) {
                formData.append(
                    "deadline",
                    new Date(`${form.deadline}T12:00:00`).toISOString(),
                );
            }
            if (form.description) {
                formData.append("description", form.description);
            }
            if (imageFile) {
                formData.append("image", imageFile);
            }

            if (editing) {
                await goalApi.updateGoal(editing._id, formData, token);
                toast({
                    title: copy.goalUpdated,
                    variant: "success",
                });
            } else {
                await goalApi.createGoal(formData, token);
                toast({
                    title: copy.goalCreated,
                    variant: "success",
                });
            }

            setModalOpen(false);
            resetForm();
            await loadGoals();
        } catch (error: any) {
            toast({
                title: copy.saveFailed,
                description: error.message || copy.saveFailedDesc,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!pendingDelete) {
            return;
        }

        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }
            await goalApi.deleteGoal(pendingDelete._id, token);
            toast({
                title: copy.goalDeleted,
                variant: "success",
            });
            setPendingDelete(null);
            await loadGoals();
        } catch (error: any) {
            toast({
                title: copy.deleteFailed,
                description: error.message || copy.deleteFailedDesc,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <Spinner className="h-8 w-8" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                actions={
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" />
                        {copy.newGoal}
                    </Button>
                }
                description={copy.pageDescription}
                title={copy.pageTitle}
            />

            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                    icon={Target}
                    subtitle={copy.totalSavedDesc}
                    title={copy.saved}
                    value={formatCurrency(totalSaved)}
                />
                <MetricCard
                    icon={Trophy}
                    subtitle={copy.totalGoalsDesc(goals.length)}
                    title={copy.completed}
                    value={`${completedCount}/${goals.length}`}
                />
                <MetricCard
                    icon={GoalIcon}
                    subtitle={copy.averageProgressDesc}
                    title={copy.averageProgress}
                    value={`${averageProgress}%`}
                />
            </div>

            {goals.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {goals.map((goal) => {
                        const progress =
                            goal.targetAmount > 0
                                ? Math.min(
                                      Math.round(
                                          (goal.currentAmount / goal.targetAmount) * 100,
                                      ),
                                      100,
                                  )
                                : 0;

                        return (
                            <Card key={goal._id} className="overflow-hidden">
                                <div className="aspect-[16/9] bg-muted">
                                    {goal.imageUrl ? (
                                        <img
                                            alt={goal.title}
                                            className="h-full w-full object-cover"
                                            src={goal.imageUrl}
                                        />
                                    ) : (
                                        <div className="flex h-full items-center justify-center bg-primary-soft text-primary">
                                            <GoalIcon className="h-10 w-10" />
                                        </div>
                                    )}
                                </div>
                                <CardContent className="space-y-4 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-lg font-semibold">{goal.title}</h3>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {goal.description || copy.noDescription}
                                            </p>
                                        </div>
                                        <Badge
                                            variant={
                                                goal.status === "completed"
                                                    ? "success"
                                                    : goal.status === "expired"
                                                      ? "danger"
                                                      : "default"
                                            }
                                        >
                                            {getStatusLabel(goal.status)}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{copy.savedLabel}</span>
                                            <span className="font-medium">
                                                {formatCurrency(goal.currentAmount)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{copy.targetLabel}</span>
                                            <span className="font-medium">
                                                {formatCurrency(goal.targetAmount)}
                                            </span>
                                        </div>
                                        <Progress value={progress} />
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">
                                                {getCategoryLabel(goal.category || "general")}
                                            </span>
                                            <span className="font-medium">{progress}%</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
                                        <span className="text-muted-foreground">
                                            {goal.deadline
                                                ? `${copy.deadline} ${formatDate(goal.deadline)}`
                                                : copy.noDeadline}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => openEdit(goal)}
                                                size="sm"
                                                variant="outline"
                                            >
                                                {copy.edit}
                                            </Button>
                                            <Button
                                                onClick={() => setPendingDelete(goal)}
                                                size="sm"
                                                variant="ghost"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <EmptyState
                    actionLabel={copy.createGoal}
                    description={copy.noGoalsDesc}
                    icon={GoalIcon}
                    onAction={openCreate}
                    title={copy.noGoals}
                />
            )}

            <Dialog
                description={copy.formDescription}
                onClose={() => setModalOpen(false)}
                open={modalOpen}
                title={editing ? copy.editGoal : copy.createGoalTitle}
            >
                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.title}</label>
                        <Input
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    title: event.target.value,
                                }))
                            }
                            value={form.title}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.targetAmount}</label>
                            <Input
                                min={0}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        targetAmount: Number(event.target.value) || 0,
                                    }))
                                }
                                type="number"
                                value={form.targetAmount}
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.currentAmount}</label>
                            <Input
                                min={0}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        currentAmount: Number(event.target.value) || 0,
                                    }))
                                }
                                type="number"
                                value={form.currentAmount}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.category}</label>
                            <Input
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        category: event.target.value,
                                    }))
                                }
                                value={form.category}
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.deadlineLabel}</label>
                            <Input
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        deadline: event.target.value,
                                    }))
                                }
                                type="date"
                                value={form.deadline}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.coverImage}</label>
                        <Input accept="image/*" onChange={handleImageChange} type="file" />
                        {imagePreview ? (
                            <img
                                alt={copy.goalPreview}
                                className="mt-3 h-36 w-full rounded-[var(--app-radius-lg)] object-cover"
                                src={imagePreview}
                            />
                        ) : null}
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.description}</label>
                        <Textarea
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    description: event.target.value,
                                }))
                            }
                            value={form.description}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button onClick={() => setModalOpen(false)} variant="outline">
                            {copy.cancel}
                        </Button>
                        <Button disabled={saving} onClick={handleSubmit}>
                            {saving
                                ? copy.saving
                                : editing
                                  ? copy.updateGoal
                                  : copy.createGoal}
                        </Button>
                    </div>
                </div>
            </Dialog>

            <ConfirmDialog
                busy={saving}
                cancelLabel={copy.keep}
                confirmLabel={copy.delete}
                description={
                    pendingDelete ? copy.deleteGoalDesc(pendingDelete.title) : ""
                }
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDelete}
                open={!!pendingDelete}
                title={copy.deleteGoal}
                variant="destructive"
            />
        </div>
    );
};

export default Goals;
