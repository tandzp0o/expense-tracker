import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/vi";
import {
    ChartColumnBig,
    CircleDollarSign,
    PiggyBank,
    ReceiptText,
} from "lucide-react";
import { auth } from "../firebase/config";
import { transactionApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import { useTheme } from "../contexts/ThemeContext";
import { hexToRgba } from "../lib/utils";
import { PageHeader } from "../components/app/page-header";
import { MetricCard } from "../components/app/metric-card";
import { EmptyState } from "../components/app/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Select } from "../components/ui/select";
import { Spinner } from "../components/ui/spinner";
import LineChart from "../components/charts/LineChart";

dayjs.locale("vi");

interface Transaction {
    _id: string;
    type: "INCOME" | "EXPENSE";
    amount: number | string;
    category: string;
    date: string;
    note?: string;
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

const Analytics: React.FC = () => {
    const { isVietnamese } = useLocale();
    const { toast } = useToast();
    const { appearance } = useTheme();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState("current_month");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    const copy = isVietnamese
        ? {
              loadFailed: "Không thể tải phân tích",
              retry: "Vui lòng thử lại.",
              currentMonth: "Tháng này",
              lastMonth: "Tháng trước",
              last3Months: "3 tháng gần đây",
              last6Months: "6 tháng gần đây",
              customRange: "Tùy chọn",
              pageTitle: "Phân tích",
              pageDescription:
                  "Màn này đọc từ transactions API rồi lọc và tổng hợp phía client theo khoảng thời gian đã chọn.",
              income: "Thu nhập",
              expense: "Chi tiêu",
              net: "Chênh lệch",
              count: "Số giao dịch",
              filteredIncome: "Thu nhập trong khoảng lọc",
              filteredExpense: "Chi tiêu trong khoảng lọc",
              incomeMinusExpense: "Thu nhập trừ chi tiêu",
              transactionsInRange: "Số giao dịch trong khoảng đã chọn",
              sixMonthTrend: "Xu hướng 6 tháng",
              sixMonthTrendDesc:
                  "Biểu đồ đường dùng toàn bộ giao dịch đã tải, kể cả khi bộ lọc hiện tại ngắn hơn.",
              expenseMix: "Cơ cấu chi tiêu",
              expenseMixDesc: "Các danh mục chi tiêu lớn nhất trong khoảng đã lọc.",
              noExpenseData: "Chưa có dữ liệu chi tiêu",
              noExpenseDataDesc: "Không có khoản chi nào trong khoảng đã chọn.",
              insight: "Nhận định",
              efficiencyTitle: "Ảnh chụp hiệu quả tài chính",
              insightDesc: (start: string, end: string) =>
                  `Khoảng hiện tại từ ${start} đến ${end}. Tỷ lệ tiết kiệm được tính bằng chênh lệch ròng trên thu nhập trong giai đoạn này.`,
              savingRate: "Tỷ lệ tiết kiệm",
              projectedYearlyNet: "Dự phóng chênh lệch ròng năm",
              incomeSeriesLabel: "Thu nhập",
              expenseSeriesLabel: "Chi tiêu",
          }
        : {
              loadFailed: "Could not load analytics",
              retry: "Please retry.",
              currentMonth: "Current month",
              lastMonth: "Last month",
              last3Months: "Last 3 months",
              last6Months: "Last 6 months",
              customRange: "Custom range",
              pageTitle: "Analytics",
              pageDescription:
                  "Analytics reads from the transactions API, then filters and aggregates client-side for the chosen period.",
              income: "Income",
              expense: "Expense",
              net: "Net",
              count: "Count",
              filteredIncome: "Filtered period income",
              filteredExpense: "Filtered period expense",
              incomeMinusExpense: "Income minus expense",
              transactionsInRange: "Transactions in the selected range",
              sixMonthTrend: "Six month trend",
              sixMonthTrendDesc:
                  "Line chart combines all loaded transactions, even when the current filter is shorter.",
              expenseMix: "Expense mix",
              expenseMixDesc: "Top categories based on filtered expense transactions.",
              noExpenseData: "No expense data",
              noExpenseDataDesc: "There are no expense rows in the selected range.",
              insight: "Insight",
              efficiencyTitle: "Financial efficiency snapshot",
              insightDesc: (start: string, end: string) =>
                  `Current selection spans ${start} to ${end}. Saving rate is based on net over income for this window.`,
              savingRate: "Saving rate",
              projectedYearlyNet: "Projected yearly net",
              incomeSeriesLabel: "Income",
              expenseSeriesLabel: "Expense",
          };
    const loadFailedTitle = isVietnamese
        ? "Không thể tải phân tích"
        : "Could not load analytics";
    const retryText = isVietnamese ? "Vui lòng thử lại." : "Please retry.";

    const getDateRange = useCallback(() => {
        const now = dayjs();
        switch (selectedPeriod) {
            case "current_month":
                return { start: now.startOf("month"), end: now.endOf("month") };
            case "last_month":
                return {
                    start: now.subtract(1, "month").startOf("month"),
                    end: now.subtract(1, "month").endOf("month"),
                };
            case "last_3_months":
                return {
                    start: now.subtract(2, "month").startOf("month"),
                    end: now.endOf("month"),
                };
            case "last_6_months":
                return {
                    start: now.subtract(5, "month").startOf("month"),
                    end: now.endOf("month"),
                };
            case "custom":
                return {
                    start: customStart
                        ? dayjs(customStart).startOf("day")
                        : now.startOf("month"),
                    end: customEnd
                        ? dayjs(customEnd).endOf("day")
                        : now.endOf("month"),
                };
            default:
                return { start: now.startOf("month"), end: now.endOf("month") };
        }
    }, [customEnd, customStart, selectedPeriod]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) {
                    return;
                }

                const token = await firebaseUser.getIdToken();
                const chartStart = dayjs().subtract(5, "month").startOf("month");
                const currentRange = getDateRange();
                const fetchStart = chartStart.isBefore(currentRange.start)
                    ? chartStart
                    : currentRange.start;

                const response = await transactionApi.getTransactions(
                    {
                        startDate: fetchStart.toISOString(),
                        endDate: currentRange.end.toISOString(),
                        limit: 2000,
                        page: 1,
                    },
                    token,
                );

                setTransactions(response?.data?.transactions || []);
            } catch (error: any) {
                toast({
                    title: loadFailedTitle,
                    description: error.message || retryText,
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        void fetchData();
    }, [getDateRange, loadFailedTitle, retryText, toast]);

    const currentRange = getDateRange();

    const filteredTransactions = useMemo(
        () =>
            transactions.filter((transaction) => {
                const date = dayjs(transaction.date);
                return (
                    (date.isAfter(currentRange.start) || date.isSame(currentRange.start, "day")) &&
                    (date.isBefore(currentRange.end) || date.isSame(currentRange.end, "day"))
                );
            }),
        [currentRange.end, currentRange.start, transactions],
    );

    const stats = useMemo(() => {
        const income = filteredTransactions
            .filter((transaction) => transaction.type === "INCOME")
            .reduce((sum, transaction) => sum + parseAmount(transaction.amount), 0);
        const expense = filteredTransactions
            .filter((transaction) => transaction.type === "EXPENSE")
            .reduce((sum, transaction) => sum + parseAmount(transaction.amount), 0);

        return {
            income,
            expense,
            net: income - expense,
            count: filteredTransactions.length,
        };
    }, [filteredTransactions]);

    const breakdown = useMemo(() => {
        const map: Record<string, number> = {};
        filteredTransactions
            .filter((transaction) => transaction.type === "EXPENSE")
            .forEach((transaction) => {
                map[transaction.category] =
                    (map[transaction.category] || 0) + parseAmount(transaction.amount);
            });

        const total = Object.values(map).reduce((sum, value) => sum + value, 0);
        return Object.entries(map)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([name, value]) => ({
                name,
                value,
                percent: total > 0 ? (value / total) * 100 : 0,
            }));
    }, [filteredTransactions]);

    const chartData = useMemo(() => {
        const months: Dayjs[] = [];
        for (let index = 5; index >= 0; index -= 1) {
            months.push(dayjs().subtract(index, "month"));
        }

        return {
            labels: months.map((month) => `${isVietnamese ? "T" : "M"}${month.month() + 1}`),
            datasets: [
                {
                    label: copy.incomeSeriesLabel,
                    data: months.map((month) =>
                        transactions
                            .filter(
                                (transaction) =>
                                    transaction.type === "INCOME" &&
                                    dayjs(transaction.date).isSame(month, "month"),
                            )
                            .reduce(
                                (sum, transaction) => sum + parseAmount(transaction.amount),
                                0,
                            ),
                    ),
                    borderColor: appearance.primaryColor,
                    backgroundColor: hexToRgba(appearance.primaryColor, 0.15),
                    fill: true,
                    tension: 0.35,
                },
                {
                    label: copy.expenseSeriesLabel,
                    data: months.map((month) =>
                        transactions
                            .filter(
                                (transaction) =>
                                    transaction.type === "EXPENSE" &&
                                    dayjs(transaction.date).isSame(month, "month"),
                            )
                            .reduce(
                                (sum, transaction) => sum + parseAmount(transaction.amount),
                                0,
                            ),
                    ),
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    fill: true,
                    tension: 0.35,
                },
            ],
        };
    }, [
        appearance.primaryColor,
        copy.expenseSeriesLabel,
        copy.incomeSeriesLabel,
        isVietnamese,
        transactions,
    ]);

    const savingRate = stats.income > 0 ? (stats.net / stats.income) * 100 : 0;

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
                    <div className="flex flex-wrap gap-3">
                        <Select
                            onChange={(event) => setSelectedPeriod(event.target.value)}
                            value={selectedPeriod}
                        >
                            <option value="current_month">{copy.currentMonth}</option>
                            <option value="last_month">{copy.lastMonth}</option>
                            <option value="last_3_months">{copy.last3Months}</option>
                            <option value="last_6_months">{copy.last6Months}</option>
                            <option value="custom">{copy.customRange}</option>
                        </Select>
                        {selectedPeriod === "custom" ? (
                            <>
                                <Input
                                    onChange={(event) => setCustomStart(event.target.value)}
                                    type="date"
                                    value={customStart}
                                />
                                <Input
                                    onChange={(event) => setCustomEnd(event.target.value)}
                                    type="date"
                                    value={customEnd}
                                />
                            </>
                        ) : null}
                    </div>
                }
                description={copy.pageDescription}
                title={copy.pageTitle}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    icon={CircleDollarSign}
                    subtitle={copy.filteredIncome}
                    title={copy.income}
                    value={formatCurrency(stats.income)}
                />
                <MetricCard
                    icon={ChartColumnBig}
                    subtitle={copy.filteredExpense}
                    title={copy.expense}
                    value={formatCurrency(stats.expense)}
                />
                <MetricCard
                    icon={PiggyBank}
                    subtitle={copy.incomeMinusExpense}
                    title={copy.net}
                    value={formatCurrency(stats.net)}
                />
                <MetricCard
                    icon={ReceiptText}
                    subtitle={copy.transactionsInRange}
                    title={copy.count}
                    value={String(stats.count)}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.6fr,1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>{copy.sixMonthTrend}</CardTitle>
                        <CardDescription>
                            {copy.sixMonthTrendDesc}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[320px]">
                            <LineChart
                                data={chartData}
                                options={{
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: "bottom",
                                        },
                                    },
                                    scales: {
                                        x: {
                                            grid: { display: false },
                                        },
                                        y: {
                                            ticks: {
                                                callback: (value: number | string) =>
                                                    Number(value).toLocaleString(
                                                        isVietnamese
                                                            ? "vi-VN"
                                                            : "en-US",
                                                    ),
                                            },
                                        },
                                    },
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{copy.expenseMix}</CardTitle>
                        <CardDescription>
                            {copy.expenseMixDesc}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {breakdown.length > 0 ? (
                            <div className="space-y-4">
                                {breakdown.map((item) => (
                                    <div key={item.name} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{item.name}</span>
                                            <span className="text-muted-foreground">
                                                {formatCurrency(item.value)}
                                            </span>
                                        </div>
                                        <Progress value={item.percent} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                description={copy.noExpenseDataDesc}
                                icon={ChartColumnBig}
                                title={copy.noExpenseData}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="overflow-hidden">
                <CardContent className="grid gap-6 p-6 md:grid-cols-[1.3fr,0.7fr]">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                            {copy.insight}
                        </p>
                        <h3 className="mt-3 text-2xl font-semibold">
                            {copy.efficiencyTitle}
                        </h3>
                        <p className="mt-3 text-sm text-muted-foreground">
                            {copy.insightDesc(
                                currentRange.start.format("DD/MM/YYYY"),
                                currentRange.end.format("DD/MM/YYYY"),
                            )}
                        </p>
                    </div>
                    <div className="rounded-[var(--app-radius-lg)] bg-primary-soft p-5">
                        <p className="text-sm text-muted-foreground">{copy.savingRate}</p>
                        <p className="mt-2 text-3xl font-semibold text-primary">
                            {Math.round(savingRate)}%
                        </p>
                        <p className="mt-3 text-sm text-muted-foreground">
                            {copy.projectedYearlyNet}: {formatCurrency(stats.net * 12)}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Analytics;
