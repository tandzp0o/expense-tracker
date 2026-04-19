import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Car,
  CreditCard,
  Download,
  HeartPulse,
  Home,
  Landmark,
    Plus,
  ShoppingBag,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { auth } from "../firebase/config";
import { goalApi, transactionApi, walletApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import { useTheme } from "../contexts/ThemeContext";
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
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Progress } from "../components/ui/progress";
import { Select } from "../components/ui/select";
import BarChart from "../components/charts/BarChart";
import LineChart from "../components/charts/LineChart";
import PieChart from "../components/charts/PieChart";

interface Transaction {
  _id: string;
  type: string;
  amount: number | string;
  category: string;
  date: string;
  note?: string;
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

const WALLET_GRADIENTS = [
  "linear-gradient(135deg, #10b981 0%, #047857 100%)",
  "linear-gradient(135deg, #38bdf8 0%, #1d4ed8 100%)",
  "linear-gradient(135deg, #8b5cf6 0%, #4338ca 100%)",
  "linear-gradient(135deg, #fb923c 0%, #e11d48 100%)",
];

const PIE_FALLBACK_COLORS = [
  "#2563eb",
  "#0f172a",
  "#f97316",
  "#0f766e",
  "#7c3aed",
  "#16a34a",
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

const isCashflowTransaction = (transaction: Transaction) =>
  transaction.type === "INCOME" || transaction.type === "EXPENSE";

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
      tone: "bg-amber-500/10 text-amber-600",
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

const DashboardStatCard: React.FC<{
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}> = ({ title, value, description, icon: Icon, iconClassName }) => (
  <Card className="overflow-hidden border-border/70 bg-card/95">
    <CardContent className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {title}
          </p>
          <div className="space-y-2">
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-[var(--app-radius-md)] bg-muted text-foreground",
            iconClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isVietnamese } = useLocale();
  const { toast } = useToast();
  const { appearance } = useTheme();
  const locale = isVietnamese ? "vi-VN" : "en-US";
  const dayjsLocale = isVietnamese ? "vi" : "en";
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("6m");
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [transactionFilter, setTransactionFilter] =
    useState<TransactionFilter>("ALL");
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);
  const [transactionPanelHeight, setTransactionPanelHeight] = useState<
    number | null
  >(null);

  const copy = isVietnamese
      ? {
          headerTitle: "Bảng điều khiển tài chính",
          headerDescription:
            "Header gom tieu de, mo ta, cac nut thao tac va bo loc. Tat ca cards, charts va cac section ben duoi deu di theo ky xem va vi dang chon.",
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
    setLoading(true);
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        return;
      }

      const token = await firebaseUser.getIdToken();
      const startDate = dayjs()
        .subtract(23, "month")
        .startOf("month")
        .toISOString();
      const endDate = dayjs().endOf("month").toISOString();

      const [walletsRes, transactionRes, goalsRes] = await Promise.all([
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
      ]);

