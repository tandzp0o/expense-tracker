import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { auth } from "../firebase/config";
import { budgetApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import { PageHeader } from "../components/app/page-header";
import { MetricCard } from "../components/app/metric-card";
import { EmptyState } from "../components/app/empty-state";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Spinner } from "../components/ui/spinner";

dayjs.locale("vi");

interface BudgetSummaryItem {
    _id: string;
    category: string;
    amount: number;
    spent: number;
    percent: number;
}

const Budgets: React.FC = () => {
    const { isVietnamese } = useLocale();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [budgets, setBudgets] = useState<BudgetSummaryItem[]>([]);
    const [growth, setGrowth] = useState(0);
    const [totalBudget, setTotalBudget] = useState(0);
    const [totalSpent, setTotalSpent] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<BudgetSummaryItem | null>(null);
    const [pendingDelete, setPendingDelete] = useState<BudgetSummaryItem | null>(
        null,
    );
    const [formData, setFormData] = useState({
        category: "",
        amount: 0,
    });

    const copy = isVietnamese
        ? {
              title: "Ngân sách",
              description:
                  "Tổng hợp theo tháng lấy từ `/budgets/summary` và dùng dữ liệu chi tiêu thực tế đã gom theo ngân sách.",
              newBudget: "Thêm ngân sách",
              totalBudget: "Tổng ngân sách",
              spent: "Đã chi",
              remaining: "Còn lại",
              vsPreviousMonth: "so với tháng trước",
              plannedBudgetUsed: "ngân sách kế hoạch đã dùng",
              daysLeftThisMonth: (days: number) => `Còn ${days} ngày trong tháng này`,
              monthlyCategories: "Danh mục trong tháng",
              monthlyCategoriesDesc:
                  "Mỗi thẻ dùng đúng summary item do backend trả về.",
              of: "trên",
              edit: "Chỉnh sửa",
              noBudgets: "Chưa có ngân sách",
              noBudgetsDesc: "Chưa có ngân sách nào cho tháng hiện tại.",
              createBudget: "Tạo ngân sách",
              formDescription:
                  "Biểu mẫu gửi category, amount, month và year đúng như budget API yêu cầu.",
              editBudget: "Chỉnh sửa ngân sách",
              createBudgetTitle: "Tạo ngân sách",
              category: "Danh mục",
              amount: "Số tiền",
              categoryPlaceholder: "Ví dụ: Ăn uống, Tiền nhà, Du lịch",
              cancel: "Hủy",
              saving: "Đang lưu...",
              updateBudget: "Cập nhật ngân sách",
              categoryRequired: "Cần nhập danh mục",
              categoryRequiredDesc: "Danh mục ngân sách không được để trống.",
              invalidAmount: "Số tiền không hợp lệ",
              invalidAmountDesc: "Ngân sách phải lớn hơn 0.",
              budgetUpdated: "Đã cập nhật ngân sách",
              budgetCreated: "Đã tạo ngân sách",
              saveFailed: "Lưu thất bại",
              saveFailedDesc: "Không thể lưu ngân sách.",
              budgetDeleted: "Đã xóa ngân sách",
              deleteFailed: "Xóa thất bại",
              deleteFailedDesc: "Không thể xóa ngân sách.",
              keep: "Giữ lại",
              delete: "Xóa",
              deleteBudget: "Xóa ngân sách",
              deleteBudgetDesc: (category: string) => `Xóa ngân sách "${category}"?`,
              loadFailed: "Không thể tải ngân sách",
              retry: "Vui lòng thử lại.",
          }
        : {
              title: "Budgets",
              description:
                  "Summary for the current month. Data comes from `/budgets/summary` and uses actual spent-by-budget aggregation.",
              newBudget: "New budget",
              totalBudget: "Total budget",
              spent: "Spent",
              remaining: "Remaining",
              vsPreviousMonth: "vs previous month",
              plannedBudgetUsed: "of planned budget used",
              daysLeftThisMonth: (days: number) => `${days} days left this month`,
              monthlyCategories: "Monthly categories",
              monthlyCategoriesDesc:
                  "Each card uses the summary item returned by the backend.",
              of: "of",
              edit: "Edit",
              noBudgets: "No budgets yet",
              noBudgetsDesc: "No budget exists for the current month yet.",
              createBudget: "Create budget",
              formDescription:
                  "The form posts category, amount, month and year exactly as expected by the budget API.",
              editBudget: "Edit budget",
              createBudgetTitle: "Create budget",
              category: "Category",
              amount: "Amount",
              categoryPlaceholder: "Example: Food, Rent, Travel",
              cancel: "Cancel",
              saving: "Saving...",
              updateBudget: "Update budget",
              categoryRequired: "Category required",
              categoryRequiredDesc: "Budget category cannot be empty.",
              invalidAmount: "Invalid amount",
              invalidAmountDesc: "Budget amount must be greater than zero.",
              budgetUpdated: "Budget updated",
              budgetCreated: "Budget created",
              saveFailed: "Save failed",
              saveFailedDesc: "Budget could not be saved.",
              budgetDeleted: "Budget deleted",
              deleteFailed: "Delete failed",
              deleteFailedDesc: "Budget could not be removed.",
              keep: "Keep",
              delete: "Delete",
              deleteBudget: "Delete budget",
              deleteBudgetDesc: (category: string) => `Delete budget "${category}"?`,
              loadFailed: "Could not load budgets",
              retry: "Please retry.",
          };
    const loadFailedTitle = isVietnamese
        ? "Không thể tải ngân sách"
        : "Could not load budgets";
    const retryText = isVietnamese ? "Vui lòng thử lại." : "Please retry.";

    // Locale-derived error labels are intentionally reduced to stable primitives above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }
            const response: any = await budgetApi.getBudgetSummary(
                { month: dayjs().month() + 1, year: dayjs().year() },
                token,
            );
            setBudgets(response?.items || []);
            setTotalBudget(response?.totalBudget || 0);
            setTotalSpent(response?.totalSpent || 0);
            setGrowth(response?.growth || 0);
        } catch (error: any) {
            toast({
                title: loadFailedTitle,
                description: error.message || retryText,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [loadFailedTitle, retryText, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const remaining = totalBudget - totalSpent;
    const spentPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    const monthLabel = useMemo(
        () => dayjs().locale(isVietnamese ? "vi" : "en").format("MMMM YYYY"),
        [isVietnamese],
    );

    const openCreate = () => {
        setEditing(null);
        setFormData({ category: "", amount: 0 });
        setModalOpen(true);
    };

    const openEdit = (budget: BudgetSummaryItem) => {
        setEditing(budget);
        setFormData({
            category: budget.category,
            amount: budget.amount,
        });
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.category.trim()) {
            toast({
                title: copy.categoryRequired,
                description: copy.categoryRequiredDesc,
                variant: "destructive",
            });
            return;
        }

        if (formData.amount <= 0) {
            toast({
                title: copy.invalidAmount,
                description: copy.invalidAmountDesc,
                variant: "destructive",
            });
            return;
        }

        setSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }

            const payload = {
                category: formData.category.trim(),
                amount: formData.amount,
                month: dayjs().month() + 1,
                year: dayjs().year(),
            };

            if (editing) {
                await budgetApi.updateBudget(editing._id, payload, token);
                toast({
                    title: copy.budgetUpdated,
                    variant: "success",
                });
            } else {
                await budgetApi.createBudget(payload, token);
                toast({
                    title: copy.budgetCreated,
                    variant: "success",
                });
            }

            setModalOpen(false);
            await fetchData();
        } catch (error: any) {
            toast({
                title: copy.saveFailed,
                description: error.message || copy.saveFailedDesc,
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!pendingDelete) {
            return;
        }

        setSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }
            await budgetApi.deleteBudget(pendingDelete._id, token);
            toast({
                title: copy.budgetDeleted,
                variant: "success",
            });
            setPendingDelete(null);
            await fetchData();
        } catch (error: any) {
            toast({
                title: copy.deleteFailed,
                description: error.message || copy.deleteFailedDesc,
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
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
                        {copy.newBudget}
                    </Button>
                }
                description={`${copy.description} ${monthLabel}.`}
                title={copy.title}
            />

            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                    icon={CreditCard}
                    subtitle={`${growth}% ${copy.vsPreviousMonth}`}
                    title={copy.totalBudget}
                    value={formatCurrency(totalBudget)}
                />
                <MetricCard
                    icon={CreditCard}
                    subtitle={`${Math.round(spentPercent)}% ${copy.plannedBudgetUsed}`}
                    title={copy.spent}
                    value={formatCurrency(totalSpent)}
                />
                <MetricCard
                    icon={CreditCard}
                    subtitle={copy.daysLeftThisMonth(
                        Math.max(0, dayjs().daysInMonth() - dayjs().date() + 1),
                    )}
                    title={copy.remaining}
                    value={formatCurrency(remaining)}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{copy.monthlyCategories}</CardTitle>
                    <CardDescription>
                        {copy.monthlyCategoriesDesc}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {budgets.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {budgets.map((budget) => {
                                const statusColor =
                                    budget.percent > 100
                                        ? "bg-rose-500"
                                        : budget.percent > 85
                                          ? "bg-amber-500"
                                          : "bg-emerald-500";

                                return (
                                    <Card key={budget._id} className="border-border/80">
                                        <CardContent className="p-5">
                                            <div className="mb-4 flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-base font-semibold text-foreground">
                                                        {budget.category}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {formatCurrency(budget.spent)} {copy.of}{" "}
                                                        {formatCurrency(budget.amount)}
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={() => setPendingDelete(budget)}
                                                    size="icon"
                                                    variant="ghost"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <Progress
                                                indicatorClassName={statusColor}
                                                value={Math.min(budget.percent, 100)}
                                            />
                                            <div className="mt-3 flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">
                                                    {Math.round(budget.percent)}%
                                                </span>
                                                <button
                                                    className="font-medium text-primary"
                                                    onClick={() => openEdit(budget)}
                                                    type="button"
                                                >
                                                    {copy.edit}
                                                </button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState
                            actionLabel={copy.createBudget}
                            description={copy.noBudgetsDesc}
                            icon={CreditCard}
                            onAction={openCreate}
                            title={copy.noBudgets}
                        />
                    )}
                </CardContent>
            </Card>

            <Dialog
                description={copy.formDescription}
                onClose={() => setModalOpen(false)}
                open={modalOpen}
                title={editing ? copy.editBudget : copy.createBudgetTitle}
            >
                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.category}</label>
                        <Input
                            onChange={(event) =>
                                setFormData((current) => ({
                                    ...current,
                                    category: event.target.value,
                                }))
                            }
                            placeholder={copy.categoryPlaceholder}
                            value={formData.category}
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.amount}</label>
                        <Input
                            min={0}
                            onChange={(event) =>
                                setFormData((current) => ({
                                    ...current,
                                    amount: Number(event.target.value) || 0,
                                }))
                            }
                            type="number"
                            value={formData.amount}
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button onClick={() => setModalOpen(false)} variant="outline">
                            {copy.cancel}
                        </Button>
                        <Button disabled={submitting} onClick={handleSubmit}>
                            {submitting
                                ? copy.saving
                                : editing
                                  ? copy.updateBudget
                                  : copy.createBudget}
                        </Button>
                    </div>
                </div>
            </Dialog>

            <ConfirmDialog
                busy={submitting}
                cancelLabel={copy.keep}
                confirmLabel={copy.delete}
                description={
                    pendingDelete
                        ? copy.deleteBudgetDesc(pendingDelete.category)
                        : ""
                }
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDelete}
                open={!!pendingDelete}
                title={copy.deleteBudget}
                variant="destructive"
            />
        </div>
    );
};

export default Budgets;
