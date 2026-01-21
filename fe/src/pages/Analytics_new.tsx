import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { DatePicker, Select, Spin, message } from "antd";
import { auth } from "../firebase/config";
import { transactionApi, walletApi, goalApi, budgetApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import { useTheme } from "../contexts/ThemeContext";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";

dayjs.locale("vi");

const { RangePicker } = DatePicker;

interface Transaction {
    _id: string;
    type: "INCOME" | "EXPENSE";
    amount: number | string;
    category: string;
    date: string;
    note?: string;
    walletId?: {
        _id: string;
        name: string;
    };
}

interface Wallet {
    _id: string;
    name: string;
    balance: number;
}

interface Goal {
    _id: string;
    title: string;
    currentAmount: number;
    targetAmount: number;
    status: string;
}

const Analytics_new: React.FC = () => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [budgets, setBudgets] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] =
        useState<string>("current_month");
    const [customRange, setCustomRange] = useState<
        [dayjs.Dayjs, dayjs.Dayjs] | null
    >(null);

    const parseAmount = (raw: unknown) => {
        if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
        if (typeof raw === "string") {
            const cleaned = raw.replace(/[^0-9.-]/g, "");
            const v = Number(cleaned);
            return Number.isFinite(v) ? v : 0;
        }
        return 0;
    };

    const makeBarGradient = (
        ctx: CanvasRenderingContext2D,
        area: { top: number; bottom: number },
        from: string,
        to: string,
    ) => {
        const g = ctx.createLinearGradient(0, area.bottom, 0, area.top);
        g.addColorStop(0, from);
        g.addColorStop(1, to);
        return g;
    };

    const getDateRange = () => {
        const now = dayjs();

        switch (selectedPeriod) {
            case "current_month":
                return {
                    start: now.startOf("month"),
                    end: now.endOf("month"),
                };
            case "last_month":
                return {
                    start: now.subtract(1, "month").startOf("month"),
                    end: now.subtract(1, "month").endOf("month"),
                };
            case "last_3_months":
                return {
                    start: now.subtract(3, "month").startOf("month"),
                    end: now.endOf("month"),
                };
            case "last_6_months":
                return {
                    start: now.subtract(6, "month").startOf("month"),
                    end: now.endOf("month"),
                };
            case "custom":
                if (customRange) {
                    return {
                        start: customRange[0].startOf("day"),
                        end: customRange[1].endOf("day"),
                    };
                }
                return {
                    start: now.startOf("month"),
                    end: now.endOf("month"),
                };
            default:
                return {
                    start: now.startOf("month"),
                    end: now.endOf("month"),
                };
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) return;

                const token = await firebaseUser.getIdToken();
                const range = getDateRange();
                const startDate = range.start.toISOString();
                const endDate = range.end.toISOString();

                const [walletsRes, txRes, goalRes, budgetRes] =
                    await Promise.all([
                        walletApi.getWallets(token),
                        transactionApi.getTransactions(
                            { startDate, endDate, sort: "-date", limit: 1000 },
                            token,
                        ),
                        goalApi.getGoals(token),
                        budgetApi.getBudgetSummary(
                            {
                                month: range.start.month() + 1,
                                year: range.start.year(),
                            },
                            token,
                        ),
                    ]);

                setWallets(walletsRes?.wallets || []);
                setTransactions(txRes?.data?.transactions || []);
                setGoals(Array.isArray(goalRes) ? goalRes : []);
                setBudgets(
                    Array.isArray(budgetRes)
                        ? budgetRes
                        : budgetRes?.items || [],
                );
            } catch (e) {
                console.error(e);
                message.error("Không thể tải dữ liệu phân tích");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedPeriod, customRange]);

    const range = getDateRange();
    const txFiltered = useMemo(
        () =>
            transactions.filter((t) => {
                const d = dayjs(t.date);
                return (
                    d.isAfter(range.start.subtract(1, "day")) &&
                    d.isBefore(range.end.add(1, "day"))
                );
            }),
        [transactions, range.end, range.start],
    );

    const totalIncome = useMemo(
        () =>
            txFiltered
                .filter((t) => t.type === "INCOME")
                .reduce((sum, t) => sum + parseAmount(t.amount), 0),
        [txFiltered],
    );

    const totalExpense = useMemo(
        () =>
            txFiltered
                .filter((t) => t.type === "EXPENSE")
                .reduce((sum, t) => sum + parseAmount(t.amount), 0),
        [txFiltered],
    );

    const netIncome = useMemo(
        () => totalIncome - totalExpense,
        [totalIncome, totalExpense],
    );

    const dailyTrend = useMemo(() => {
        const labels: string[] = [];
        const values: number[] = [];
        const start = range.start;
        const end = range.end;

        // Debug: Log dữ liệu
        // console.log("Analytics DailyTrend Debug - txFiltered:", txFiltered);
        // console.log(
        //     "Analytics DailyTrend Debug - txFiltered dates:",
        //     txFiltered.map((t) => ({
        //         date: t.date,
        //         parsed: dayjs(t.date).format("YYYY-MM-DD"),
        //     })),
        // );
        // console.log(
        //     "Analytics DailyTrend Debug - start:",
        //     start.format("YYYY-MM-DD"),
        // );
        // console.log(
        //     "Analytics DailyTrend Debug - end:",
        //     end.format("YYYY-MM-DD"),
        // );

        // Generate daily labels
        const dates: dayjs.Dayjs[] = [];
        for (
            let d = start.clone();
            d.isBefore(end) || d.isSame(end);
            d = d.add(1, "day")
        ) {
            dates.push(d.clone());
            labels.push(d.format("D MMM"));
        }

        // Calculate cumulative balance
        let cumulativeBalance = 0;

        dates.forEach((currentDate, idx) => {
            const dayTransactions = txFiltered.filter((t) => {
                const transactionDate = dayjs(t.date);
                const isSameDay = transactionDate.isSame(currentDate, "day");
                // if (isSameDay) {
                //     console.log(
                //         `Analytics Transaction on ${currentDate.format("YYYY-MM-DD")}:`,
                //         t,
                //     );
                // }
                return isSameDay;
            });

            const dayNet = dayTransactions.reduce((sum, t) => {
                const amount = parseAmount(t.amount);
                const net = t.type === "INCOME" ? amount : -amount;
                // console.log(
                //     `Analytics Day net for ${currentDate.format("YYYY-MM-DD")}: ${net} (${t.type}: ${amount})`,
                // );
                return sum + net;
            }, 0);

            cumulativeBalance += dayNet;
            values[idx] = cumulativeBalance;
            // console.log(
            //     `Analytics Cumulative balance for ${currentDate.format("YYYY-MM-DD")}: ${cumulativeBalance}`,
            // );
        });

        // console.log("Analytics Final dailyTrend:", { labels, values });
        return { labels, values };
    }, [range.start, range.end, txFiltered]);

    const lineData = useMemo(
        () => ({
            labels: dailyTrend.labels,
            datasets: [
                {
                    label: "Xu hướng số dư",
                    data: dailyTrend.values,
                    borderColor: "rgba(70, 229, 91, 1)",
                    backgroundColor: "rgba(70, 229, 91, 0.10)",
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    borderWidth: 3,
                },
            ],
        }),
        [dailyTrend.labels, dailyTrend.values],
    );

    const lineOptions = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            const value =
                                typeof context.parsed?.y === "number"
                                    ? context.parsed.y
                                    : 0;
                            return `${value.toLocaleString("vi-VN")} VND`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: "#ffffff",
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 10,
                    },
                },
                y: {
                    grid: {
                        display: true,
                        color:
                            theme === "dark"
                                ? "rgba(148, 163, 184, 0.18)"
                                : "rgba(15, 23, 42, 0.08)",
                        borderDash: [2, 2],
                    },
                    ticks: {
                        color: "#ffffff",
                        callback: (value: any) =>
                            `${Number(value).toLocaleString("vi-VN")}`,
                    },
                },
            },
        }),
        [theme],
    );

    const expenseBreakdown = useMemo(() => {
        const map: Record<string, number> = {};
        txFiltered
            .filter((t) => t.type === "EXPENSE")
            .forEach((t) => {
                const key = t.category || "Khác";
                map[key] = (map[key] || 0) + parseAmount(t.amount);
            });

        const entries = Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        const total = entries.reduce((s, [, v]) => s + v, 0);

        return entries.map(([name, value], idx) => ({
            name,
            value,
            percent: total > 0 ? (value / total) * 100 : 0,
            color: [
                "#f97316",
                "#3b82f6",
                "#22c55e",
                "#a855f7",
                "#14b8a6",
                "#eab308",
                "#ef4444",
                "#06b6d4",
                "#8b5cf6",
                "#f59e0b",
            ][idx % 10],
        }));
    }, [txFiltered]);

    const monthlyIncomeExpense = useMemo(() => {
        const months = [];
        const start = range.start;
        const end = range.end;

        for (
            let m = start.clone();
            m.isBefore(end) || m.isSame(end, "month");
            m = m.add(1, "month")
        ) {
            months.push(m);
        }

        const labels = months.map((m) => m.format("MMM YYYY"));
        const income = months.map((m) => {
            const monthStart = m.startOf("month");
            const monthEnd = m.endOf("month");
            return transactions
                .filter((t) => t.type === "INCOME")
                .reduce((acc, t) => {
                    const d = dayjs(t.date);
                    if (d.isAfter(monthStart) && d.isBefore(monthEnd))
                        return acc + parseAmount(t.amount);
                    return acc;
                }, 0);
        });
        const expense = months.map((m) => {
            const monthStart = m.startOf("month");
            const monthEnd = m.endOf("month");
            return transactions
                .filter((t) => t.type === "EXPENSE")
                .reduce((acc, t) => {
                    const d = dayjs(t.date);
                    if (d.isAfter(monthStart) && d.isBefore(monthEnd))
                        return acc + parseAmount(t.amount);
                    return acc;
                }, 0);
        });

        return { labels, income, expense };
    }, [range.start, range.end, transactions]);

    const incomeExpenseBarData = useMemo(
        () => ({
            labels: monthlyIncomeExpense.labels,
            datasets: [
                {
                    label: "Thu nhập",
                    data: monthlyIncomeExpense.income,
                    backgroundColor: (context: any) => {
                        const chart = context.chart;
                        const area = chart?.chartArea;
                        if (!area) return "rgba(70, 229, 91, 0.95)";
                        return makeBarGradient(
                            chart.ctx,
                            area,
                            "rgba(70, 229, 91, 0.75)",
                            "rgba(70, 229, 91, 1)",
                        );
                    },
                    hoverBackgroundColor: "rgba(70, 229, 91, 1)",
                    borderColor: "rgba(70, 229, 91, 1)",
                    borderWidth: 0,
                    borderRadius: 6,
                    maxBarThickness: 18,
                },
                {
                    label: "Chi tiêu",
                    data: monthlyIncomeExpense.expense,
                    backgroundColor: (context: any) => {
                        const chart = context.chart;
                        const area = chart?.chartArea;
                        if (!area)
                            return theme === "dark"
                                ? "rgba(248, 213, 56, 0.95)"
                                : "rgba(248, 213, 56, 0.9)";
                        return makeBarGradient(
                            chart.ctx,
                            area,
                            theme === "dark"
                                ? "rgba(248, 213, 56, 0.85)"
                                : "rgba(248, 213, 56, 0.8)",
                            theme === "dark"
                                ? "rgba(248, 213, 56, 1)"
                                : "rgba(248, 213, 56, 0.95)",
                        );
                    },
                    hoverBackgroundColor:
                        theme === "dark"
                            ? "rgba(248, 213, 56, 1)"
                            : "rgba(248, 213, 56, 1)",
                    borderColor:
                        theme === "dark"
                            ? "rgba(248, 213, 56, 1)"
                            : "rgba(248, 213, 56, 1)",
                    borderWidth: 0,
                    borderRadius: 6,
                    maxBarThickness: 18,
                },
            ],
        }),
        [monthlyIncomeExpense, theme],
    );

    const barOptions = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top" as const,
                    labels: {
                        color: "#ffffff",
                        boxWidth: 10,
                        boxHeight: 10,
                    },
                },
                tooltip: {
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    borderWidth: 1,
                    titleColor: "#ffffff",
                    bodyColor: "#ffffff",
                    callbacks: {
                        label: (context: any) => {
                            const label = context.dataset?.label
                                ? `${context.dataset.label}: `
                                : "";
                            const value =
                                typeof context.parsed?.y === "number"
                                    ? context.parsed.y
                                    : 0;
                            return `${label}${value.toLocaleString("vi-VN")} VND`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: "#ffffff",
                    },
                },
                y: {
                    grid: {
                        display: true,
                        color:
                            theme === "dark"
                                ? "rgba(148, 163, 184, 0.18)"
                                : "rgba(15, 23, 42, 0.08)",
                        borderDash: [2, 2],
                    },
                    ticks: {
                        color: "#ffffff",
                        callback: (value: any) =>
                            `${Number(value).toLocaleString("vi-VN")}`,
                    },
                },
            },
        }),
        [theme],
    );

    const handlePeriodChange = (value: string) => {
        setSelectedPeriod(value);
        if (value !== "custom") {
            setCustomRange(null);
        }
    };

    const handleRangeChange = (dates: any) => {
        if (dates && dates.length === 2) {
            setCustomRange([dates[0], dates[1]]);
            setSelectedPeriod("custom");
        }
    };

    const handleBackToCurrent = () => {
        setSelectedPeriod("current_month");
        setCustomRange(null);
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "50px" }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="ekash_page">
            <div className="ekash_page_header">
                <div>
                    <h2 className="ekash_title">Phân tích tài chính</h2>
                    <p className="ekash_subtitle">
                        Báo cáo chi tiết về thu nhập và chi tiêu
                    </p>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "15px",
                    }}
                >
                    <Select
                        value={selectedPeriod}
                        onChange={handlePeriodChange}
                        style={{ width: 150 }}
                        options={[
                            { value: "current_month", label: "Tháng này" },
                            { value: "last_month", label: "Tháng trước" },
                            {
                                value: "last_3_months",
                                label: "3 tháng gần nhất",
                            },
                            {
                                value: "last_6_months",
                                label: "6 tháng gần nhất",
                            },
                            { value: "custom", label: "Tùy chỉnh" },
                        ]}
                    />
                    {selectedPeriod === "custom" && (
                        <RangePicker
                            value={customRange}
                            onChange={handleRangeChange}
                            format="DD/MM/YYYY"
                            placeholder={["Từ ngày", "Đến ngày"]}
                        />
                    )}
                    <button
                        className="ekash_btn"
                        onClick={handleBackToCurrent}
                        style={{
                            backgroundColor: "#4f46e5",
                            color: "white",
                            border: "none",
                            padding: "8px 16px",
                            borderRadius: "6px",
                            cursor: "pointer",
                        }}
                    >
                        Về hiện tại
                    </button>
                </div>
            </div>

            <div className="ekash_grid_4">
                <div className="ekash_card">
                    <div className="ekash_stat_label">Tổng thu nhập</div>
                    <div className="ekash_stat_value">
                        {formatCurrency(totalIncome)}
                    </div>
                    <div className="ekash_stat_delta">
                        <span className="ekash_pill up">↑</span>
                    </div>
                </div>
                <div className="ekash_card">
                    <div className="ekash_stat_label">Tổng chi tiêu</div>
                    <div className="ekash_stat_value">
                        {formatCurrency(totalExpense)}
                    </div>
                    <div className="ekash_stat_delta">
                        <span className="ekash_pill down">↓</span>
                    </div>
                </div>
                <div className="ekash_card">
                    <div className="ekash_stat_label">Thu nhập ròng</div>
                    <div className="ekash_stat_value">
                        {formatCurrency(netIncome)}
                    </div>
                    <div className="ekash_stat_delta">
                        <span
                            className={`ekash_pill ${netIncome >= 0 ? "up" : "down"}`}
                        >
                            {netIncome >= 0 ? "↑" : "↓"}
                        </span>
                    </div>
                </div>
                <div className="ekash_card">
                    <div className="ekash_stat_label">Số giao dịch</div>
                    <div className="ekash_stat_value">{txFiltered.length}</div>
                    <div className="ekash_stat_delta">
                        <span className="ekash_pill">📊</span>
                    </div>
                </div>
            </div>

            <div className="ekash_grid_main">
                <div className="ekash_card ekash_chart_card">
                    <div className="ekash_card_header">
                        <div>
                            <p className="ekash_card_title">Xu hướng số dư</p>
                            <div className="ekash_big_value">
                                {formatCurrency(
                                    dailyTrend.values[
                                        dailyTrend.values.length - 1
                                    ] || 0,
                                )}
                            </div>
                        </div>
                        <div className="ekash_card_hint">
                            {range.start.format("DD/MM/YYYY")} -{" "}
                            {range.end.format("DD/MM/YYYY")}
                        </div>
                    </div>
                    <div className="ekash_chart" style={{ height: 300 }}>
                        <LineChart data={lineData} options={lineOptions} />
                    </div>
                </div>

                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">
                            Phân tích chi tiêu theo danh mục
                        </p>
                    </div>

                    <div className="ekash_breakdown_bar">
                        {expenseBreakdown.map((e) => (
                            <span
                                key={e.name}
                                className="seg"
                                style={{
                                    width: `${Math.max(e.percent, 2)}%`,
                                    backgroundColor: e.color,
                                }}
                                title={`${e.name}: ${formatCurrency(e.value)} (${e.percent.toFixed(0)}%)`}
                            />
                        ))}
                    </div>

                    <div className="ekash_breakdown_list">
                        {expenseBreakdown.map((e) => (
                            <div key={e.name} className="row">
                                <div className="left">
                                    <span
                                        className="dot"
                                        style={{ backgroundColor: e.color }}
                                    />
                                    <span className="name">{e.name}</span>
                                </div>
                                <div className="right">
                                    <span className="amt">
                                        {formatCurrency(e.value)}
                                    </span>
                                    <span className="pct">
                                        {e.percent.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="ekash_grid_2">
                <div className="ekash_card ekash_chart_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">
                            Thu nhập so với chi tiêu theo tháng
                        </p>
                        <span className="ekash_card_hint">
                            {monthlyIncomeExpense.labels.length} tháng
                        </span>
                    </div>
                    <div className="ekash_chart" style={{ height: 300 }}>
                        <div
                            className="ekash_chart_bg"
                            style={{ height: "100%" }}
                        >
                            <BarChart
                                data={incomeExpenseBarData}
                                options={barOptions}
                            />
                        </div>
                    </div>
                </div>

                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Chi tiết thống kê</p>
                    </div>
                    <div style={{ padding: "20px" }}>
                        <div style={{ marginBottom: "15px" }}>
                            <div
                                style={{
                                    fontSize: "14px",
                                    color: "var(--text-secondary)",
                                    marginBottom: "5px",
                                }}
                            >
                                Thu nhập trung bình/ngày
                            </div>
                            <div
                                style={{ fontSize: "18px", fontWeight: "bold" }}
                            >
                                {formatCurrency(
                                    totalIncome /
                                        Math.max(dailyTrend.labels.length, 1),
                                )}
                            </div>
                        </div>
                        <div style={{ marginBottom: "15px" }}>
                            <div
                                style={{
                                    fontSize: "14px",
                                    color: "var(--text-secondary)",
                                    marginBottom: "5px",
                                }}
                            >
                                Chi tiêu trung bình/ngày
                            </div>
                            <div
                                style={{ fontSize: "18px", fontWeight: "bold" }}
                            >
                                {formatCurrency(
                                    totalExpense /
                                        Math.max(dailyTrend.labels.length, 1),
                                )}
                            </div>
                        </div>
                        <div style={{ marginBottom: "15px" }}>
                            <div
                                style={{
                                    fontSize: "14px",
                                    color: "var(--text-secondary)",
                                    marginBottom: "5px",
                                }}
                            >
                                Tỷ lệ tiết kiệm
                            </div>
                            <div
                                style={{ fontSize: "18px", fontWeight: "bold" }}
                            >
                                {totalIncome > 0
                                    ? `${(((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1)}%`
                                    : "0%"}
                            </div>
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: "14px",
                                    color: "var(--text-secondary)",
                                    marginBottom: "5px",
                                }}
                            >
                                Danh mục chi tiêu nhiều nhất
                            </div>
                            <div
                                style={{ fontSize: "18px", fontWeight: "bold" }}
                            >
                                {expenseBreakdown[0]?.name || "N/A"} (
                                {formatCurrency(
                                    expenseBreakdown[0]?.value || 0,
                                )}
                                )
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics_new;
