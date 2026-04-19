import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
    ArrowDownRight,
    ArrowUpRight,
    Landmark,
    Target,
    Trash2,
    WalletCards,
} from "lucide-react";
import { auth } from "../firebase/config";
import { goalApi, transactionApi, userApi, walletApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import { useTheme } from "../contexts/ThemeContext";
import { cn, hexToRgba } from "../lib/utils";
import { PageHeader } from "../components/app/page-header";
import { MetricCard } from "../components/app/metric-card";
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
import BarChart from "../components/charts/BarChart";
import LineChart from "../components/charts/LineChart";
import PieChart from "../components/charts/PieChart";

interface Transaction {
    _id: string;
    type: "INCOME" | "EXPENSE";
    amount: number | string;
    category: string;
    date: string;
    note?: string;
}

interface Wallet {
    _id: string;
    name: string;
    balance: number;
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

interface ProfileStats {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpense: number;
    growth: number;
    incomeGrowth?: number;
    expenseGrowth?: number;
    history: Array<{
        month: string;
        balance: number;
        income: number;
        expense: number;
    }>;
}

interface MonthlyPoint {
    key: string;
    label: string;
    income: number;
    expense: number;
    balance: number;
}

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

const toFiniteNumber = (value: unknown, fallback: number = 0) => {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : fallback;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

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

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { isVietnamese } = useLocale();
    const { toast } = useToast();
    const { appearance } = useTheme();
    const locale = isVietnamese ? "vi-VN" : "en-US";
    const dayjsLocale = isVietnamese ? "vi" : "en";
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [goals, setGoals] = useState<GoalItem[]>([]);
    const [stats, setStats] = useState<ProfileStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<"ALL" | "INCOME" | "EXPENSE">(
        "ALL",
    );
    const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
    const [deleting, setDeleting] = useState(false);

    const copy = isVietnamese
        ? {
              addTransaction: "Thêm giao dịch",
              openGoals: "Mở mục tiêu",
              title: "Tổng quan tài chính",
              description:
                  "Bảng điều khiển dùng dữ liệu thật từ ví, giao dịch, thống kê hồ sơ và mục tiêu để hiển thị đúng chức năng hệ thống.",
              totalBalance: "Tổng số dư",
              monthlyIncome: "Thu nhập tháng này",
              monthlyExpense: "Chi tiêu tháng này",
              vsPreviousMonth: "so với tháng trước",
              incomeExpenseTitle: "Thu nhập và chi tiêu",
              incomeExpenseDesc:
                  "Biểu đồ cột 6 tháng gần nhất từ transactions API và profile stats API.",
              balanceTitle: "Xu hướng số dư",
              balanceDesc:
                  "Biểu đồ line dùng lịch sử số dư để theo dõi biến động tài sản.",
              categoryMixTitle: "Cơ cấu danh mục chi",
              categoryMixDesc:
                  "Biểu đồ tròn tổng hợp các khoản chi trong 6 tháng gần nhất.",
              recentTransactions: "Giao dịch gần đây",
              recentTransactionsDesc:
                  "Danh sách đang lấy từ transactions API, giữ nguyên thao tác xoá giao dịch.",
              goalsTitle: "Mục tiêu đang theo dõi",
              goalsDesc:
                  "Tiến độ mục tiêu lấy từ goal API để hiển thị đúng số tiền đã tích luỹ.",
              walletsLabel: "Ví đang hoạt động",
              transactionCountLabel: "Giao dịch đã tải",
              completedGoalsLabel: "Mục tiêu hoàn thành",
              activeGoalsLabel: "Mục tiêu đang chạy",
              savedAmountLabel: "Đã tích luỹ",
              targetAmountLabel: "Mục tiêu",
              noDeadline: "Chưa đặt hạn",
              deadline: "Hạn",
              otherCategory: "Khác",
              noExpenseData: "Chưa có chi tiêu",
              all: "Tất cả",
              income: "Thu",
              expense: "Chi",
              viewTransactions: "Mở giao dịch",
              viewGoals: "Xem tất cả mục tiêu",
              noTransactions: "Chưa có giao dịch",
              noTransactionsDesc:
                  "Không có giao dịch phù hợp bộ lọc hiện tại trong khoảng thời gian đang tải.",
              noGoals: "Chưa có mục tiêu",
              noGoalsDesc:
                  "Thêm mục tiêu để theo dõi tiến độ tiết kiệm và hiển thị phần goal trên dashboard.",
              untitledTransaction: "Giao dịch chưa đặt tên",
              deleteTransaction: "Xoá giao dịch",
              deleteTransactionDesc: (label: string) =>
                  `Xoá "${label}" khỏi danh sách giao dịch gần đây?`,
              keep: "Giữ lại",
              delete: "Xoá",
              generalCategory: "Tổng quát",
              goalStatuses: {
                  active: "Đang thực hiện",
                  completed: "Hoàn thành",
                  expired: "Hết hạn",
              },
          }
        : {
              addTransaction: "Add transaction",
              openGoals: "Open goals",
              title: "Financial dashboard",
              description:
                  "This dashboard renders real wallets, transactions, profile stats and goals so the UI stays aligned with the current backend data.",
              totalBalance: "Total balance",
              monthlyIncome: "Monthly income",
              monthlyExpense: "Monthly expense",
              vsPreviousMonth: "vs previous month",
              incomeExpenseTitle: "Income and expenses",
              incomeExpenseDesc:
                  "Six-month bar chart based on the transactions API and profile stats API.",
              balanceTitle: "Balance trend",
              balanceDesc:
                  "Line chart showing the balance history behind the current asset movement.",
              categoryMixTitle: "Expense category mix",
              categoryMixDesc:
                  "Pie chart aggregating expense categories from the last six months.",
              recentTransactions: "Recent transactions",
              recentTransactionsDesc:
                  "Loaded from the transactions API and keeps the existing delete flow.",
              goalsTitle: "Tracked goals",
              goalsDesc:
                  "Goal progress is sourced from the goals API so saved amounts stay accurate.",
              walletsLabel: "Active wallets",
              transactionCountLabel: "Loaded transactions",
              completedGoalsLabel: "Completed goals",
              activeGoalsLabel: "Active goals",
              savedAmountLabel: "Saved",
              targetAmountLabel: "Target",
              noDeadline: "No deadline",
              deadline: "Deadline",
              otherCategory: "Other",
              noExpenseData: "No expense data",
              all: "All",
              income: "Income",
              expense: "Expense",
              viewTransactions: "Open transactions",
              viewGoals: "View all goals",
              noTransactions: "No transactions found",
              noTransactionsDesc:
                  "No transaction matches the current filter for the loaded period.",
              noGoals: "No goals yet",
              noGoalsDesc:
                  "Create a goal to surface savings progress and goal tracking on the dashboard.",
              untitledTransaction: "Untitled transaction",
              deleteTransaction: "Delete transaction",
              deleteTransactionDesc: (label: string) =>
                  `Remove "${label}" from the recent transaction list?`,
              keep: "Keep",
              delete: "Delete",
              generalCategory: "General",
              goalStatuses: {
                  active: "Active",
                  completed: "Completed",
                  expired: "Expired",
              },
          };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const firebaseUser = auth.currentUser;
            if (!firebaseUser) {
                return;
            }

            const token = await firebaseUser.getIdToken();
            const now = dayjs();
            const startDate = now.subtract(5, "month").startOf("month").toISOString();
            const endDate = now.endOf("day").toISOString();

            const [walletsRes, transactionRes, statsRes, goalsRes] =
                await Promise.all([
                    walletApi.getWallets(token),
                    transactionApi.getTransactions(
                        { startDate, endDate, limit: 200, page: 1 },
                        token,
                    ),
                    userApi.getProfileStats(token),
                    goalApi.getGoals(token),
                ]);

            setWallets(walletsRes?.wallets || []);
            setTransactions(transactionRes?.data?.transactions || []);
            setStats((statsRes?.data || statsRes) ?? null);
            setGoals(Array.isArray(goalsRes) ? goalsRes : []);
        } catch (error: any) {
            toast({
                title: isVietnamese
                    ? "Không thể tải dashboard"
                    : "Could not load dashboard",
                description:
                    error.message ||
                    (isVietnamese
                        ? "Vui lòng thử lại sau ít phút."
                        : "Please retry in a moment."),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [isVietnamese, toast]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const handleDeleteTransaction = async () => {
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
                title: isVietnamese ? "Đã xoá giao dịch" : "Transaction deleted",
                variant: "success",
            });
            setPendingDelete(null);
            await fetchData();
        } catch (error: any) {
            toast({
                title: isVietnamese ? "Xoá thất bại" : "Delete failed",
                description:
                    error.message ||
                    (isVietnamese
                        ? "Không thể xoá giao dịch."
                        : "Transaction could not be removed."),
                variant: "destructive",
            });
        } finally {
            setDeleting(false);
        }
    };

    const filteredTransactions = useMemo(() => {
        if (filterType === "ALL") {
            return transactions;
        }
        return transactions.filter((transaction) => transaction.type === filterType);
    }, [filterType, transactions]);

    const totalBalance = useMemo(
        () => wallets.reduce((sum, wallet) => sum + toFiniteNumber(wallet.balance), 0),
        [wallets],
    );

    const monthlyIncome = useMemo(() => {
        const start = dayjs().startOf("month");
        return transactions
            .filter(
                (transaction) =>
                    transaction.type === "INCOME" &&
                    !dayjs(transaction.date).isBefore(start),
            )
            .reduce((sum, transaction) => sum + parseAmount(transaction.amount), 0);
    }, [transactions]);

    const monthlyExpense = useMemo(() => {
        const start = dayjs().startOf("month");
        return transactions
            .filter(
                (transaction) =>
                    transaction.type === "EXPENSE" &&
                    !dayjs(transaction.date).isBefore(start),
            )
            .reduce((sum, transaction) => sum + parseAmount(transaction.amount), 0);
    }, [transactions]);

    // Normalize six-month history so charts and cards stay aligned even when one API
    // returns fewer points than the others.
    const historyPoints = useMemo<MonthlyPoint[]>(() => {
        const months = Array.from({ length: 6 }, (_, index) => {
            const month = dayjs().locale(dayjsLocale).subtract(5 - index, "month");
            return {
                key: month.startOf("month").format("YYYY-MM"),
                label: isVietnamese ? `Th ${month.month() + 1}` : month.format("MMM"),
                income: 0,
                expense: 0,
                balance: 0,
            };
        });

        const lookup = new Map<string, MonthlyPoint>(
            months.map((point) => [point.key, { ...point }]),
        );

        transactions.forEach((transaction) => {
            const key = dayjs(transaction.date).startOf("month").format("YYYY-MM");
            const point = lookup.get(key);
            if (!point) {
                return;
            }
            const amount = parseAmount(transaction.amount);
            if (transaction.type === "INCOME") {
                point.income += amount;
            }
            if (transaction.type === "EXPENSE") {
                point.expense += amount;
            }
        });

        const aggregated = months.map((point) => lookup.get(point.key) || point);
        const endingBalance = toFiniteNumber(stats?.totalBalance, totalBalance);
        const totalNet = aggregated.reduce(
            (sum, point) => sum + point.income - point.expense,
            0,
        );

        let runningBalance = endingBalance - totalNet;
        const fallbackHistory = aggregated.map((point) => {
            runningBalance += point.income - point.expense;
            return {
                ...point,
                balance: runningBalance,
            };
        });

        const statsHistory = Array.isArray(stats?.history)
            ? stats?.history?.slice(-6) || []
            : [];
        if (statsHistory.length === 0) {
            return fallbackHistory;
        }

        const offset = fallbackHistory.length - statsHistory.length;
        return fallbackHistory.map((point, index) => {
            const statPoint = statsHistory[index - offset];
            if (!statPoint) {
                return point;
            }

            return {
                ...point,
                label: statPoint.month || point.label,
                income: toFiniteNumber(statPoint.income, point.income),
                expense: toFiniteNumber(statPoint.expense, point.expense),
                balance: toFiniteNumber(statPoint.balance, point.balance),
            };
        });
    }, [dayjsLocale, isVietnamese, stats, totalBalance, transactions]);

    const goalItems = useMemo(() => {
        return goals.map((goal) => {
            const progress =
                goal.targetAmount > 0
                    ? Math.min(
                          Math.round((goal.currentAmount / goal.targetAmount) * 100),
                          100,
                      )
                    : 0;
            const completed = goal.status === "completed" || progress >= 100;
            return {
                ...goal,
                progress,
                completed,
            };
        });
    }, [goals]);

    const goalSummary = useMemo(() => {
        const completedCount = goalItems.filter((goal) => goal.completed).length;
        const activeCount = goalItems.filter(
            (goal) => !goal.completed && goal.status !== "expired",
        ).length;
        const totalSaved = goalItems.reduce(
            (sum, goal) => sum + toFiniteNumber(goal.currentAmount),
            0,
        );
        const totalTarget = goalItems.reduce(
            (sum, goal) => sum + toFiniteNumber(goal.targetAmount),
            0,
        );

        return {
            completedCount,
            activeCount,
            totalSaved,
            totalTarget,
        };
    }, [goalItems]);

    const featuredGoals = useMemo(() => {
        return [...goalItems]
            .sort((left, right) => {
                if (left.completed !== right.completed) {
                    return left.completed ? 1 : -1;
                }

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
            })
            .slice(0, 4);
    }, [goalItems]);

    const categoryMix = useMemo(() => {
        const totals = new Map<string, number>();

        transactions.forEach((transaction) => {
            if (transaction.type !== "EXPENSE") {
                return;
            }
            const category = transaction.category?.trim() || copy.otherCategory;
            totals.set(category, (totals.get(category) || 0) + parseAmount(transaction.amount));
        });

        const entries = Array.from(totals.entries()).sort(
            (left, right) => right[1] - left[1],
        );
        const compactEntries =
            entries.length > 5
                ? [
                      ...entries.slice(0, 4),
                      [
                          copy.otherCategory,
                          entries
                              .slice(4)
                              .reduce((sum, current) => sum + current[1], 0),
                      ] as [string, number],
                  ]
                : entries;

        return compactEntries.length > 0
            ? compactEntries
            : [[copy.noExpenseData, 1] as [string, number]];
    }, [copy.noExpenseData, copy.otherCategory, transactions]);

    const numberFormatter = useMemo(
        () =>
            new Intl.NumberFormat(locale, {
                notation: "compact",
                maximumFractionDigits: 1,
            }),
        [locale],
    );

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

    const incomeExpenseChartData = useMemo(
        () => ({
            labels: historyPoints.map((point) => point.label),
            datasets: [
                {
                    label: copy.monthlyIncome,
                    data: historyPoints.map((point) => point.income),
                    backgroundColor: appearance.primaryColor,
                    borderRadius: chartRadius,
                    borderSkipped: false,
                    maxBarThickness: 18,
                },
                {
                    label: copy.monthlyExpense,
                    data: historyPoints.map((point) => point.expense),
                    backgroundColor: "rgba(244, 63, 94, 0.78)",
                    borderRadius: chartRadius,
                    borderSkipped: false,
                    maxBarThickness: 18,
                },
            ],
        }),
        [
            appearance.primaryColor,
            chartRadius,
            copy.monthlyExpense,
            copy.monthlyIncome,
            historyPoints,
        ],
    );

    const balanceChartData = useMemo(
        () => ({
            labels: historyPoints.map((point) => point.label),
            datasets: [
                {
                    label: copy.totalBalance,
                    data: historyPoints.map((point) => point.balance),
                    borderColor: appearance.primaryColor,
                    backgroundColor: hexToRgba(appearance.primaryColor, 0.14),
                    pointBackgroundColor: appearance.primaryColor,
                    pointRadius: 4,
                    pointHoverRadius: 5,
                    fill: true,
                    tension: 0.36,
                },
            ],
        }),
        [appearance.primaryColor, copy.totalBalance, historyPoints],
    );

    const categoryColors = useMemo(
        () => [
            appearance.primaryColor,
            "#0f766e",
            "#ea580c",
            "#7c3aed",
            "#16a34a",
            "#dc2626",
        ],
        [appearance.primaryColor],
    );

    const categoryChartData = useMemo(
        () => ({
            labels: categoryMix.map(([label]) => label),
            datasets: [
                {
                    data: categoryMix.map(([, total]) => total),
                    backgroundColor: categoryMix.map((_, index) =>
                        index === 0 && categoryMix[0][0] !== copy.noExpenseData
                            ? hexToRgba(categoryColors[index % categoryColors.length], 0.92)
                            : categoryMix[0][0] === copy.noExpenseData
                              ? "rgba(148, 163, 184, 0.35)"
                              : categoryColors[index % categoryColors.length],
                    ),
                    borderWidth: 0,
                    hoverOffset: 10,
                },
            ],
        }),
        [categoryColors, categoryMix, copy.noExpenseData],
    );

    const axisTick = (value: number | string) =>
        numberFormatter.format(Number(value) || 0);

    const stackedCardClass =
        "rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-4";

    const formatGrowth = (value: number) => {
        const safeValue = Number.isFinite(value) ? value : 0;
        const prefix = safeValue > 0 ? "+" : "";
        return `${prefix}${safeValue}% ${copy.vsPreviousMonth}`;
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
                    <>
                        <Button onClick={() => navigate("/goals")} variant="outline">
                            {copy.openGoals}
                        </Button>
                        <Button onClick={() => navigate("/transactions")}>
                            {copy.addTransaction}
                        </Button>
                    </>
                }
                description={copy.description}
                title={copy.title}
            />

            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                    icon={Landmark}
                    subtitle={formatGrowth(toFiniteNumber(stats?.growth))}
                    title={copy.totalBalance}
                    value={formatCurrency(toFiniteNumber(stats?.totalBalance, totalBalance))}
                />
                <MetricCard
                    icon={ArrowUpRight}
                    subtitle={formatGrowth(toFiniteNumber(stats?.incomeGrowth))}
                    title={copy.monthlyIncome}
                    value={formatCurrency(
                        toFiniteNumber(stats?.monthlyIncome, monthlyIncome),
                    )}
                />
                <MetricCard
                    icon={ArrowDownRight}
                    subtitle={formatGrowth(toFiniteNumber(stats?.expenseGrowth))}
                    title={copy.monthlyExpense}
                    value={formatCurrency(
                        toFiniteNumber(stats?.monthlyExpense, monthlyExpense),
                    )}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-12">
                <Card className="overflow-hidden xl:col-span-7">
                    <CardHeader>
                        <CardTitle>{copy.incomeExpenseTitle}</CardTitle>
                        <CardDescription>{copy.incomeExpenseDesc}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[320px]">
                            <BarChart
                                data={incomeExpenseChartData}
                                options={{
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: sharedLegend,
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

                <Card className="overflow-hidden xl:col-span-5">
                    <CardHeader>
                        <CardTitle>{copy.balanceTitle}</CardTitle>
                        <CardDescription>{copy.balanceDesc}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className={stackedCardClass}>
                                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                    {copy.walletsLabel}
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">
                                    {wallets.length}
                                </p>
                            </div>
                            <div className={stackedCardClass}>
                                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                    {copy.transactionCountLabel}
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">
                                    {transactions.length}
                                </p>
                            </div>
                            <div className={stackedCardClass}>
                                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                    {copy.completedGoalsLabel}
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">
                                    {goalSummary.completedCount}/{goals.length}
                                </p>
                            </div>
                        </div>

                        <div className="h-[262px]">
                            <LineChart
                                data={balanceChartData}
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

                <Card className="overflow-hidden xl:col-span-8">
                    <CardHeader className="flex flex-col gap-4 border-b border-border/70 md:flex-row md:items-start md:justify-between">
                        <div>
                            <CardTitle>{copy.recentTransactions}</CardTitle>
                            <CardDescription>
                                {copy.recentTransactionsDesc}
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(["ALL", "INCOME", "EXPENSE"] as const).map((type) => (
                                <Button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    size="sm"
                                    variant={filterType === type ? "default" : "outline"}
                                >
                                    {type === "ALL"
                                        ? copy.all
                                        : type === "INCOME"
                                          ? copy.income
                                          : copy.expense}
                                </Button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-6">
                        {filteredTransactions.length > 0 ? (
                            filteredTransactions.slice(0, 6).map((transaction) => {
                                const isIncome = transaction.type === "INCOME";
                                const label =
                                    transaction.note || copy.untitledTransaction;

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
                                                        isIncome
                                                            ? "bg-emerald-500/10 text-emerald-600"
                                                            : "bg-rose-500/10 text-rose-600",
                                                    )}
                                                >
                                                    {isIncome ? (
                                                        <ArrowUpRight className="h-4 w-4" />
                                                    ) : (
                                                        <ArrowDownRight className="h-4 w-4" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-foreground">
                                                        {label}
                                                    </p>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {transaction.category || copy.generalCategory}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {formatDate(transaction.date)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center lg:justify-center">
                                            <Badge
                                                variant={isIncome ? "success" : "danger"}
                                            >
                                                {isIncome ? copy.income : copy.expense}
                                            </Badge>
                                        </div>

                                        <div className="text-left lg:text-right">
                                            <p
                                                className={cn(
                                                    "font-semibold",
                                                    isIncome
                                                        ? "text-emerald-600"
                                                        : "text-rose-600",
                                                )}
                                            >
                                                {isIncome ? "+" : "-"}
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
                            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-6 py-10 text-center">
                                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[var(--app-radius-lg)] bg-primary-soft text-primary">
                                    <WalletCards className="h-6 w-6" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">
                                    {copy.noTransactions}
                                </h3>
                                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                    {copy.noTransactionsDesc}
                                </p>
                                <Button
                                    className="mt-5"
                                    onClick={() => navigate("/transactions")}
                                >
                                    {copy.viewTransactions}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6 xl:col-span-4">
                    <Card className="overflow-hidden">
                        <CardHeader>
                            <CardTitle>{copy.categoryMixTitle}</CardTitle>
                            <CardDescription>{copy.categoryMixDesc}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[288px]">
                                <PieChart
                                    data={categoryChartData}
                                    options={{
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: sharedLegend,
                                        },
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="overflow-hidden">
                        <CardHeader>
                            <CardTitle>{copy.goalsTitle}</CardTitle>
                            <CardDescription>{copy.goalsDesc}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className={stackedCardClass}>
                                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                        {copy.activeGoalsLabel}
                                    </p>
                                    <p className="mt-2 text-2xl font-semibold text-foreground">
                                        {goalSummary.activeCount}
                                    </p>
                                </div>
                                <div className={stackedCardClass}>
                                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                        {copy.savedAmountLabel}
                                    </p>
                                    <p className="mt-2 text-base font-semibold text-foreground">
                                        {formatCurrency(goalSummary.totalSaved)}
                                    </p>
                                </div>
                            </div>

                            {featuredGoals.length > 0 ? (
                                <>
                                    {featuredGoals.map((goal) => (
                                        <div
                                            key={goal._id}
                                            className="rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-foreground">
                                                        {goal.title}
                                                    </p>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {goal.category || copy.generalCategory}
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant={
                                                        goal.completed
                                                            ? "success"
                                                            : goal.status === "expired"
                                                              ? "danger"
                                                              : "outline"
                                                    }
                                                >
                                                    {
                                                        copy.goalStatuses[
                                                            goal.status as keyof typeof copy.goalStatuses
                                                        ]
                                                    }
                                                </Badge>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-muted-foreground">
                                                        {copy.savedAmountLabel}
                                                    </span>
                                                    <span className="font-medium text-foreground">
                                                        {formatCurrency(goal.currentAmount)}
                                                    </span>
                                                </div>
                                                <Progress className="h-2.5" value={goal.progress} />
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>
                                                        {copy.targetAmountLabel}:{" "}
                                                        {formatCurrency(goal.targetAmount)}
                                                    </span>
                                                    <span>{goal.progress}%</span>
                                                </div>
                                            </div>

                                            <p className="mt-3 text-xs text-muted-foreground">
                                                {goal.deadline
                                                    ? `${copy.deadline}: ${formatDate(goal.deadline)}`
                                                    : copy.noDeadline}
                                            </p>
                                        </div>
                                    ))}

                                    <Button
                                        className="w-full"
                                        onClick={() => navigate("/goals")}
                                        variant="outline"
                                    >
                                        {copy.viewGoals}
                                    </Button>
                                </>
                            ) : (
                                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-6 py-10 text-center">
                                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[var(--app-radius-lg)] bg-primary-soft text-primary">
                                        <Target className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground">
                                        {copy.noGoals}
                                    </h3>
                                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                        {copy.noGoalsDesc}
                                    </p>
                                    <Button
                                        className="mt-5"
                                        onClick={() => navigate("/goals")}
                                    >
                                        {copy.openGoals}
                                    </Button>
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
                              pendingDelete.note || pendingDelete.category,
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