      setWallets(walletsRes?.wallets || []);
      setTransactions(transactionRes?.data?.transactions || []);
      setGoals(Array.isArray(goalsRes) ? goalsRes : goalsRes?.data || []);
    } catch (error: any) {
      toast({
        title: copy.loadFailed,
        description: error?.message || copy.loadFailedDesc,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed, copy.loadFailedDesc, toast]);

  useEffect(() => {
    dayjs.locale(dayjsLocale);
  }, [dayjsLocale]);

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
        color:
          index === 0
            ? appearance.primaryColor
            : PIE_FALLBACK_COLORS[index % PIE_FALLBACK_COLORS.length],
      }));
  }, [
    appearance.primaryColor,
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
          wallet.color && wallet.color.startsWith("#")
            ? `linear-gradient(135deg, ${wallet.color} 0%, ${hexToRgba(
                wallet.color,
                0.72,
              )} 100%)`
            : WALLET_GRADIENTS[index % WALLET_GRADIENTS.length],
      })),
    [allWalletBalance, wallets],
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
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-row-reverse gap-3 lg:items-end">
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate("/analytics")} variant="outline">
                <Download className="h-4 w-4" />
                {copy.reportButton}
              </Button>
              <Button onClick={() => navigate("/transactions")}>
                <Plus className="h-4 w-4" />
                {copy.addTransaction}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-2">
              <Select
                className="min-w-[9rem]"
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
                className="min-w-[11rem]"
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
        title={copy.headerTitle}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          value={formatCurrency(dashboardBalance)}
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
      <div className="grid gap-6 xl:grid-cols-3">
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
            <div className="h-[18rem]">
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

            <div className="rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">
                {copy.totalIncome}
              </p>
              <p className="mt-2 text-lg font-semibold text-emerald-600">
                {formatCurrency(totalIncome)}
              </p>
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
            <div className="h-[18rem]">
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

            <div className="rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">
                {copy.totalExpense}
              </p>
              <p className="mt-2 text-lg font-semibold text-rose-600">
                {formatCurrency(totalExpense)}
              </p>
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
                <div className="h-[18rem]">
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
              <div className="flex min-h-[18rem] items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-6 text-center text-sm text-muted-foreground">
                {copy.noExpenseData}
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
            <CardHeader className="flex flex-col gap-4 border-b border-border/70 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle>{copy.transactionsTitle}</CardTitle>
                <CardDescription>{copy.transactionsDesc}</CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(["ALL", "INCOME", "EXPENSE"] as const).map((type) => (
                  <Button
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
                  onClick={() => navigate("/transactions")}
                  size="sm"
                  variant="outline"
                >
                  {copy.openTransactions}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              {recentTransactions.length > 0 ? (
                recentTransactions.slice(0, 8).map((transaction) => {
                  const isIncome = transaction.type === "INCOME";
                  const isExpense = transaction.type === "EXPENSE";
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
                      className="grid gap-4 rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-4 lg:grid-cols-[minmax(0,1.8fr)_auto_auto_auto] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--app-radius-md)]",
                              categoryMeta.tone,
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {transactionLabel}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {walletName} -{" "}
                              {transaction.category || copy.genericCategory}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(transaction.date)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center lg:justify-center">
                        <Badge
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
                      </div>

                      <div className="text-left lg:text-right">
                        <p
                          className={cn(
                            "font-semibold",
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
                      </div>

                      <div className="flex items-center justify-end">
                        <Button
                          onClick={() => setPendingDelete(transaction)}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex min-h-[240px] items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-6 text-center text-sm text-muted-foreground">
                  {copy.noTransactions}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6" ref={rightColumnRef}>
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

            <CardContent className="pt-6">
              {goalSummary.featuredGoal ? (
                <div className="rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-5 md:p-6">
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

                  <div className="mt-5 space-y-2">
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
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-6 text-center">
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

            <CardContent className="pt-6">
              {walletCards.length > 0 ? (
                <div className="flex flex-nowrap gap-4 overflow-x-auto overflow-y-hidden py-2">
                  {walletCards.map((wallet) => {
                    const normalizedType = normalizeText(wallet.type || "");
                    const walletTypeLabel = normalizedType.includes("bank")
                      ? copy.walletTypes.bank
                      : normalizedType.includes("ewallet")
                        ? copy.walletTypes.ewallet
                        : normalizedType.includes("cash")
                          ? copy.walletTypes.cash
                          : copy.walletTypes.other;

                    return (
                      <div
                        key={wallet._id}
                        className="relative min-w-[280px] shrink-0 overflow-hidden rounded-[var(--app-radius-xl)] p-6 text-white shadow-sm sm:min-w-[320px]"
                        style={{
                          backgroundImage: wallet.background,
                        }}
                      >
                        <div className="pointer-events-none absolute inset-0">
                          <div className="absolute right-0 top-0 h-36 w-36 translate-x-10 -translate-y-10 rounded-full bg-white/10" />
                          <div className="absolute bottom-0 left-0 h-28 w-28 -translate-x-8 translate-y-8 rounded-full bg-white/10" />
                        </div>

                        <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-white/75">
                                {walletTypeLabel}
                              </p>
                              <h3 className="text-2xl font-semibold tracking-tight">
                                {wallet.name}
                              </h3>
                            </div>

                            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--app-radius-md)] bg-white/12">
                              {normalizedType.includes("bank") ? (
                                <Landmark className="h-5 w-5" />
                              ) : normalizedType.includes("ewallet") ? (
                                <CreditCard className="h-5 w-5" />
                              ) : (
                                <Wallet className="h-5 w-5" />
                              )}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-white/70">
                                {copy.availableBalance}
                              </p>
                              <p className="mt-2 text-3xl font-semibold tracking-tight">
                                {formatCurrency(parseAmount(wallet.balance))}
                              </p>
                            </div>

                            <div className="flex items-center justify-between text-sm text-white/80">
                              <span>{copy.share}</span>
                              <span>{wallet.share.toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>

                        {selectedWallet === wallet._id ? (
                          <span className="absolute right-4 top-4 rounded-full bg-white/14 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white">
                            {copy.active}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-6 text-center text-sm text-muted-foreground">
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
