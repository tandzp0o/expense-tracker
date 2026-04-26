import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Car,
  ChartPie,
  ChevronRight,
  CreditCard,
  Download,
  HeartPulse,
  Home,
  Landmark,
    Plus,
  ShoppingBag,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { auth } from "../firebase/config";
import { budgetApi, goalApi, transactionApi, walletApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import { getAppearanceGradientColors, useTheme } from "../contexts/ThemeContext";
import { cn, hexToRgba } from "../lib/utils";
import { PageHeader } from "../components/app/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";
import { Progress } from "../components/ui/progress";
import { Select } from "../components/ui/select";
import { ConfirmDialog } from "../components/ui/dialog";
import BarChart from "../components/charts/BarChart";
import LineChart from "../components/charts/LineChart";
import PieChart from "../components/charts/PieChart";

interface Transaction {
  _id: string;
  type: string;
  status?: "SCHEDULED" | "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
  amount: number | string;
  category: string;
  date: string;
  note?: string;
  transferGroupId?: string;
  walletId?:
    | string
    | {
        _id?: string;
        name?: string;
      }
    | null;
}

interface WalletItem {
  _id: string;
  name: string;
  balance: number | string;
  type?: string;
  color?: string;
  currency?: string;
  accountNumber?: string;
  imageUrl?: string;
}

interface WalletBudgetItem {
  _id: string;
  walletId: string;
  walletName: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  color?: string;
}

interface WalletBudgetSummaryItem {
  walletId: string;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  overspent: number;
  items: WalletBudgetItem[];
}

interface WalletBudgetSummaryResponse {
  walletSummaries: WalletBudgetSummaryItem[];
}

interface GoalItem {
  _id: string;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  category: string;
  deadline?: string;
  status: "active" | "completed" | "expired";
}

type PeriodFilter = "3m" | "6m" | "12m";
type TransactionFilter = "ALL" | "INCOME" | "EXPENSE";

const PERIOD_MONTHS: Record<PeriodFilter, number> = {
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

const PIE_FALLBACK_COLORS = [
  "#f59e0b",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#3b82f6",
];

const BUDGET_SEGMENT_COLORS = [
  "#22c55e",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#8b5cf6",
  "#ef4444",
];

const parseAmount = (raw: unknown) => {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : 0;
  }

  if (typeof raw === "string") {
    const value = Number(raw.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) ? value : 0;
  }

  return 0;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const getChartRadius = (preset: "compact" | "balanced" | "rounded") => {
  switch (preset) {
    case "compact":
      return 6;
    case "rounded":
      return 16;
    default:
      return 10;
  }
};

const buildSparklinePath = (values: number[]) => {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 40 - ((value - min) / range) * 32;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
};

const getWalletId = (walletId: Transaction["walletId"]) => {
  if (typeof walletId === "string") return walletId;
  return walletId?._id || "";
};

const getWalletName = (walletId: Transaction["walletId"], fallback: string) => {
  if (typeof walletId === "string") {
    return fallback;
  }

  return walletId?.name || fallback;
};

const getTransactionStatus = (transaction: Pick<Transaction, "status">) =>
  transaction.status || "COMPLETED";

const isTransferTransaction = (
  transaction: Pick<Transaction, "category" | "transferGroupId">,
) => transaction.category === "Transfer" || Boolean(transaction.transferGroupId);

const isCashflowTransaction = (transaction: Transaction) =>
  (transaction.type === "INCOME" || transaction.type === "EXPENSE") &&
  getTransactionStatus(transaction) === "COMPLETED" &&
  !isTransferTransaction(transaction);

const transactionStatusText = {
  COMPLETED: { vi: "Đã ghi nhận", en: "Completed" },
  SCHEDULED: { vi: "Đã lên lịch", en: "Scheduled" },
  PENDING: { vi: "Đang chờ", en: "Pending" },
  FAILED: { vi: "Thất bại", en: "Failed" },
  CANCELLED: { vi: "Đã hủy", en: "Cancelled" },
} as const;

const sumByType = (transactions: Transaction[], type: "INCOME" | "EXPENSE") =>
  transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);

const getDeltaTone = (
  current: number,
  previous: number,
  mode: "default" | "inverse" = "default",
) => {
  if (previous === 0 || current === previous) {
    return "text-muted-foreground";
  }

  const delta = current - previous;
  if (mode === "inverse") {
    return delta < 0 ? "text-emerald-600" : "text-rose-600";
  }

  return delta > 0 ? "text-emerald-600" : "text-rose-600";
};

const getCategoryMeta = (category: string) => {
  const label = normalizeText(category || "");

  if (label.includes("luong") || label.includes("freelance")) {
    return {
      icon: Briefcase,
      tone: "bg-primary-soft text-primary",
    };
  }

  if (
    label.includes("an") ||
    label.includes("uong") ||
    label.includes("food")
  ) {
    return {
      icon: ShoppingBag,
      tone: "bg-emerald-500/10 text-emerald-600",
    };
  }

  if (
    label.includes("xe") ||
    label.includes("transport") ||
    label.includes("di lai")
  ) {
    return {
      icon: Car,
      tone: "bg-sky-500/10 text-sky-600",
    };
  }

  if (
    label.includes("nha") ||
    label.includes("thue") ||
    label.includes("dien")
  ) {
    return {
      icon: Home,
      tone: "bg-violet-500/10 text-violet-600",
    };
  }

  if (
    label.includes("y te") ||
    label.includes("suc khoe") ||
    label.includes("health")
  ) {
    return {
      icon: HeartPulse,
      tone: "bg-rose-500/10 text-rose-600",
    };
  }

  return {
    icon: ShoppingBag,
    tone: "bg-muted text-foreground",
  };
};

const getCategoryChartColor = (category: string, index: number) => {
  const label = normalizeText(category || "");

  if (label.includes("an") || label.includes("uong") || label.includes("food")) {
    return "#10b981";
  }

  if (
    label.includes("xe") ||
    label.includes("transport") ||
    label.includes("di lai")
  ) {
    return "#0ea5e9";
  }

  if (
    label.includes("nha") ||
    label.includes("thue") ||
    label.includes("dien")
  ) {
    return "#8b5cf6";
  }

  if (
    label.includes("y te") ||
    label.includes("suc khoe") ||
    label.includes("health")
  ) {
    return "#f43f5e";
  }

  if (label.includes("mua") || label.includes("shopping")) {
    return "#ec4899";
  }

  return PIE_FALLBACK_COLORS[index % PIE_FALLBACK_COLORS.length];
};

const DashboardStatCard: React.FC<{
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}> = ({ title, value, description, icon: Icon, iconClassName }) => (
  <Card className="overflow-hidden border-border/70 bg-card/95">
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[calc(var(--app-radius-md)-3px)] bg-muted text-foreground",
            iconClassName,
          )}
        >
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-[1.5rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[1.7rem]">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isVietnamese } = useLocale();
  const { toast } = useToast();
  const { appearance } = useTheme();
  const locale = isVietnamese ? "vi-VN" : "en-US";
  const dayjsLocale = isVietnamese ? "vi" : "en";
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [budgetSummary, setBudgetSummary] =
    useState<WalletBudgetSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("6m");
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [transactionFilter, setTransactionFilter] =
    useState<TransactionFilter>("ALL");
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedWalletId, setExpandedWalletId] = useState<string | null>(null);
  const fetchRequestRef = useRef(0);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);
  const [transactionPanelHeight, setTransactionPanelHeight] = useState<
    number | null
  >(null);

  const baseCopy = isVietnamese
      ? {
          headerTitle: "Bảng điều khiển tài chính",
          headerDescription:
            "Theo dõi dòng tiền, giao dịch gần đây, mục tiêu và số dư ví trong một nơi.",
          reportButton: "Báo cáo",
          addTransaction: "Thêm giao dịch",
          allWallets: "Tất cả ví",
          periods: {
            "3m": "3 tháng",
            "6m": "6 tháng",
            "12m": "12 tháng",
          } as Record<PeriodFilter, string>,
          myBalance: "Tổng số dư",
          income: "Thu nhập",
          expense: "Chi tiêu",
          monthExpense: "Chi tiêu tháng",
          netProfit: "Dòng tiền ròng",
          summary: "Tóm tắt",
          vsPreviousPeriod: "so với kỳ trước",
          noChange: "Không đổi so với kỳ trước",
          newChange: "Phát sinh mới so với kỳ trước",
          allWalletsActive: (count: number) =>
            `${count} ví đang hoạt động trong hệ thống`,
          activeWalletFocus: (name: string) =>
            `${name} đang được chọn trên dashboard`,
          savingsRate: (value: number) =>
            `${value.toFixed(0)}% được giữ lại từ tổng thu`,
          incomeChartDesc: (periodLabel: string) =>
            `Biểu đồ thu nhập theo ${periodLabel.toLowerCase()} gần nhất`,
          expenseChartDesc: "Tổng chi tiêu từng tháng trong kỳ đang chọn",
          summaryChartDesc: "Tóm tắt các danh mục bạn đã chi tiêu trong kỳ này",
          totalIncome: "Tổng thu nhập",
          totalExpense: "Tổng chi tiêu",
          transactionsTitle: "Giao dịch",
          transactionsDesc:
            "Danh sách giao dịch thay đổi theo bộ lọc kỳ xem, ví và loại giao dịch",
          openTransactions: "Mở giao dịch",
          noTransactions: "Chưa có giao dịch phù hợp với bộ lọc hiện tại.",
          all: "Tất cả",
          savingGoalTitle: "Mục tiêu tiết kiệm",
          savingGoalDesc:
            "Tiến độ mục tiêu đang ưu tiên trên dashboard",
          openGoals: "Xem mục tiêu",
          goalFocus: "Mục tiêu ưu tiên",
          savedAmount: "Đã tiết kiệm",
          activeGoals: "Mục tiêu đang chạy",
          completedGoals: "Đã hoàn thành",
          totalProgress: "Tổng tiến độ",
          target: "Mục tiêu",
          progress: "Tiến độ",
          deadline: "Hạn",
          noDeadline: "Chưa đặt hạn",
          noGoalsTitle: "Chưa có mục tiêu tiết kiệm",
          noGoalsDesc: "Tạo goal để hiển thị tiến độ tiết kiệm trên dashboard.",
          myWalletTitle: "Ví của tôi",
          myWalletDesc:
            "Danh sách ví hiện tại theo dạng card để xem nhanh số dư và tỷ trọng",
          manageWallets: "Quản lý ví",
          availableBalance: "Số dư hiện tại",
          allocation: "Phân bổ",
          allocationDetails: "Chi tiết phân bổ",
          backToCard: "Quay lại",
          freeToSpend: "Có thể chi",
          budgetReserved: "Giữ cho ngân sách",
          noBudgetReserve: "Chưa gắn ngân sách tháng này",
          share: "Tỷ trọng",
          active: "Đang chọn",
          noWallets: "Chưa có ví nào để hiển thị.",
          unknownWallet: "Không rõ ví",
          genericCategory: "Tổng quát",
          noExpenseData: "Chưa có chi tiêu để tổng hợp.",
          deleteTransaction: "Xóa giao dịch",
          deleteTransactionDesc: (label: string) =>
            `Xóa "${label}" khỏi danh sách giao dịch?`,
          keep: "Giữ lại",
          delete: "Xóa",
          deleted: "Đã xóa giao dịch",
          deleteFailed: "Xóa thất bại",
          loadFailed: "Không thể tải dashboard",
          loadFailedDesc: "Vui lòng thử lại sau ít phút.",
          goalStatuses: {
            active: "Đang thực hiện",
            completed: "Hoàn thành",
            expired: "Hết hạn",
          } as Record<GoalItem["status"], string>,
          walletTypes: {
            cash: "Tiền mặt",
            bank: "Ngân hàng",
            ewallet: "Ví điện tử",
            other: "Tài khoản",
          },
          transactionLabels: {
            INCOME: "Thu nhập",
            EXPENSE: "Chi tiêu",
            OTHER: "Tiết kiệm",
          },
        }
    : {
        headerTitle: "Finance Dashboard",
        headerDescription:
          "The header combines title, actions and filters so every card, chart and section below follows the same selected period and wallet.",
        reportButton: "Report",
        addTransaction: "Add transaction",
        allWallets: "All wallets",
        periods: {
          "3m": "3 months",
          "6m": "6 months",
          "12m": "12 months",
        } as Record<PeriodFilter, string>,
        myBalance: "My Balance",
        income: "Income",
        monthExpense: "Month Expense",
        netProfit: "Net Profit",
        vsPreviousPeriod: "vs previous period",
        noChange: "No change vs previous period",
        newChange: "New activity vs previous period",
        allWalletsActive: (count: number) =>
          `${count} wallets currently active`,
        activeWalletFocus: (name: string) =>
          `${name} is currently focused on this dashboard`,
        savingsRate: (value: number) =>
          `${value.toFixed(0)}% retained from total income`,
        incomeChartDesc: (periodLabel: string) =>
          `Income trend for the last ${periodLabel.toLowerCase()}`,
        expenseChartDesc: "Monthly expenses for the selected period",
        summaryChartDesc:
          "Summary of the categories you have spent on in this period",
        totalIncome: "Total income",
        totalExpense: "Total expense",
        transactionsTitle: "Transactions",
        transactionsDesc:
          "Recent transactions filtered by period, wallet and transaction type",
        openTransactions: "Open transactions",
        noTransactions: "No transactions match the current filters.",
        all: "All",
        expense: "Expense",
        savingGoalTitle: "Saving Goal",
        savingGoalDesc:
          "Highlighted savings goal plus an overview of current progress",
        openGoals: "Open goals",
        goalFocus: "Goal focus",
        savedAmount: "Saved",
        activeGoals: "Active goals",
        completedGoals: "Completed",
        totalProgress: "Total progress",
        target: "Target",
        progress: "Progress",
        summary: "Summary",
        deadline: "Deadline",
        noDeadline: "No deadline",
        noGoalsTitle: "No saving goal yet",
        noGoalsDesc:
          "Create a goal to surface savings progress on the dashboard.",
        myWalletTitle: "My Wallet",
        myWalletDesc:
          "Wallet cards let you scan balances and portfolio share quickly",
        manageWallets: "Manage wallets",
        availableBalance: "Available balance",
        allocation: "Allocation",
        allocationDetails: "Allocation details",
        backToCard: "Back",
        freeToSpend: "Free to spend",
        budgetReserved: "Reserved",
        noBudgetReserve: "No budgets linked this month",
        share: "Share",
        active: "Active",
        noWallets: "No wallet available to display.",
        unknownWallet: "Unknown wallet",
        genericCategory: "General",
        noExpenseData: "No expense data available.",
        deleteTransaction: "Delete transaction",
        deleteTransactionDesc: (label: string) =>
          `Remove "${label}" from the transaction list?`,
        keep: "Keep",
        delete: "Delete",
        deleted: "Transaction deleted",
        deleteFailed: "Delete failed",
        loadFailed: "Could not load dashboard",
        loadFailedDesc: "Please retry in a moment.",
        goalStatuses: {
          active: "Active",
          completed: "Completed",
          expired: "Expired",
        } as Record<GoalItem["status"], string>,
        walletTypes: {
          cash: "Cash",
          bank: "Bank",
          ewallet: "E-wallet",
          other: "Account",
        },
        transactionLabels: {
          INCOME: "Income",
          EXPENSE: "Expense",
          OTHER: "Saving",
        },
      };

  const copy = {
    ...baseCopy,
    headerTitle: isVietnamese ? "Bảng điều khiển tài chính" : "Finance Dashboard",
    headerDescription: isVietnamese
      ? "Theo dõi dòng tiền, giao dịch gần đây, mục tiêu và số dư ví trong một nơi."
      : "Track cash flow, recent activity, goals, and wallet balances in one place.",
    summaryChartDesc: isVietnamese
      ? "Tỷ trọng chi tiêu theo từng danh mục chính."
      : "Spending share across your main categories.",
    transactionsDesc: isVietnamese
      ? "Giao dịch gần đây theo bộ lọc hiện tại."
      : "Recent transactions based on the current filters.",
    openTransactions: isVietnamese ? "Xem tất cả" : "View all",
    savingGoalDesc: isVietnamese
      ? "Theo dõi mục tiêu đang ưu tiên và tiến độ hiện tại."
      : "Keep an eye on your current priority goal.",
    noGoalsDesc: isVietnamese
      ? "Tạo mục tiêu để bắt đầu theo dõi tiến độ tiết kiệm."
      : "Create a goal to start tracking savings progress.",
    myWalletTitle: isVietnamese ? "Ví tiền" : "Wallets",
    myWalletDesc: isVietnamese
      ? "Xem nhanh số dư và tỷ trọng của từng ví."
      : "Quickly scan balances and wallet share.",
    manageWallets: isVietnamese ? "Quản lý ví" : "Manage wallets",
  };

  const formatDeltaText = useCallback(
    (current: number, previous: number) => {
      if (previous === 0) {
        return current === 0 ? copy.noChange : copy.newChange;
      }

      const delta = ((current - previous) / Math.abs(previous)) * 100;
      const sign = delta > 0 ? "+" : "";
      const decimals = Math.abs(delta) >= 10 ? 0 : 1;

      return `${sign}${delta.toFixed(decimals)}% ${copy.vsPreviousPeriod}`;
    },
    [copy.newChange, copy.noChange, copy.vsPreviousPeriod],
  );

  const fetchData = useCallback(async () => {
    const activeUserId = currentUser?.uid;
    if (!activeUserId) {
      setWallets([]);
      setTransactions([]);
      setGoals([]);
      setLoading(false);
      return;
    }

    const requestId = fetchRequestRef.current + 1;
    fetchRequestRef.current = requestId;
    setLoading(true);
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || firebaseUser.uid !== activeUserId) {
        return;
      }

      const token = await firebaseUser.getIdToken();
      const startDate = dayjs()
        .subtract(23, "month")
        .startOf("month")
        .toISOString();
      const endDate = dayjs().endOf("month").toISOString();

      const [walletsRes, transactionRes, goalsRes, budgetSummaryRes] =
        await Promise.all([
        walletApi.getWallets(token),
        transactionApi.getTransactions(
          {
            startDate,
            endDate,
            limit: 2500,
            page: 1,
          },
          token,
        ),
        goalApi.getGoals(token),
        budgetApi.getBudgetSummary(
          {
            month: dayjs().month() + 1,
            year: dayjs().year(),
          },
          token,
        ),
        ]);

      if (fetchRequestRef.current !== requestId) {
        return;
      }

      setWallets(walletsRes?.wallets || []);
      setTransactions(transactionRes?.data?.transactions || []);
      setGoals(Array.isArray(goalsRes) ? goalsRes : goalsRes?.data || []);
      setBudgetSummary(budgetSummaryRes || null);
    } catch (error: any) {
      if (fetchRequestRef.current !== requestId) {
        return;
      }

      toast({
        title: copy.loadFailed,
        description: error?.message || copy.loadFailedDesc,
        variant: "destructive",
      });
    } finally {
      if (fetchRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [copy.loadFailed, copy.loadFailedDesc, currentUser?.uid, toast]);

  useEffect(() => {
    dayjs.locale(dayjsLocale);
  }, [dayjsLocale]);

  useEffect(() => {
    setSelectedWallet("all");
    setPendingDelete(null);
    setWallets([]);
    setTransactions([]);
    setGoals([]);
    setBudgetSummary(null);
    setExpandedWalletId(null);
  }, [currentUser?.uid]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (typeof window === "undefined" || !rightColumnRef.current) {
      return;
    }

    const rightColumn = rightColumnRef.current;
    const desktopQuery = window.matchMedia("(min-width: 1280px)");

    const updateTransactionPanelHeight = () => {
      if (!desktopQuery.matches) {
        setTransactionPanelHeight(null);
        return;
      }

      const nextHeight = Math.ceil(rightColumn.getBoundingClientRect().height);
      setTransactionPanelHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    };

    updateTransactionPanelHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateTransactionPanelHeight();
    });

    resizeObserver.observe(rightColumn);

    if (typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", updateTransactionPanelHeight);
    } else {
      desktopQuery.addListener(updateTransactionPanelHeight);
    }

    return () => {
      resizeObserver.disconnect();

      if (typeof desktopQuery.removeEventListener === "function") {
        desktopQuery.removeEventListener("change", updateTransactionPanelHeight);
      } else {
        desktopQuery.removeListener(updateTransactionPanelHeight);
      }
    };
  }, []);

  const handleDeleteTransaction = useCallback(async () => {
    if (!pendingDelete) {
      return;
    }

    setDeleting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        return;
      }

      await transactionApi.deleteTransaction(pendingDelete._id, token);
      toast({
        title: copy.deleted,
        variant: "success",
      });
      setPendingDelete(null);
      await fetchData();
    } catch (error: any) {
      toast({
        title: copy.deleteFailed,
        description: error?.message || copy.loadFailedDesc,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }, [
    copy.deleteFailed,
    copy.deleted,
    copy.loadFailedDesc,
    fetchData,
    pendingDelete,
    toast,
  ]);

  const chartRadius = getChartRadius(appearance.radiusPreset);
  const tickColor =
    appearance.mode === "dark"
      ? "rgba(148, 163, 184, 0.92)"
      : "rgba(100, 116, 139, 0.92)";
  const gridColor =
    appearance.mode === "dark"
      ? "rgba(148, 163, 184, 0.14)"
      : "rgba(148, 163, 184, 0.18)";
  const themeColors = getAppearanceGradientColors(appearance);
  const themedSurfaceGradient =
    appearance.mode === "dark"
      ? `linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, ${hexToRgba(
          themeColors.primary,
          0.32,
        )} 44%, ${hexToRgba(
          themeColors.secondary,
          0.34,
        )} 58%, rgba(15, 23, 42, 0.92) 100%)`
      : `linear-gradient(135deg, ${hexToRgba(
          themeColors.primary,
          0.18,
        )} 0%, rgba(255, 255, 255, 0.94) 46%, ${hexToRgba(
          themeColors.secondary,
          0.32,
        )} 100%)`;
  const themedActionGradient = `linear-gradient(135deg, ${hexToRgba(
    themeColors.primary,
    0.96,
  )} 0%, ${hexToRgba(themeColors.secondary, 0.78)} 54%, rgba(15, 23, 42, 0.86) 100%)`;

  const sharedLegend = {
    position: "bottom" as const,
    labels: {
      usePointStyle: true,
      boxWidth: 8,
      padding: 18,
      color: tickColor,
    },
  };

  const periodMonths = PERIOD_MONTHS[selectedPeriod];
  const periodLabel = copy.periods[selectedPeriod];

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [locale],
  );

  const allWalletBalance = useMemo(
    () =>
      wallets.reduce((total, wallet) => total + parseAmount(wallet.balance), 0),
    [wallets],
  );

  const selectedWalletItem = useMemo(
    () => wallets.find((wallet) => wallet._id === selectedWallet),
    [selectedWallet, wallets],
  );

  const currentRange = useMemo(() => {
    const end = dayjs().endOf("month");
    const start = end.startOf("month").subtract(periodMonths - 1, "month");

    return { start, end };
  }, [periodMonths]);

  const previousRange = useMemo(() => {
    const end = currentRange.start.subtract(1, "day").endOf("day");
    const start = currentRange.start.subtract(periodMonths, "month");

    return { start, end };
  }, [currentRange.start, periodMonths]);

  const walletScopedTransactions = useMemo(() => {
    if (selectedWallet === "all") {
      return transactions;
    }

    return transactions.filter(
      (transaction) => getWalletId(transaction.walletId) === selectedWallet,
    );
  }, [selectedWallet, transactions]);

  const currentTransactions = useMemo(
    () =>
      walletScopedTransactions.filter((transaction) => {
        const value = dayjs(transaction.date).valueOf();
        return (
          value >= currentRange.start.valueOf() &&
          value <= currentRange.end.valueOf()
        );
      }),
    [currentRange.end, currentRange.start, walletScopedTransactions],
  );

  const previousTransactions = useMemo(
    () =>
      walletScopedTransactions.filter((transaction) => {
        const value = dayjs(transaction.date).valueOf();
        return (
          value >= previousRange.start.valueOf() &&
          value <= previousRange.end.valueOf()
        );
      }),
    [previousRange.end, previousRange.start, walletScopedTransactions],
  );

  const currentCashflowTransactions = useMemo(
    () => currentTransactions.filter(isCashflowTransaction),
    [currentTransactions],
  );

  const previousCashflowTransactions = useMemo(
    () => previousTransactions.filter(isCashflowTransaction),
    [previousTransactions],
  );

  const walletScopedCashflowTransactions = useMemo(
    () => walletScopedTransactions.filter(isCashflowTransaction),
    [walletScopedTransactions],
  );

  const currentWeekStart = useMemo(() => {
    const today = dayjs().startOf("day");
    return today.subtract((today.day() + 6) % 7, "day");
  }, []);

  const weeklyExpenseBuckets = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = currentWeekStart.add(index, "day");
        const value = walletScopedCashflowTransactions
          .filter(
            (transaction) =>
              transaction.type === "EXPENSE" &&
              dayjs(transaction.date).isSame(day, "day"),
          )
          .reduce(
            (total, transaction) => total + parseAmount(transaction.amount),
            0,
          );

        return {
          label: isVietnamese
            ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][index]
            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index],
          value,
        };
      }),
    [currentWeekStart, isVietnamese, walletScopedCashflowTransactions],
  );

  const currentWeekExpense = useMemo(
    () => weeklyExpenseBuckets.reduce((total, item) => total + item.value, 0),
    [weeklyExpenseBuckets],
  );

  const previousWeekExpense = useMemo(() => {
    const previousStart = currentWeekStart.subtract(7, "day");
    const previousEnd = currentWeekStart.subtract(1, "millisecond");

    return walletScopedCashflowTransactions
      .filter((transaction) => {
        const value = dayjs(transaction.date).valueOf();
        return (
          transaction.type === "EXPENSE" &&
          value >= previousStart.valueOf() &&
          value <= previousEnd.valueOf()
        );
      })
      .reduce((total, transaction) => total + parseAmount(transaction.amount), 0);
  }, [currentWeekStart, walletScopedCashflowTransactions]);

  const monthExpenseSparkline = useMemo(() => {
    const buckets = Array.from({ length: 5 }, () => 0);
    const monthStart = dayjs().startOf("month");
    const monthEnd = dayjs().endOf("month");

    walletScopedCashflowTransactions
      .filter((transaction) => {
        const date = dayjs(transaction.date);
        return (
          transaction.type === "EXPENSE" &&
          date.valueOf() >= monthStart.valueOf() &&
          date.valueOf() <= monthEnd.valueOf()
        );
      })
      .forEach((transaction) => {
        const date = dayjs(transaction.date);
        const bucketIndex = Math.min(Math.floor((date.date() - 1) / 7), 4);
        buckets[bucketIndex] += parseAmount(transaction.amount);
      });

    return buckets;
  }, [walletScopedCashflowTransactions]);

  const mobileWeekMaxExpense = Math.max(
    ...weeklyExpenseBuckets.map((item) => item.value),
    1,
  );
  const weeklyExpenseChange =
    previousWeekExpense > 0
      ? ((previousWeekExpense - currentWeekExpense) / previousWeekExpense) * 100
      : 0;
  const weeklyExpenseChangeLabel =
    previousWeekExpense > 0
      ? `${weeklyExpenseChange >= 0 ? "↓" : "↑"} ${Math.abs(
          weeklyExpenseChange,
        ).toFixed(0)}%`
      : "";
  const mobileSparklinePath = buildSparklinePath(monthExpenseSparkline);

  const totalIncome = useMemo(
    () => sumByType(currentCashflowTransactions, "INCOME"),
    [currentCashflowTransactions],
  );

  const totalExpense = useMemo(
    () => sumByType(currentCashflowTransactions, "EXPENSE"),
    [currentCashflowTransactions],
  );

  const previousIncome = useMemo(
    () => sumByType(previousCashflowTransactions, "INCOME"),
    [previousCashflowTransactions],
  );

  const previousExpense = useMemo(
    () => sumByType(previousCashflowTransactions, "EXPENSE"),
    [previousCashflowTransactions],
  );

  const netProfit = totalIncome - totalExpense;
  const previousNetProfit = previousIncome - previousExpense;
  const dashboardBalance =
    selectedWallet === "all"
      ? allWalletBalance
      : parseAmount(selectedWalletItem?.balance);
  const savingsRate = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const monthBuckets = useMemo(
    () =>
      Array.from({ length: periodMonths }, (_, index) =>
        currentRange.start.add(index, "month").locale(dayjsLocale),
      ),
    [currentRange.start, dayjsLocale, periodMonths],
  );

  const incomeChartData = useMemo(
    () => ({
      labels: monthBuckets.map((month) => month.format("MM/YYYY")),
      datasets: [
        {
          label: copy.income,
          data: monthBuckets.map((month) =>
            currentCashflowTransactions
              .filter(
                (transaction) =>
                  transaction.type === "INCOME" &&
                  dayjs(transaction.date).isSame(month, "month"),
              )
              .reduce(
                (total, transaction) => total + parseAmount(transaction.amount),
                0,
              ),
          ),
          borderColor: appearance.primaryColor,
          backgroundColor: hexToRgba(appearance.primaryColor, 0.16),
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 0,
        },
      ],
    }),
    [
      appearance.primaryColor,
      copy.income,
      currentCashflowTransactions,
      monthBuckets,
    ],
  );

  const expenseChartData = useMemo(
    () => ({
      labels: monthBuckets.map((month) => month.format("MM/YYYY")),
      datasets: [
        {
          label: copy.monthExpense,
          data: monthBuckets.map((month) =>
            currentCashflowTransactions
              .filter(
                (transaction) =>
                  transaction.type === "EXPENSE" &&
                  dayjs(transaction.date).isSame(month, "month"),
              )
              .reduce(
                (total, transaction) => total + parseAmount(transaction.amount),
                0,
              ),
          ),
          backgroundColor: "rgba(244, 63, 94, 0.78)",
          borderRadius: chartRadius,
          borderSkipped: false,
          maxBarThickness: 22,
        },
      ],
    }),
    [chartRadius, copy.monthExpense, currentCashflowTransactions, monthBuckets],
  );

  const expenseCategories = useMemo(() => {
    const totals = new Map<string, number>();

    currentCashflowTransactions
      .filter((transaction) => transaction.type === "EXPENSE")
      .forEach((transaction) => {
        const label = transaction.category?.trim() || copy.genericCategory;
        totals.set(
          label,
          (totals.get(label) || 0) + parseAmount(transaction.amount),
        );
      });

    return Array.from(totals.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([name, value], index) => ({
        name,
        value,
        percent: totalExpense > 0 ? (value / totalExpense) * 100 : 0,
        color: getCategoryChartColor(name, index),
      }));
  }, [
    copy.genericCategory,
    currentCashflowTransactions,
    totalExpense,
  ]);

  const summaryChartData = useMemo(
    () => ({
      labels: expenseCategories.map((category) => category.name),
      datasets: [
        {
          data: expenseCategories.map((category) => category.value),
          backgroundColor: expenseCategories.map((category) => category.color),
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
    }),
    [expenseCategories],
  );

  const recentTransactions = useMemo(() => {
    const sorted = [...currentTransactions].sort(
      (left, right) => dayjs(right.date).valueOf() - dayjs(left.date).valueOf(),
    );

    if (transactionFilter === "INCOME") {
      return sorted.filter((transaction) => transaction.type === "INCOME");
    }

    if (transactionFilter === "EXPENSE") {
      return sorted.filter((transaction) => transaction.type === "EXPENSE");
    }

    return sorted;
  }, [currentTransactions, transactionFilter]);

  const goalItems = useMemo(
    () =>
      goals.map((goal) => {
        const progress =
          goal.targetAmount > 0
            ? Math.min(
                (parseAmount(goal.currentAmount) /
                  parseAmount(goal.targetAmount)) *
                  100,
                100,
              )
            : 0;
        const completed = goal.status === "completed" || progress >= 100;

        return {
          ...goal,
          progress,
          completed,
        };
      }),
    [goals],
  );

  const goalSummary = useMemo(() => {
    const activeGoals = goalItems.filter(
      (goal) => !goal.completed && goal.status !== "expired",
    );
    const completedGoals = goalItems.filter((goal) => goal.completed);
    const totalSaved = goalItems.reduce(
      (total, goal) => total + parseAmount(goal.currentAmount),
      0,
    );
    const totalTarget = goalItems.reduce(
      (total, goal) => total + parseAmount(goal.targetAmount),
      0,
    );

    const featuredGoal =
      [...activeGoals].sort((left, right) => {
        const leftDeadline = left.deadline
          ? dayjs(left.deadline).valueOf()
          : Number.MAX_SAFE_INTEGER;
        const rightDeadline = right.deadline
          ? dayjs(right.deadline).valueOf()
          : Number.MAX_SAFE_INTEGER;

        if (leftDeadline !== rightDeadline) {
          return leftDeadline - rightDeadline;
        }

        return right.progress - left.progress;
      })[0] || goalItems[0];

    return {
      activeCount: activeGoals.length,
      completedCount: completedGoals.length,
      totalSaved,
      totalTarget,
      progress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
      featuredGoal,
    };
  }, [goalItems]);

  const walletCards = useMemo(
    () =>
      wallets.map((wallet, index) => ({
        ...wallet,
        share:
          allWalletBalance > 0
            ? (parseAmount(wallet.balance) / allWalletBalance) * 100
            : 0,
        background:
          wallet.imageUrl
            ? `linear-gradient(180deg, rgba(2, 6, 23, 0.14) 0%, rgba(2, 6, 23, 0.62) 72%, rgba(2, 6, 23, 0.88) 100%), url("${wallet.imageUrl}")`
            : wallet.color && wallet.color.startsWith("#")
              ? `linear-gradient(180deg, ${hexToRgba(
                  wallet.color,
                  0.72,
                )} 0%, ${hexToRgba(wallet.color, 0.92)} 54%, rgba(2, 6, 23, 0.94) 100%)`
            : `linear-gradient(180deg, ${hexToRgba(
                themeColors.primary,
                0.72,
              )} 0%, ${hexToRgba(
                themeColors.secondary,
                0.9,
              )} 58%, rgba(2, 6, 23, 0.94) 100%)`,
      })),
    [allWalletBalance, themeColors.primary, themeColors.secondary, wallets],
  );

  const walletBudgetSummaryMap = useMemo(
    () =>
      new Map(
        (budgetSummary?.walletSummaries || []).map((summary) => [
          summary.walletId,
          summary,
        ]),
      ),
    [budgetSummary],
  );

  const getBudgetColor = useCallback(
    (budget: WalletBudgetItem, index: number) =>
      budget.color || BUDGET_SEGMENT_COLORS[index % BUDGET_SEGMENT_COLORS.length],
    [],
  );

  const axisTick = (value: number | string) =>
    numberFormatter.format(Number(value) || 0);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-3 lg:hidden">
        <div
          className="overflow-hidden rounded-[calc(var(--app-radius-xl)+4px)] border border-white/70 p-4 shadow-soft dark:border-white/10"
          style={{ backgroundImage: themedSurfaceGradient }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {copy.myBalance}
              </p>
              <p className="mt-2 text-[2rem] font-semibold tracking-tight text-foreground">
                {formatCurrency(
                  dashboardBalance,
                  selectedWalletItem?.currency || "VND",
                  {
                  displayMode: "full",
                  },
                )}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-primary dark:border-white/10 dark:bg-white/10">
              <Sparkles className="h-3.5 w-3.5" />
              {isVietnamese ? "AI đang học thói quen" : "AI learning your habits"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/50 pt-4 dark:border-white/10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {isVietnamese ? "Vào" : "In"}
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-600">
                {formatCurrency(totalIncome)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {isVietnamese ? "Ra" : "Out"}
              </p>
              <p className="mt-1 text-sm font-semibold text-rose-600">
                {formatCurrency(totalExpense)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {isVietnamese ? "Để dành" : "Saved"}
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {formatCurrency(goalSummary.totalSaved)}
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-[var(--app-radius-xl)] border border-white/70 px-4 py-3 text-white shadow-soft dark:border-white/10"
          style={{ backgroundImage: themedActionGradient }}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/18">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/78">
                {isVietnamese ? "Trợ lý AI" : "AI copilot"}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {netProfit >= 0
                  ? isVietnamese
                    ? "Tuần này bạn đang giữ nhịp chi tiêu ổn định, có thể đẩy thêm vào mục tiêu."
                    : "Your spending rhythm is stable this week, so you can push a bit more into goals."
                  : isVietnamese
                    ? "Chi tiêu đang cao hơn nhịp thường lệ, AI sẽ ưu tiên nhắc các nhóm dễ cắt giảm."
                    : "Spending is running above your usual rhythm, so AI will prioritize easier categories to trim."}
              </p>
            </div>
          </div>
        </div>

        <div className="hidden gap-2 rounded-[var(--app-radius-xl)] border border-border/70 bg-card/80 p-2 shadow-soft">
          <Select
            className="w-full"
            onChange={(event) =>
              setSelectedPeriod(event.target.value as PeriodFilter)
            }
            value={selectedPeriod}
          >
            <option value="3m">{copy.periods["3m"]}</option>
            <option value="6m">{copy.periods["6m"]}</option>
            <option value="12m">{copy.periods["12m"]}</option>
          </Select>

          <Select
            className="w-full"
            onChange={(event) => setSelectedWallet(event.target.value)}
            value={selectedWallet}
          >
            <option value="all">{copy.allWallets}</option>
            {wallets.map((wallet) => (
              <option key={wallet._id} value={wallet._id}>
                {wallet.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <PageHeader
        actions={
          <div className="flex w-full flex-col gap-3 lg:items-end">
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <Button
                className="hidden h-9 whitespace-nowrap px-3 text-xs lg:inline-flex sm:text-sm"
                onClick={() => navigate("/analytics")}
                variant="outline"
              >
                <Download className="h-4 w-4" />
                {copy.reportButton}
              </Button>
              <Button
                className="hidden h-9 whitespace-nowrap px-3 text-xs lg:inline-flex sm:text-sm"
                onClick={() => navigate("/transactions")}
              >
                <Plus className="h-4 w-4" />
                {copy.addTransaction}
              </Button>
            </div>

            <div className="grid gap-2 rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-2 sm:grid-cols-2">
              <Select
                className="w-full sm:min-w-[9rem]"
                onChange={(event) =>
                  setSelectedPeriod(event.target.value as PeriodFilter)
                }
                value={selectedPeriod}
              >
                <option value="3m">{copy.periods["3m"]}</option>
                <option value="6m">{copy.periods["6m"]}</option>
                <option value="12m">{copy.periods["12m"]}</option>
              </Select>

              <Select
                className="w-full sm:min-w-[11rem]"
                onChange={(event) => setSelectedWallet(event.target.value)}
                value={selectedWallet}
              >
                <option value="all">{copy.allWallets}</option>
                {wallets.map((wallet) => (
                  <option key={wallet._id} value={wallet._id}>
                    {wallet.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
        description={copy.headerDescription}
        hideActionsOnMobile
        hideDescriptionOnMobile
        hideTitleOnMobile
        title={copy.headerTitle}
      />

      <div className="hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          description={
            selectedWallet === "all"
              ? copy.allWalletsActive(wallets.length)
              : copy.activeWalletFocus(
                  selectedWalletItem?.name || copy.unknownWallet,
                )
          }
          icon={Wallet}
          iconClassName="bg-primary-soft text-primary"
          title={copy.myBalance}
          value={formatCurrency(
            dashboardBalance,
            selectedWalletItem?.currency || "VND",
            {
              displayMode: "full",
            },
          )}
        />
        <DashboardStatCard
          description={formatDeltaText(totalIncome, previousIncome)}
          icon={ArrowDownRight}
          iconClassName={cn(
            "bg-emerald-500/10",
            getDeltaTone(totalIncome, previousIncome),
          )}
          title={copy.income}
          value={formatCurrency(totalIncome)}
        />
        <DashboardStatCard
          description={formatDeltaText(totalExpense, previousExpense)}
          icon={ArrowUpRight}
          iconClassName={cn(
            "bg-rose-500/10",
            getDeltaTone(totalExpense, previousExpense, "inverse"),
          )}
          title={copy.monthExpense}
          value={formatCurrency(totalExpense)}
        />
        <DashboardStatCard
          description={
            netProfit >= 0
              ? copy.savingsRate(Math.max(savingsRate, 0))
              : formatDeltaText(netProfit, previousNetProfit)
          }
          icon={TrendingUp}
          iconClassName={
            netProfit >= 0
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-rose-500/10 text-rose-600"
          }
          title={copy.netProfit}
          value={formatCurrency(netProfit)}
        />
      </div>

      {/* chart */}
      <div
        className="overflow-hidden rounded-[calc(var(--app-radius-xl)+4px)] border border-white/70 p-4 shadow-soft lg:hidden dark:border-white/10"
        style={{ backgroundImage: themedSurfaceGradient }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {isVietnamese ? "Tuần này" : "This week"}
            </p>
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <p className="text-[1.55rem] font-semibold leading-none tracking-tight text-foreground">
                {formatCurrency(currentWeekExpense)}
              </p>
              {weeklyExpenseChangeLabel ? (
                <span
                  className={cn(
                    "text-xs font-semibold",
                    weeklyExpenseChange >= 0
                      ? "text-emerald-600"
                      : "text-rose-600",
                  )}
                >
                  {weeklyExpenseChangeLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-w-[92px]">
            <p className="mb-1 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {isVietnamese ? "Tháng này" : "This month"}
            </p>
            <svg
              aria-hidden="true"
              className="h-10 w-24"
              preserveAspectRatio="none"
              viewBox="0 0 100 44"
            >
              <path
                d={mobileSparklinePath}
                fill="none"
                stroke={appearance.primaryColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
            </svg>
          </div>
        </div>

        <div className="mt-5 grid h-24 grid-cols-7 items-end gap-2">
          {weeklyExpenseBuckets.map((item, index) => {
            const height = Math.max((item.value / mobileWeekMaxExpense) * 100, 16);
            const isToday = currentWeekStart.add(index, "day").isSame(dayjs(), "day");

            return (
              <div key={item.label} className="flex h-full flex-col justify-end gap-2">
                <div
                  className="rounded-t-[var(--app-radius-md)] rounded-b-sm"
                  style={{
                    height: `${height}%`,
                    background: isToday
                      ? themedActionGradient
                      : hexToRgba(themeColors.secondary, 0.58),
                  }}
                />
                <span
                  className={cn(
                    "text-center text-[10px] font-medium",
                    isToday ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden gap-4 sm:gap-6 lg:grid xl:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>{copy.income}</CardTitle>
              <CardDescription>
                {copy.incomeChartDesc(periodLabel)}
              </CardDescription>
            </div>
            <Badge variant="outline">{periodLabel}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-36 lg:h-[18rem]">
              <LineChart
                data={incomeChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { color: tickColor },
                    },
                    y: {
                      grid: { color: gridColor },
                      ticks: {
                        color: tickColor,
                        callback: axisTick,
                      },
                    },
                  },
                }}
              />
            </div>

          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>{copy.monthExpense}</CardTitle>
              <CardDescription>{copy.expenseChartDesc}</CardDescription>
            </div>
            <Badge variant="outline">{copy.monthExpense}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-36 lg:h-[18rem]">
              <BarChart
                data={expenseChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { color: tickColor },
                    },
                    y: {
                      grid: { color: gridColor },
                      ticks: {
                        color: tickColor,
                        callback: axisTick,
                      },
                    },
                  },
                }}
              />
            </div>

          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>{copy.summary}</CardTitle>
              <CardDescription>{copy.summaryChartDesc}</CardDescription>
            </div>
            <Badge variant="outline">{copy.summary}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {expenseCategories.length > 0 ? (
              <>
                <div className="h-36 lg:h-[18rem]">
                  <PieChart
                    data={summaryChartData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: {
                        legend: sharedLegend,
                      },
                    }}
                  />
                </div>

                <div className="space-y-3">
                  {expenseCategories.map((category) => (
                    <div
                      key={category.name}
                      className="flex items-center justify-between rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: category.color,
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {category.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {category.percent.toFixed(0)}%
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(category.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex min-h-36 items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-6 text-center text-sm text-muted-foreground lg:min-h-[18rem]">
                {copy.noExpenseData}
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <div
          className="min-w-0 xl:min-h-0"
          style={
            transactionPanelHeight
              ? { height: `${transactionPanelHeight}px` }
              : undefined
          }
        >
          {/* section transaction */}
          <Card className="overflow-hidden xl:flex xl:h-full xl:flex-col">
            <CardHeader className="flex flex-col gap-3 border-b border-border/70 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle>{copy.transactionsTitle}</CardTitle>
                <CardDescription>{copy.transactionsDesc}</CardDescription>
              </div>

              <div className="hidden flex-wrap items-center gap-1.5 md:flex">
                {(["ALL", "INCOME", "EXPENSE"] as const).map((type) => (
                  <Button
                    className="h-8 whitespace-nowrap rounded-full px-2.5 text-xs"
                    key={type}
                    onClick={() => setTransactionFilter(type)}
                    size="sm"
                    variant={transactionFilter === type ? "default" : "outline"}
                  >
                    {type === "ALL"
                      ? copy.all
                      : type === "INCOME"
                        ? copy.income
                        : copy.expense}
                  </Button>
                ))}
                <Button
                  className="h-8 whitespace-nowrap rounded-full px-2.5 text-xs"
                  onClick={() => navigate("/transactions")}
                  size="sm"
                  variant="outline"
                >
                  {copy.openTransactions}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-2.5 pt-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              {recentTransactions.length > 0 ? (
                recentTransactions.slice(0, 10).map((transaction) => {
                  const isIncome = transaction.type === "INCOME";
                  const isExpense = transaction.type === "EXPENSE";
                  const transactionStatus = getTransactionStatus(transaction);
                  const transactionLabel =
                    transaction.note ||
                    transaction.category ||
                    copy.genericCategory;
                  const categoryMeta = getCategoryMeta(transaction.category);
                  const Icon = categoryMeta.icon;
                  const walletName =
                    getWalletName(transaction.walletId, copy.unknownWallet) ||
                    selectedWalletItem?.name ||
                    copy.unknownWallet;

                  return (
                    <div
                      key={transaction._id}
                      className="flex items-start justify-between gap-2.5 rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 px-3 py-2.5"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <div
                          className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--app-radius-md)-5px)]",
                            categoryMeta.tone,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[13px] font-semibold text-foreground sm:text-sm">
                              {transactionLabel}
                            </p>
                            <Badge
                              className="h-5 rounded-full px-1.5 text-[10px]"
                              variant={
                                isIncome
                                  ? "success"
                                  : isExpense
                                    ? "danger"
                                    : "outline"
                              }
                            >
                              {isIncome
                                ? copy.transactionLabels.INCOME
                                : isExpense
                                  ? copy.transactionLabels.EXPENSE
                                  : copy.transactionLabels.OTHER}
                            </Badge>
                            {transactionStatus !== "COMPLETED" ? (
                              <Badge variant="outline">
                                {transactionStatusText[transactionStatus][
                                  isVietnamese ? "vi" : "en"
                                ]}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="hidden">
                            {walletName} • {transaction.category || copy.genericCategory}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {walletName} • {transaction.category || copy.genericCategory} •{" "}
                            {formatDate(transaction.date)}
                          </p>
                        </div>
                      </div>

                      <div className="ml-1.5 flex shrink-0 flex-col items-end gap-1">
                        <p
                          className={cn(
                            "text-[13px] font-semibold sm:text-sm",
                            isIncome
                              ? "text-emerald-600"
                              : isExpense
                                ? "text-rose-600"
                                : "text-primary",
                          )}
                        >
                          {isIncome ? "+" : isExpense ? "-" : ""}
                          {formatCurrency(parseAmount(transaction.amount))}
                        </p>
                        <Button
                          className="h-7 w-7 rounded-full"
                          onClick={() => setPendingDelete(transaction)}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
              <div className="flex min-h-[200px] items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-4 text-center text-sm text-muted-foreground sm:min-h-[240px] sm:px-6">
                  {copy.noTransactions}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-6" ref={rightColumnRef}>
          {/* section saving */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-4 border-b border-border/70 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle>{copy.savingGoalTitle}</CardTitle>
                <CardDescription>{copy.savingGoalDesc}</CardDescription>
              </div>

              <Button
                onClick={() => navigate("/goals")}
                size="sm"
                variant="outline"
              >
                {copy.openGoals}
              </Button>
            </CardHeader>

            <CardContent className="pt-4 sm:pt-6">
              {goalSummary.featuredGoal ? (
                <div className="rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-4 sm:p-5 md:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">
                          {goalSummary.featuredGoal.title}
                        </p>
                        <Badge variant="outline">
                          {copy.goalStatuses[goalSummary.featuredGoal.status]}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {goalSummary.featuredGoal.category || copy.genericCategory}
                        {" - "}
                        {goalSummary.featuredGoal.deadline
                          ? `${copy.deadline}: ${formatDate(
                              goalSummary.featuredGoal.deadline,
                            )}`
                          : copy.noDeadline}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-3xl font-semibold tracking-tight text-foreground">
                        {formatCurrency(
                          parseAmount(goalSummary.featuredGoal.currentAmount),
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {copy.target}{" "}
                        {formatCurrency(
                          parseAmount(goalSummary.featuredGoal.targetAmount),
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      <span>{copy.progress}</span>
                      <span>
                        {goalSummary.featuredGoal.progress.toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      className="h-3"
                      indicatorClassName="bg-primary"
                      value={goalSummary.featuredGoal.progress}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[192px] flex-col items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-4 text-center sm:min-h-[220px] sm:px-6">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--app-radius-lg)] bg-primary-soft text-primary">
                    <Target className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {copy.noGoalsTitle}
                  </h3>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {copy.noGoalsDesc}
                  </p>
                  <Button className="mt-5" onClick={() => navigate("/goals")}>
                    {copy.openGoals}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* section wallet */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-4 border-b border-border/70 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle>{copy.myWalletTitle}</CardTitle>
                <CardDescription>{copy.myWalletDesc}</CardDescription>
              </div>

              <Button
                onClick={() => navigate("/wallets")}
                size="sm"
                variant="outline"
              >
                {copy.manageWallets}
              </Button>
            </CardHeader>

            <CardContent className="pt-4 sm:pt-6">
              {walletCards.length > 0 ? (
                <div className="flex flex-nowrap gap-2.5 overflow-x-auto overflow-y-hidden py-1 sm:gap-3">
                  {walletCards.map((wallet) => {
                    const normalizedType = normalizeText(wallet.type || "");
                    const walletTypeLabel = normalizedType.includes("bank")
                      ? copy.walletTypes.bank
                      : normalizedType.includes("ewallet")
                        ? copy.walletTypes.ewallet
                        : normalizedType.includes("cash")
                          ? copy.walletTypes.cash
                          : copy.walletTypes.other;
                    const walletBudgetSummary =
                      walletBudgetSummaryMap.get(wallet._id);
                    const reserveItems = (
                      walletBudgetSummary?.items || []
                    ).filter(
                      (item) =>
                        Number(item.remaining || 0) > 0 ||
                        Number(item.spent || 0) > 0,
                    );
                    const reservedAmount = reserveItems.reduce(
                      (sum, item) => sum + Number(item.remaining || 0),
                      0,
                    );
                    const freeAmount = Math.max(
                      parseAmount(wallet.balance) - reservedAmount,
                      0,
                    );
                    const allocationTotal = Math.max(
                      parseAmount(wallet.balance),
                      reservedAmount,
                      1,
                    );
                    const allocationSegments = [
                      ...(freeAmount > 0
                        ? [
                            {
                              key: `${wallet._id}-free`,
                              label: copy.freeToSpend,
                              amount: freeAmount,
                              color: appearance.primaryColor,
                            },
                          ]
                        : []),
                      ...reserveItems
                        .filter((item) => Number(item.remaining || 0) > 0)
                        .map((item, index) => ({
                          key: item._id,
                          label: item.category,
                          amount: Number(item.remaining || 0),
                          color: getBudgetColor(item, index),
                        })),
                    ];
                    const isExpanded = expandedWalletId === wallet._id;

                    return (
                      <div
                        key={wallet._id}
                        className="relative min-w-[236px] shrink-0 overflow-hidden rounded-[var(--app-radius-xl)] border border-white/12 bg-card shadow-sm sm:min-w-[286px]"
                      >
                        <div
                          className="flex w-[200%] transition-transform duration-300 ease-out"
                          style={{
                            transform: isExpanded
                              ? "translateX(-50%)"
                              : "translateX(0)",
                          }}
                        >
                          <div
                            className="relative min-h-[216px] w-1/2 shrink-0 overflow-hidden p-4 text-white sm:min-h-[238px] sm:p-5"
                            style={{
                              backgroundImage: wallet.background,
                              backgroundPosition: "center",
                              backgroundSize: "cover",
                            }}
                          >
                            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.36)_42%,rgba(2,6,23,0.88)_100%)]" />
                            <div className="relative z-10 flex h-full flex-col justify-between gap-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 space-y-1.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/72">
                                    {walletTypeLabel}
                                  </p>
                                  <h3 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                                    {wallet.name}
                                  </h3>
                                  {wallet.accountNumber ? (
                                    <p className="truncate text-xs text-white/68">
                                      {wallet.accountNumber}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[calc(var(--app-radius-md)-2px)] bg-white/14 backdrop-blur-sm sm:h-10 sm:w-10">
                                  {normalizedType.includes("bank") ? (
                                    <Landmark className="h-4 w-4 sm:h-5 sm:w-5" />
                                  ) : normalizedType.includes("ewallet") ? (
                                    <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                                  ) : (
                                    <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                                  )}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/68">
                                    {copy.availableBalance}
                                  </p>
                                  <p className="mt-1 text-[1.45rem] font-semibold tracking-tight sm:text-[1.8rem]">
                                    {formatCurrency(parseAmount(wallet.balance))}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between gap-3 border-t border-white/18 pt-3 text-xs text-white/78">
                                  <span>
                                    {copy.share}: {wallet.share.toFixed(0)}%
                                  </span>
                                  <button
                                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/16 bg-white/14 px-2.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                                    onClick={() => setExpandedWalletId(wallet._id)}
                                    type="button"
                                  >
                                    <ChartPie className="h-3.5 w-3.5" />
                                    {copy.allocation}
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="min-h-[216px] w-1/2 shrink-0 bg-card p-4 text-foreground sm:min-h-[238px] sm:p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  {copy.allocationDetails}
                                </p>
                                <h3 className="mt-1 truncate text-base font-semibold">
                                  {wallet.name}
                                </h3>
                              </div>
                              <button
                                className="h-8 rounded-full border border-border bg-background px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                onClick={() => setExpandedWalletId(null)}
                                type="button"
                              >
                                {copy.backToCard}
                              </button>
                            </div>

                            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
                              {allocationSegments.length > 0 ? (
                                allocationSegments.map((segment) => (
                                  <div
                                    key={segment.key}
                                    style={{
                                      backgroundColor: segment.color,
                                      width: `${(segment.amount / allocationTotal) * 100}%`,
                                    }}
                                  />
                                ))
                              ) : (
                                <div className="h-full w-full bg-muted-foreground/20" />
                              )}
                            </div>

                            <div className="mt-4 space-y-2.5">
                              <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-md)] bg-muted/35 px-3 py-2">
                                <span className="text-xs text-muted-foreground">
                                  {copy.freeToSpend}
                                </span>
                                <span className="text-sm font-semibold">
                                  {formatCurrency(freeAmount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-md)] bg-muted/35 px-3 py-2">
                                <span className="text-xs text-muted-foreground">
                                  {copy.budgetReserved}
                                </span>
                                <span className="text-sm font-semibold">
                                  {formatCurrency(reservedAmount)}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {reserveItems.length > 0 ? (
                                reserveItems
                                  .filter((item) => Number(item.remaining || 0) > 0)
                                  .slice(0, 3)
                                  .map((item, index) => (
                                    <span
                                      key={item._id}
                                      className="inline-flex max-w-full items-center truncate rounded-full px-2 py-1 text-[10px] font-medium"
                                      style={{
                                        backgroundColor: hexToRgba(
                                          getBudgetColor(item, index),
                                          0.14,
                                        ),
                                        color: getBudgetColor(item, index),
                                      }}
                                    >
                                      {item.category}
                                    </span>
                                  ))
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {copy.noBudgetReserve}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[192px] items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-4 text-center text-sm text-muted-foreground sm:min-h-[220px] sm:px-6">
                  {copy.noWallets}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        busy={deleting}
        cancelLabel={copy.keep}
        confirmLabel={copy.delete}
        description={
          pendingDelete
            ? copy.deleteTransactionDesc(
                pendingDelete.note ||
                  pendingDelete.category ||
                  copy.genericCategory,
              )
            : ""
        }
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleteTransaction}
        open={!!pendingDelete}
        title={copy.deleteTransaction}
        variant="destructive"
      />
    </div>
  );
};

export default Dashboard;
