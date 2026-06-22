import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { Briefcase, Car, HeartPulse, Home, ShoppingBag } from "lucide-react";
import { auth } from "lib/firebase/config";
import { budgetApi, goalApi, transactionApi, walletApi } from "services/api";
import { formatCurrency, formatDate } from "utils/formatters";
import { useAuth } from "contexts/AuthContext";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import {
  getAppearanceGradientColors,
  useTheme,
} from "contexts/ThemeContext";
import { hexToRgba } from "lib/utils";
import DashboardHeader from "../components/DashboardHeader";
import { Spinner } from "components/ui/spinner";
import { DeleteDashboardTransactionModal } from "../modals/DeleteDashboardTransactionModal";
const TransactionsPanel = lazy(
  () => import("../components/TransactionsPanel"),
);
const RightSidebar = lazy(() => import("../components/RightSidebar"));
const DashboardOverview = lazy(
  () => import("../components/DashboardOverview"),
);

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

const getTransactionStatus = (transaction: Pick<Transaction, "status">) =>
  transaction.status || "COMPLETED";

const isTransferTransaction = (
  transaction: Pick<Transaction, "category" | "transferGroupId">,
) =>
  transaction.category === "Transfer" || Boolean(transaction.transferGroupId);

const isCashflowTransaction = (transaction: Transaction) =>
  (transaction.type === "INCOME" || transaction.type === "EXPENSE") &&
  getTransactionStatus(transaction) === "COMPLETED" &&
  !isTransferTransaction(transaction);

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

  if (
    label.includes("an") ||
    label.includes("uong") ||
    label.includes("food")
  ) {
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
        savingGoalDesc: "Tiến độ mục tiêu đang ưu tiên trên dashboard",
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
    headerTitle: isVietnamese
      ? "Bảng điều khiển tài chính"
      : "Finance Dashboard",
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
        desktopQuery.removeEventListener(
          "change",
          updateTransactionPanelHeight,
        );
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
      .reduce(
        (total, transaction) => total + parseAmount(transaction.amount),
        0,
      );
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
  }, [copy.genericCategory, currentCashflowTransactions, totalExpense]);

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
        background: wallet.imageUrl
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
      budget.color ||
      BUDGET_SEGMENT_COLORS[index % BUDGET_SEGMENT_COLORS.length],
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
      <DashboardHeader
        copy={copy}
        navigate={navigate}
        wallets={wallets}
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
        selectedWallet={selectedWallet}
        setSelectedWallet={setSelectedWallet}
        isVietnamese={isVietnamese}
        netProfit={netProfit}
        themedActionGradient={themedActionGradient}
        themedSurfaceGradient={themedSurfaceGradient}
        appearance={appearance}
        dashboardBalance={dashboardBalance}
        selectedWalletItem={selectedWalletItem}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        goalSaved={goalSummary.totalSaved}
        formatCurrency={formatCurrency}
      />

      <Suspense
        fallback={
          <div className="flex min-h-[420px] items-center justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        }
      >
        <DashboardOverview
          selectedWallet={selectedWallet}
          selectedWalletItem={selectedWalletItem}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
          setSelectedWallet={setSelectedWallet}
          wallets={wallets}
          copy={copy}
          dashboardBalance={dashboardBalance}
          totalIncome={totalIncome}
          previousIncome={previousIncome}
          totalExpense={totalExpense}
          previousExpense={previousExpense}
          netProfit={netProfit}
          previousNetProfit={previousNetProfit}
          savingsRate={savingsRate}
          isVietnamese={isVietnamese}
          currentWeekExpense={currentWeekExpense}
          weeklyExpenseChangeLabel={weeklyExpenseChangeLabel}
          weeklyExpenseChange={weeklyExpenseChange}
          currentWeekStart={currentWeekStart}
          themedActionGradient={themedActionGradient}
          themedSurfaceGradient={themedSurfaceGradient}
          appearance={appearance}
          themeColors={themeColors}
          mobileSparklinePath={mobileSparklinePath}
          weeklyExpenseBuckets={weeklyExpenseBuckets}
          mobileWeekMaxExpense={mobileWeekMaxExpense}
          formatCurrency={formatCurrency}
          formatDeltaText={formatDeltaText}
          getDeltaTone={getDeltaTone}
          incomeChartData={incomeChartData}
          expenseChartData={expenseChartData}
          summaryChartData={summaryChartData}
          expenseCategories={expenseCategories}
          sharedLegend={sharedLegend}
          tickColor={tickColor}
          gridColor={gridColor}
          axisTick={axisTick}
          periodLabel={periodLabel}
        />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <div
          className="min-w-0 xl:min-h-0"
          style={
            transactionPanelHeight
              ? { height: `${transactionPanelHeight}px` }
              : undefined
          }
        >
          <Suspense
            fallback={
              <div className="flex min-h-[420px] items-center justify-center">
                <Spinner className="h-8 w-8" />
              </div>
            }
          >
            <TransactionsPanel
              recentTransactions={recentTransactions}
              transactionFilter={transactionFilter}
              setTransactionFilter={setTransactionFilter}
              copy={copy}
              getTransactionStatus={getTransactionStatus}
              getCategoryMeta={getCategoryMeta}
              formatDate={formatDate}
              parseAmount={parseAmount}
              formatCurrency={formatCurrency}
              setPendingDelete={setPendingDelete}
              navigate={navigate}
              selectedWalletItem={selectedWalletItem}
              isVietnamese={isVietnamese}
            />
          </Suspense>
        </div>

        <Suspense
          fallback={
            <div className="flex min-h-[420px] items-center justify-center">
              <Spinner className="h-8 w-8" />
            </div>
          }
        >
          <RightSidebar
            ref={rightColumnRef}
            copy={copy}
            goalSummary={goalSummary}
            walletCards={walletCards}
            walletBudgetSummaryMap={walletBudgetSummaryMap}
            navigate={navigate}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            parseAmount={parseAmount}
            getBudgetColor={getBudgetColor}
            normalizeText={normalizeText}
            appearance={appearance}
            themeColors={themeColors}
          />
        </Suspense>
      </div>

      <DeleteDashboardTransactionModal
        copy={{
          delete: copy.delete,
          deleteTransaction: copy.deleteTransaction,
          deleteTransactionDesc: copy.deleteTransactionDesc,
          genericCategory: copy.genericCategory,
          keep: copy.keep,
        }}
        deleting={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleteTransaction}
        transaction={pendingDelete}
      />
    </div>
  );
};

export default Dashboard;
