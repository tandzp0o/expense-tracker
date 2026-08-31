import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FeatureGuideDialog,
  useFeatureGuide,
} from "components/app/feature-guide";
import { getFeatureGuideCopy } from "components/app/feature-guide-content";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { CreditCard, PiggyBank, Plus } from "lucide-react";
import { auth } from "lib/firebase/config";
import { budgetApi, walletApi } from "../services/budgetApi";
import {
  formatCurrency,
  formatWholeNumberInput,
} from "utils/formatters";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { PageHeader } from "components/app/page-header";
import { MetricCard } from "components/app/metric-card";
import { Button } from "components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import { Spinner } from "components/ui/spinner";
import {
  BudgetCards,
  type BudgetSummaryItem,
} from "../components/BudgetCards";
import {
  BudgetFormModal,
  type BudgetFormData,
} from "../modals/BudgetFormModal";
import { DeleteBudgetModal } from "../modals/DeleteBudgetModal";

dayjs.locale("vi");

interface WalletItem {
  _id: string;
  name: string;
}

const BudgetsPage: React.FC = () => {
  const { isVietnamese } = useLocale();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [budgets, setBudgets] = useState<BudgetSummaryItem[]>([]);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [growth, setGrowth] = useState(0);
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetSummaryItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BudgetSummaryItem | null>(
    null,
  );
  const [formData, setFormData] = useState<BudgetFormData>({
    walletId: "",
    category: "",
    categoryType: "standard" as "standard" | "custom",
    customCategoryName: "",
    subcategory: "",
    icon: "",
    color: "",
    tags: "",
    amount: 0,
  });
  const [amountInput, setAmountInput] = useState("");

  const baseCopy = isVietnamese
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
        wallet: "Ví",
        category: "Danh mục",
        amount: "Số tiền",
        walletRequired: "Cần chọn ví",
        walletRequiredDesc: "Hãy chọn ví áp dụng cho ngân sách này.",
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
        wallet: "Wallet",
        category: "Category",
        amount: "Amount",
        walletRequired: "Wallet required",
        walletRequiredDesc: "Select the wallet for this budget.",
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
  const copy = {
    ...baseCopy,
    description: isVietnamese
      ? "Thiết lập ngân sách tháng và theo dõi mức chi đã dùng."
      : "Set monthly budgets and track how much has been used.",
    monthlyCategoriesDesc: isVietnamese
      ? "Mỗi mục cho biết ví áp dụng, ngân sách, số đã chi và phần còn lại."
      : "Each item shows the linked wallet, budget, spent amount, and remaining balance.",
    formDescription: isVietnamese
      ? "Điền ví, danh mục và số tiền để tạo hoặc cập nhật ngân sách."
      : "Choose a wallet, category, and amount to create or update a budget.",
  };
  const loadFailedTitle = isVietnamese
    ? "Không thể tải ngân sách"
    : "Could not load budgets";
  const retryText = isVietnamese ? "Vui lòng thử lại." : "Please retry.";

  const getBudgetDisplayCategory = (budget: BudgetSummaryItem) => {
    const parent = budget.category || "";
    const custom = budget.customCategoryName?.trim() || "";
    const child = budget.subcategory?.trim() || "";
    if (custom && child) return `${custom} • ${child}`;
    if (custom) return custom;
    if (child) return `${parent} • ${child}`;
    return parent;
  };

  // Locale-derived error labels are intentionally reduced to stable primitives above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        return;
      }
      const [walletResponse, response]: any = await Promise.all([
        walletApi.getWallets(token),
        budgetApi.getBudgetSummary(
          { month: dayjs().month() + 1, year: dayjs().year() },
          token,
        ),
      ]);
      const walletList = walletResponse?.wallets || [];
      setWallets(walletList);
      setBudgets(response?.items || []);
      setTotalBudget(response?.totalBudget || 0);
      setTotalSpent(response?.totalSpent || 0);
      setGrowth(response?.growth || 0);
      setFormData((current) => ({
        ...current,
        walletId:
          current.walletId &&
          walletList.some(
            (wallet: WalletItem) => wallet._id === current.walletId,
          )
            ? current.walletId
            : walletList[0]?._id || "",
      }));
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
    () =>
      dayjs()
        .locale(isVietnamese ? "vi" : "en")
        .format("MMMM YYYY"),
    [isVietnamese],
  );

  const openCreate = () => {
    setEditing(null);
    setFormData({
      walletId: wallets[0]?._id || "",
      category: "",
      categoryType: "standard",
      customCategoryName: "",
      subcategory: "",
      icon: "",
      color: "",
      tags: "",
      amount: 0,
    });
    setAmountInput("");
    setModalOpen(true);
  };

  const openEdit = (budget: BudgetSummaryItem) => {
    setEditing(budget);
    setFormData({
      walletId: budget.walletId,
      category: budget.category,
      categoryType: budget.categoryType || "standard",
      customCategoryName: budget.customCategoryName || "",
      subcategory: budget.subcategory || "",
      icon: budget.icon || "",
      color: budget.color || "",
      tags: (budget.tags || []).join(", "),
      amount: budget.amount,
    });
    setAmountInput(formatWholeNumberInput(budget.amount));
    setModalOpen(true);
  };

  const handleAmountChange = (value: string, numericValue: number) => {
    setAmountInput(value);
    setFormData((current) => ({
      ...current,
      amount: numericValue,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.walletId) {
      toast({
        title: copy.walletRequired,
        description: copy.walletRequiredDesc,
        variant: "destructive",
      });
      return;
    }

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
        walletId: formData.walletId,
        category: formData.category.trim(),
        categoryType: formData.categoryType,
        customCategoryName: formData.customCategoryName.trim() || undefined,
        subcategory: formData.subcategory.trim() || undefined,
        icon: formData.icon.trim() || undefined,
        color: formData.color.trim() || undefined,
        tags: formData.tags
          .split(",")
          .map((item) => item.trim())
          .filter((item) => Boolean(item)),
        subBudgets: [],
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
      setAmountInput("");
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

  const featureGuide = useFeatureGuide("budgets", !loading);
  const featureGuideCopy = getFeatureGuideCopy(
    "budgets",
    isVietnamese,
  );

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <FeatureGuideDialog
        copy={featureGuideCopy}
        icon={PiggyBank}
        isVietnamese={isVietnamese}
        onAction={() => {
        featureGuide.dismiss();
        openCreate();
        }}
        onSkip={featureGuide.dismiss}
        open={featureGuide.open}
      />

      <div className="space-y-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{copy.title}</h1>
            <p className="hidden md:block mt-1 text-sm text-muted-foreground">{`${copy.description} ${monthLabel}.`}</p>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            {copy.newBudget}
          </Button>
        </div>
      </div>

      <PageHeader
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {copy.newBudget}
          </Button>
        }
        description={`${copy.description} ${monthLabel}.`}
        hideTitleOnMobile
        title={copy.title}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
          <CardDescription>{copy.monthlyCategoriesDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <BudgetCards
            budgets={budgets}
            copy={{
              createBudget: copy.createBudget,
              edit: copy.edit,
              monthlyCategories: copy.monthlyCategories,
              monthlyCategoriesDesc: copy.monthlyCategoriesDesc,
              noBudgets: copy.noBudgets,
              noBudgetsDesc: copy.noBudgetsDesc,
              of: copy.of,
              remaining: copy.remaining,
              spent: copy.spent,
            }}
            formatCurrency={formatCurrency}
            getCategoryLabel={getBudgetDisplayCategory}
            icon={CreditCard}
            onCreate={openCreate}
            onDelete={setPendingDelete}
            onEdit={openEdit}
          />
        </CardContent>
      </Card>

      <BudgetFormModal
        amountInput={amountInput}
        copy={{
          amount: copy.amount,
          cancel: copy.cancel,
          createBudget: copy.createBudget,
          createBudgetTitle: copy.createBudgetTitle,
          editBudget: copy.editBudget,
          formDescription: copy.formDescription,
          saving: copy.saving,
          updateBudget: copy.updateBudget,
          wallet: copy.wallet,
        }}
        editing={editing}
        formData={formData}
        isVietnamese={isVietnamese}
        onAmountChange={handleAmountChange}
        onClose={() => setModalOpen(false)}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        open={modalOpen}
        submitting={submitting}
        wallets={wallets}
      />

      <DeleteBudgetModal
        budget={pendingDelete}
        copy={{
          delete: copy.delete,
          deleteBudget: copy.deleteBudget,
          deleteBudgetDesc: copy.deleteBudgetDesc,
          keep: copy.keep,
        }}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        submitting={submitting}
      />
    </div>
  );
};

export default BudgetsPage;
