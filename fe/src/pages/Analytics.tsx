import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/vi";
import {
    ChartColumnBig,
    CircleDollarSign,
    PiggyBank,
    ReceiptText,
    Sparkles,
} from "lucide-react";
import { auth } from "../firebase/config";
import { transactionApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import {
    getAppearanceGradientColors,
    useTheme,
} from "../contexts/ThemeContext";
import { hexToRgba } from "../lib/utils";
import { PageHeader } from "../components/app/page-header";
import { MetricCard } from "../components/app/metric-card";
import { EmptyState } from "../components/app/empty-state";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
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

    const baseCopy = isVietnamese
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
              expenseMixDesc:
                  "Các danh mục chi tiêu lớn nhất trong khoảng đã lọc.",
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
              expenseMixDesc:
                  "Top categories based on filtered expense transactions.",
              noExpenseData: "No expense data",
              noExpenseDataDesc:
                  "There are no expense rows in the selected range.",
              insight: "Insight",
              efficiencyTitle: "Financial efficiency snapshot",
              insightDesc: (start: string, end: string) =>
                  `Current selection spans ${start} to ${end}. Saving rate is based on net over income for this window.`,
              savingRate: "Saving rate",
              projectedYearlyNet: "Projected yearly net",
              incomeSeriesLabel: "Income",
              expenseSeriesLabel: "Expense",
          };
    const copy = {
        ...baseCopy,
        pageDescription: isVietnamese
            ? "Xem nhanh thu, chi và chênh lệch theo khoảng thời gian bạn chọn."
            : "Review income, expense, and net results for your selected time range.",
        sixMonthTrendDesc: isVietnamese
            ? "Biến động thu và chi trong 6 tháng gần đây."
            : "Income and expense movement across the last six months.",
        expenseMixDesc: isVietnamese
            ? "Những nhóm chi tiêu nổi bật trong khoảng đang xem."
            : "Top spending groups in the current range.",
        noExpenseDataDesc: isVietnamese
            ? "Chưa có khoản chi nào trong khoảng thời gian này."
            : "There are no expense entries in this time range.",
        efficiencyTitle: isVietnamese
            ? "Hiệu quả tài chính"
            : "Financial snapshot",
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
                const chartStart = dayjs()
                    .subtract(5, "month")
                    .startOf("month");
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
                    (date.isAfter(currentRange.start) ||
                        date.isSame(currentRange.start, "day")) &&
                    (date.isBefore(currentRange.end) ||
                        date.isSame(currentRange.end, "day"))
                );
            }),
        [currentRange.end, currentRange.start, transactions],
    );

    const stats = useMemo(() => {
        const income = filteredTransactions
            .filter((transaction) => transaction.type === "INCOME")
            .reduce(
                (sum, transaction) => sum + parseAmount(transaction.amount),
                0,
            );
        const expense = filteredTransactions
            .filter((transaction) => transaction.type === "EXPENSE")
            .reduce(
                (sum, transaction) => sum + parseAmount(transaction.amount),
                0,
            );

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
                    (map[transaction.category] || 0) +
                    parseAmount(transaction.amount);
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
            labels: months.map(
                (month) => `${isVietnamese ? "T" : "M"}${month.month() + 1}`,
            ),
            datasets: [
                {
                    label: copy.incomeSeriesLabel,
                    data: months.map((month) =>
                        transactions
                            .filter(
                                (transaction) =>
                                    transaction.type === "INCOME" &&
                                    dayjs(transaction.date).isSame(
                                        month,
                                        "month",
                                    ),
                            )
                            .reduce(
                                (sum, transaction) =>
                                    sum + parseAmount(transaction.amount),
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
                                    dayjs(transaction.date).isSame(
                                        month,
                                        "month",
                                    ),
                            )
                            .reduce(
                                (sum, transaction) =>
                                    sum + parseAmount(transaction.amount),
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
    const insightParagraphs = useMemo(() => {
        const expenseTransactions = filteredTransactions.filter(
            (transaction) => transaction.type === "EXPENSE",
        );
        const averageExpense =
            expenseTransactions.length > 0
                ? stats.expense / expenseTransactions.length
                : 0;
        const topExpense = breakdown[0];
        const targetSavingAmount = stats.income > 0 ? stats.income * 0.2 : 0;

        if (isVietnamese) {
            const health =
                stats.net > 0
                    ? savingRate >= 20
                        ? `Bạn đang giữ được trạng thái tài chính khá tốt: thu nhập vẫn cao hơn chi tiêu và tỷ lệ tiết kiệm đạt khoảng ${Math.round(savingRate)}%. Nếu duy trì nhịp này, bạn đang có nền tảng tốt để tích lũy dài hạn.`
                        : `Bạn vẫn đang dương về dòng tiền nhưng phần giữ lại sau chi tiêu mới khoảng ${Math.round(savingRate)}%. Tình hình ổn nhưng biên an toàn chưa dày, nên vẫn cần kiểm soát các khoản phát sinh.`
                    : stats.net === 0
                      ? "Dòng tiền đang ở mức cân bằng, nghĩa là số tiền đi ra gần như bằng số tiền đi vào. Đây là giai đoạn nên siết lại các khoản chưa thật sự cần thiết để tạo vùng đệm an toàn hơn."
                      : `Chi tiêu hiện đang vượt thu nhập khoảng ${formatCurrency(Math.abs(stats.net))} trong giai đoạn này. Nếu kéo dài, nhịp dùng tiền hiện tại sẽ làm giảm khả năng tiết kiệm và gây áp lực lên các mục tiêu tài chính sau đó.`;

            const spending = topExpense
                ? `Khoản chi tập trung nhiều nhất đang là ${topExpense.name}, chiếm khoảng ${Math.round(topExpense.percent)}% tổng chi. Mỗi giao dịch chi tiêu hiện trung bình khoảng ${formatCurrency(averageExpense)}, cho thấy bạn nên theo dõi sát nhóm này nếu muốn tối ưu ngân sách.`
                : "Hiện chưa có khoản chi nào trong giai đoạn này, nên đây là thời điểm thuận lợi để đặt ra khung chi tiêu rõ ràng trước khi phát sinh thêm giao dịch.";

            const direction =
                stats.income > 0
                    ? savingRate >= 20
                        ? `Mục tiêu tiếp theo phù hợp là duy trì đều mức tiết kiệm tối thiểu ${formatCurrency(targetSavingAmount)} cho mỗi chu kỳ tương tự và chuyển phần dư vào quỹ dự phòng hoặc mục tiêu dài hạn.`
                        : `Mục tiêu nên hướng tới là nâng phần tiền giữ lại lên ít nhất ${formatCurrency(targetSavingAmount)} cho mỗi chu kỳ tương tự. Bạn có thể bắt đầu bằng việc giới hạn nhóm chi lớn nhất trước, rồi mới mở rộng sang các khoản nhỏ hơn.`
                    : "Ưu tiên trước mắt nên là ổn định nguồn thu và giữ mức chi thật gọn. Khi đã có dòng tiền đều hơn, bạn sẽ dễ đặt mục tiêu tiết kiệm rõ ràng và thực tế hơn.";

            return [health, spending, direction];
        }

        const health =
            stats.net > 0
                ? savingRate >= 20
                    ? `Your finances are in a healthy state right now: income is still above spending and your saving rate is around ${Math.round(savingRate)}%. Keeping this pace would support stronger long-term progress.`
                    : `You are still cash-flow positive, but only about ${Math.round(savingRate)}% is being retained. The situation is stable, though the safety margin is still fairly thin.`
                : stats.net === 0
                  ? "Your cash flow is currently balanced, which means money in is roughly matching money out. This is a good moment to trim optional spending and create a stronger buffer."
                  : `Spending is currently above income by about ${formatCurrency(Math.abs(stats.net))} in this period. If that pattern continues, it will reduce your room to save and slow future goals.`;

        const spending = topExpense
            ? `${topExpense.name} is your biggest spending group, representing about ${Math.round(topExpense.percent)}% of total expense. Your average expense transaction is roughly ${formatCurrency(averageExpense)}, so this category is the best place to optimize first.`
            : "There are no expense entries in this period yet, which makes this a good time to define a clearer spending plan before new transactions build up.";

        const direction =
            stats.income > 0
                ? savingRate >= 20
                    ? `A sensible next target is to keep saving at least ${formatCurrency(targetSavingAmount)} for each similar period and redirect the surplus into emergency reserves or long-term goals.`
                    : `A practical next target would be to retain at least ${formatCurrency(targetSavingAmount)} in each similar period. Start by tightening the largest expense group before worrying about smaller categories.`
                : "The immediate focus should be stabilizing income and keeping spending lean. Once cash flow is more predictable, savings targets become much easier to maintain.";

        return [health, spending, direction];
    }, [
        breakdown,
        filteredTransactions,
        isVietnamese,
        savingRate,
        stats.expense,
        stats.income,
        stats.net,
    ]);

    const themeColors = getAppearanceGradientColors(appearance);
    const mobileHeroGradient =
        appearance.mode === "dark"
            ? `linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, ${hexToRgba(
                  themeColors.primary,
                  0.38,
              )} 44%, ${hexToRgba(themeColors.secondary, 0.36)} 64%, rgba(15, 23, 42, 0.9) 100%)`
            : `linear-gradient(135deg, ${hexToRgba(
                  themeColors.primary,
                  0.92,
              )} 0%, ${hexToRgba(
                  themeColors.secondary,
                  0.7,
              )} 52%, rgba(15, 23, 42, 0.84) 100%)`;

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
                    className="overflow-hidden rounded-[calc(var(--app-radius-xl)+4px)] border border-white/70 p-4 text-white shadow-soft dark:border-white/10"
                    style={{ backgroundImage: mobileHeroGradient }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/72">
                                {isVietnamese ? "Tóm tắt từ AI" : "AI summary"}
                            </p>
                            <h2 className="mt-2 text-base md:text-xl font-semibold leading-tight">
                                {stats.net >= 0
                                    ? isVietnamese
                                        ? "Khoảng này bạn đang giữ chênh lệch dương khá ổn."
                                        : "You are holding a healthy positive net in this range."
                                    : isVietnamese
                                      ? "Khoảng này đang âm, nên ưu tiên nhìn lại các nhóm chi tiêu lớn."
                                      : "This range is negative, so revisit the largest spend groups first."}
                            </h2>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[11px] font-semibold">
                            <Sparkles className="h-3.5 w-3.5" />
                            AI
                        </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-[var(--app-radius-lg)] border border-white/18 bg-white/10 p-3">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/68">
                                {copy.income}
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                                {formatCurrency(stats.income)}
                            </p>
                        </div>
                        <div className="rounded-[var(--app-radius-lg)] border border-white/18 bg-white/10 p-3">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/68">
                                {copy.expense}
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                                {formatCurrency(stats.expense)}
                            </p>
                        </div>
                        <div className="rounded-[var(--app-radius-lg)] border border-white/18 bg-white/10 p-3">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/68">
                                {copy.savingRate}
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                                {Math.round(savingRate)}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 rounded-[var(--app-radius-xl)] border border-border/70 bg-card/80 p-2 shadow-soft">
                    <Select
                        onChange={(event) =>
                            setSelectedPeriod(event.target.value)
                        }
                        value={selectedPeriod}
                    >
                        <option value="current_month">
                            {copy.currentMonth}
                        </option>
                        <option value="last_month">{copy.lastMonth}</option>
                        <option value="last_3_months">
                            {copy.last3Months}
                        </option>
                        <option value="last_6_months">
                            {copy.last6Months}
                        </option>
                        <option value="custom">{copy.customRange}</option>
                    </Select>
                    {selectedPeriod === "custom" ? (
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                onChange={(event) =>
                                    setCustomStart(event.target.value)
                                }
                                type="date"
                                value={customStart}
                            />
                            <Input
                                onChange={(event) =>
                                    setCustomEnd(event.target.value)
                                }
                                type="date"
                                value={customEnd}
                            />
                        </div>
                    ) : null}
                </div>
            </div>

            <PageHeader
                actions={
                    <div className="flex flex-wrap gap-2.5 sm:gap-3">
                        <Select
                            onChange={(event) =>
                                setSelectedPeriod(event.target.value)
                            }
                            value={selectedPeriod}
                        >
                            <option value="current_month">
                                {copy.currentMonth}
                            </option>
                            <option value="last_month">{copy.lastMonth}</option>
                            <option value="last_3_months">
                                {copy.last3Months}
                            </option>
                            <option value="last_6_months">
                                {copy.last6Months}
                            </option>
                            <option value="custom">{copy.customRange}</option>
                        </Select>
                        {selectedPeriod === "custom" ? (
                            <>
                                <Input
                                    onChange={(event) =>
                                        setCustomStart(event.target.value)
                                    }
                                    type="date"
                                    value={customStart}
                                />
                                <Input
                                    onChange={(event) =>
                                        setCustomEnd(event.target.value)
                                    }
                                    type="date"
                                    value={customEnd}
                                />
                            </>
                        ) : null}
                    </div>
                }
                description={copy.pageDescription}
                hideDescriptionOnMobile
                hideTitleOnMobile
                title={copy.pageTitle}
            />

            <div className="hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-4">
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

            <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.6fr,1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>{copy.sixMonthTrend}</CardTitle>
                        <CardDescription>
                            {copy.sixMonthTrendDesc}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[160px] lg:h-[320px]">
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
                                                callback: (
                                                    value: number | string,
                                                ) =>
                                                    Number(
                                                        value,
                                                    ).toLocaleString(
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
                        <CardDescription>{copy.expenseMixDesc}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {breakdown.length > 0 ? (
                            <div className="space-y-4">
                                {breakdown.map((item) => (
                                    <div key={item.name} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">
                                                {item.name}
                                            </span>
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
                <CardContent className="grid gap-4 p-4 sm:gap-6 sm:p-6 md:grid-cols-[1.3fr,0.7fr]">
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
                        <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                            {insightParagraphs.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-[var(--app-radius-lg)] bg-primary-soft p-4 sm:p-5">
                        <p className="text-sm text-muted-foreground">
                            {copy.savingRate}
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-primary">
                            {Math.round(savingRate)}%
                        </p>
                        <p className="mt-3 text-sm text-muted-foreground">
                            {copy.projectedYearlyNet}:{" "}
                            {formatCurrency(stats.net * 12)}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Analytics;
