/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import {
  FeatureGuideDialog,
  useFeatureGuide,
} from "components/app/feature-guide";
import { getFeatureGuideCopy } from "components/app/feature-guide-content";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
  Goal as GoalIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  Plus,
  Target,
  Trophy,
} from "lucide-react";
import { auth } from "lib/firebase/config";
import { goalApi, transactionApi, walletApi } from "services/api";
import { useToast } from "contexts/ToastContext";
import { useLocale } from "contexts/LocaleContext";
import {
  formatCurrency,
  formatDate,
  formatWholeNumberInput,
} from "utils/formatters";
import { PageHeader } from "components/app/page-header";
import { MetricCard } from "components/app/metric-card";
import { EmptyState } from "components/app/empty-state";
import {
  MediaCoverCard,
  mediaCoverCardAspectTall,
  overlayBadgeClassName,
} from "components/app/media-cover-card";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { Spinner } from "components/ui/spinner";
import { Progress } from "components/ui/progress";
import { GoalFormModal } from "../modals/GoalFormModal";
import { DeleteGoalModal } from "../modals/DeleteGoalModal";
import {
  ContributionMode,
  ContributionWallet,
  GoalContributionModal,
} from "../modals/GoalContributionModal";

dayjs.locale("vi");

/** Category stored on goal deposits/withdrawals; the API requires a non-empty one. */
const GOAL_TRANSACTION_CATEGORY = "Goal";

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
  const { isVietnamese, timezoneOffsetMinutes } = useLocale();
  const { toast } = useToast();
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GoalItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GoalItem | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [targetAmountInput, setTargetAmountInput] = useState("");
  const [form, setForm] = useState({
    title: "",
    targetAmount: 0,
    deadline: "",
    description: "",
    category: "general",
  });
  const [wallets, setWallets] = useState<ContributionWallet[]>([]);
  const [contributionGoal, setContributionGoal] = useState<GoalItem | null>(
    null,
  );
  const [contributionMode, setContributionMode] =
    useState<ContributionMode>("deposit");
  const [contributionWalletId, setContributionWalletId] = useState("");
  const [contributionAmount, setContributionAmount] = useState(0);
  const [contributionAmountInput, setContributionAmountInput] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [contributing, setContributing] = useState(false);

  const baseCopy = isVietnamese
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
          "Đặt tiêu đề, số tiền cần đạt, danh mục, hạn và ảnh bìa. Tiền tiết kiệm được nạp riêng từ ví.",
        editGoal: "Chỉnh sửa mục tiêu",
        createGoalTitle: "Tạo mục tiêu",
        title: "Tiêu đề",
        targetAmount: "Số tiền mục tiêu",
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
        deposit: "Nạp tiền",
        withdraw: "Rút về ví",
        walletRequired: "Cần chọn ví",
        walletRequiredDesc: "Hãy chọn ví sẽ chuyển tiền cho mục tiêu này.",
        invalidAmount: "Số tiền không hợp lệ",
        invalidAmountDesc: "Số tiền phải lớn hơn 0.",
        withdrawTooMuchDesc:
          "Số tiền rút không được lớn hơn số đang có trong mục tiêu.",
        depositDone: "Đã nạp vào mục tiêu",
        withdrawDone: "Đã rút về ví",
        depositFailed: "Nạp tiền thất bại",
        withdrawFailed: "Rút tiền thất bại",
        depositNote: (title: string) => `Nạp cho mục tiêu ${title}`,
        withdrawNote: (title: string) => `Rút từ mục tiêu ${title}`,
        noWalletForGoal:
          "Bạn cần có ít nhất một ví trước khi nạp tiền cho mục tiêu.",
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
          "Set the title, target amount, category, deadline and cover image. Savings are deposited separately from a wallet.",
        editGoal: "Edit goal",
        createGoalTitle: "Create goal",
        title: "Title",
        targetAmount: "Target amount",
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
        deposit: "Add money",
        withdraw: "Withdraw",
        walletRequired: "Wallet required",
        walletRequiredDesc: "Choose the wallet this money moves from.",
        invalidAmount: "Invalid amount",
        invalidAmountDesc: "Amount must be greater than zero.",
        withdrawTooMuchDesc:
          "You cannot withdraw more than the goal currently holds.",
        depositDone: "Added to the goal",
        withdrawDone: "Returned to the wallet",
        depositFailed: "Deposit failed",
        withdrawFailed: "Withdrawal failed",
        depositNote: (title: string) => `Deposit for goal ${title}`,
        withdrawNote: (title: string) => `Withdrawal from goal ${title}`,
        noWalletForGoal:
          "You need at least one wallet before adding money to a goal.",
        general: "General",
        statuses: {
          active: "Active",
          completed: "Completed",
          expired: "Expired",
        },
      };
  const copy = {
    ...baseCopy,
    pageDescription: isVietnamese
      ? "Theo dõi các mục tiêu tiết kiệm và tiến độ hoàn thành của bạn."
      : "Track your savings goals and overall progress.",
    noGoalsDesc: isVietnamese
      ? "Tạo mục tiêu đầu tiên để bắt đầu theo dõi kế hoạch tiết kiệm."
      : "Create your first goal to start tracking savings progress.",
    formDescription: isVietnamese
      ? "Điền các thông tin chính để tạo hoặc cập nhật mục tiêu."
      : "Fill in the main details to create or update a goal.",
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
      const [data, walletResponse] = await Promise.all([
        goalApi.getGoals(token),
        walletApi.getWallets(token),
      ]);
      setGoals(Array.isArray(data) ? data : []);
      setWallets(walletResponse?.wallets || []);
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
        const [data, walletResponse] = await Promise.all([
          goalApi.getGoals(token),
          walletApi.getWallets(token),
        ]);
        setGoals(Array.isArray(data) ? data : []);
        setWallets(walletResponse?.wallets || []);
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
      deadline: "",
      description: "",
      category: "general",
    });
    setImageFile(null);
    setImagePreview("");
    setTargetAmountInput("");
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
      deadline: goal.deadline ? dayjs(goal.deadline).format("YYYY-MM-DD") : "",
      description: goal.description || "",
      category: goal.category || "general",
    });
    setImageFile(null);
    setImagePreview(goal.imageUrl || "");
    setTargetAmountInput(formatWholeNumberInput(goal.targetAmount));
    setModalOpen(true);
  };

  const handleTargetAmountChange = (value: string, numericValue: number) => {
    setTargetAmountInput(value);
    setForm((current) => ({
      ...current,
      targetAmount: numericValue,
    }));
  };

  const openContribution = (goal: GoalItem, mode: ContributionMode) => {
    if (wallets.length === 0) {
      toast({
        title: copy.walletRequired,
        description: copy.noWalletForGoal,
        variant: "destructive",
      });
      return;
    }

    setContributionGoal(goal);
    setContributionMode(mode);
    setContributionWalletId(wallets[0]?._id || "");
    setContributionAmount(0);
    setContributionAmountInput("");
    setContributionNote("");
  };

  const closeContribution = () => {
    setContributionGoal(null);
  };

  const handleContributionSubmit = async () => {
    if (!contributionGoal) {
      return;
    }

    if (!contributionWalletId) {
      toast({
        title: copy.walletRequired,
        description: copy.walletRequiredDesc,
        variant: "destructive",
      });
      return;
    }

    if (contributionAmount <= 0) {
      toast({
        title: copy.invalidAmount,
        description: copy.invalidAmountDesc,
        variant: "destructive",
      });
      return;
    }

    const isDeposit = contributionMode === "deposit";

    if (!isDeposit && contributionAmount > contributionGoal.currentAmount) {
      toast({
        title: copy.invalidAmount,
        description: copy.withdrawTooMuchDesc,
        variant: "destructive",
      });
      return;
    }

    setContributing(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        return;
      }

      await transactionApi.createTransaction(
        {
          type: isDeposit ? "GOAL_DEPOSIT" : "GOAL_WITHDRAW",
          status: "COMPLETED",
          amount: contributionAmount,
          walletId: contributionWalletId,
          goalId: contributionGoal._id,
          category: GOAL_TRANSACTION_CATEGORY,
          note:
            contributionNote.trim() ||
            (isDeposit
              ? copy.depositNote(contributionGoal.title)
              : copy.withdrawNote(contributionGoal.title)),
          date: new Date().toISOString(),
          timezoneOffset: timezoneOffsetMinutes,
        },
        token,
      );

      toast({
        title: isDeposit ? copy.depositDone : copy.withdrawDone,
        variant: "success",
      });
      setContributionGoal(null);
      await loadGoals();
    } catch (error: any) {
      toast({
        title: isDeposit ? copy.depositFailed : copy.withdrawFailed,
        description: error.message || copy.retry,
        variant: "destructive",
      });
    } finally {
      setContributing(false);
    }
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

  const featureGuide = useFeatureGuide("goals", !loading);
  const featureGuideCopy = getFeatureGuideCopy(
    "goals",
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
        icon={Target}
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
            <h1 className="text-xl font-semibold">{copy.pageTitle}</h1>
            <p className="hidden md:block mt-1 text-sm text-muted-foreground">
              {copy.pageDescription}
            </p>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            {copy.newGoal}
          </Button>
        </div>
      </div>

      <PageHeader
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {copy.newGoal}
          </Button>
        }
        description={copy.pageDescription}
        hideTitleOnMobile
        title={copy.pageTitle}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {goals.map((goal) => {
            const progress =
              goal.targetAmount > 0
                ? Math.min(
                    Math.round((goal.currentAmount / goal.targetAmount) * 100),
                    100,
                  )
                : 0;
            const statusBadgeClassName =
              goal.status === "completed"
                ? "border-white/15 bg-emerald-500/18 text-white backdrop-blur-sm"
                : goal.status === "expired"
                  ? "border-white/15 bg-red-500/18 text-white backdrop-blur-sm"
                  : overlayBadgeClassName;

            return (
              <MediaCoverCard
                key={goal._id}
                coverClassName={mediaCoverCardAspectTall}
                editLabel={copy.edit}
                extraContent={
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-2 text-[11px] text-white/90">
                      <span className="truncate">
                        {copy.savedLabel}: {formatCurrency(goal.currentAmount)}
                      </span>
                      <span className="shrink-0">
                        {copy.targetLabel}: {formatCurrency(goal.targetAmount)}
                      </span>
                    </div>
                    <Progress
                      className="h-1 bg-white/20"
                      indicatorClassName="bg-white"
                      value={progress}
                    />
                    <div className="flex gap-1.5 pt-1">
                      <button
                        className="flex flex-1 items-center justify-center gap-1 rounded-[var(--app-radius-md)] border border-white/25 bg-white/15 px-2 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                        onClick={(event) => {
                          event.stopPropagation();
                          openContribution(goal, "deposit");
                        }}
                        type="button"
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                        {copy.deposit}
                      </button>
                      <button
                        className="flex flex-1 items-center justify-center gap-1 rounded-[var(--app-radius-md)] border border-white/25 bg-white/10 px-2 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-40"
                        disabled={goal.currentAmount <= 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          openContribution(goal, "withdraw");
                        }}
                        type="button"
                      >
                        <ArrowUpFromLine className="h-3.5 w-3.5" />
                        {copy.withdraw}
                      </button>
                    </div>
                  </div>
                }
                footerLeading={
                  <div className="flex min-w-0 items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {goal.deadline
                        ? `${copy.deadline} ${formatDate(goal.deadline)}`
                        : copy.noDeadline}
                    </span>
                  </div>
                }
                media={
                  goal.imageUrl ? (
                    <img
                      alt={goal.title}
                      className="h-full w-full object-cover"
                      src={goal.imageUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary-soft text-primary">
                      <GoalIcon className="h-10 w-10" />
                    </div>
                  )
                }
                onDelete={() => setPendingDelete(goal)}
                onEdit={() => openEdit(goal)}
                subtitle={goal.description || copy.noDescription}
                tags={[
                  {
                    key: goal.category || "general",
                    label: getCategoryLabel(goal.category || "general"),
                  },
                ]}
                title={goal.title}
                topBadges={
                  <>
                    <Badge
                      className={`${statusBadgeClassName} px-2 py-0.5 text-[10px]`}
                      variant="outline"
                    >
                      {getStatusLabel(goal.status)}
                    </Badge>
                    <Badge
                      className="border-white/15 bg-emerald-500/18 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm"
                      variant="outline"
                    >
                      {progress}%
                    </Badge>
                  </>
                }
              />
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

      <GoalFormModal
        copy={{
          cancel: copy.cancel,
          category: copy.category,
          coverImage: copy.coverImage,
          createGoal: copy.createGoal,
          createGoalTitle: copy.createGoalTitle,
          deadlineLabel: copy.deadlineLabel,
          description: copy.description,
          editGoal: copy.editGoal,
          formDescription: copy.formDescription,
          goalPreview: copy.goalPreview,
          saving: copy.saving,
          targetAmount: copy.targetAmount,
          title: copy.title,
          updateGoal: copy.updateGoal,
        }}
        editing={editing}
        form={form}
        imagePreview={imagePreview}
        isVietnamese={isVietnamese}
        onClose={() => setModalOpen(false)}
        onFormChange={setForm}
        onImageChange={handleImageChange}
        onSubmit={handleSubmit}
        onTargetAmountChange={handleTargetAmountChange}
        open={modalOpen}
        saving={saving}
        targetAmountInput={targetAmountInput}
      />

      <GoalContributionModal
        amountInput={contributionAmountInput}
        goal={contributionGoal}
        isVietnamese={isVietnamese}
        mode={contributionMode}
        note={contributionNote}
        onAmountChange={(value, numericValue) => {
          setContributionAmountInput(value);
          setContributionAmount(numericValue);
        }}
        onClose={closeContribution}
        onNoteChange={setContributionNote}
        onSubmit={handleContributionSubmit}
        onWalletChange={setContributionWalletId}
        open={!!contributionGoal}
        submitting={contributing}
        walletId={contributionWalletId}
        wallets={wallets}
      />

      <DeleteGoalModal
        copy={{
          delete: copy.delete,
          deleteGoal: copy.deleteGoal,
          deleteGoalDesc: copy.deleteGoalDesc,
          keep: copy.keep,
        }}
        goal={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        saving={saving}
      />
    </div>
  );
};

export default Goals;
