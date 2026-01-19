import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { message, Spin } from "antd";
import { auth } from "../firebase/config";
import { walletApi, transactionApi, goalApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import { useTheme } from "../contexts/ThemeContext";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";

dayjs.locale("vi");

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

const Dashboard_new: React.FC = () => {
    const { theme } = useTheme();
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) return;

                const token = await firebaseUser.getIdToken();

                const now = dayjs();
                const startDate = now
                    .subtract(59, "day")
                    .startOf("day")
                    .toISOString();
                const endDate = now.endOf("day").toISOString();

                const [walletsRes, txRes, goalRes] = await Promise.all([
                    walletApi.getWallets(token),
                    transactionApi.getTransactions(
                        { startDate, endDate },
                        token,
                    ),
                    goalApi.getGoals(token),
                ]);

                setWallets(walletsRes?.wallets || []);
                setTransactions(txRes?.data?.transactions || []);
                setGoals(Array.isArray(goalRes) ? goalRes : []);
            } catch (e) {
                console.error(e);
                message.error("Không thể tải dữ liệu dashboard");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const now = dayjs();
    const currentRange = useMemo(() => {
        const end = now.endOf("day");
        const start = now.subtract(29, "day").startOf("day");
        return { start, end };
    }, [now]);

    const prevRange = useMemo(() => {
        const end = currentRange.start.subtract(1, "day").endOf("day");
        const start = end.subtract(29, "day").startOf("day");
        return { start, end };
    }, [currentRange.start]);

    const txCurrent = useMemo(
        () =>
            transactions.filter((t) => {
                const d = dayjs(t.date);
                return (
                    d.isAfter(currentRange.start) &&
                    d.isBefore(currentRange.end)
                );
            }),
        [transactions, currentRange.end, currentRange.start],
    );

    const txPrev = useMemo(
        () =>
            transactions.filter((t) => {
                const d = dayjs(t.date);
                return d.isAfter(prevRange.start) && d.isBefore(prevRange.end);
            }),
        [transactions, prevRange.end, prevRange.start],
    );

    const totalBalance = useMemo(
        () => wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0),
        [wallets],
    );

    const totalAssets = totalBalance;

    const totalInGoals = useMemo(
        () => goals.reduce((sum, g) => sum + (Number(g.currentAmount) || 0), 0),
        [goals],
    );

    const availableBalance = useMemo(
        () => totalAssets - totalInGoals,
        [totalAssets, totalInGoals],
    );

    const totalIncome = useMemo(
        () =>
            txCurrent
                .filter((t) => t.type === "INCOME")
                .reduce((sum, t) => sum + parseAmount(t.amount), 0),
        [txCurrent],
    );

    const totalExpense = useMemo(
        () =>
            txCurrent
                .filter((t) => t.type === "EXPENSE")
                .reduce((sum, t) => sum + parseAmount(t.amount), 0),
        [txCurrent],
    );

    const prevIncome = useMemo(
        () =>
            txPrev
                .filter((t) => t.type === "INCOME")
                .reduce((sum, t) => sum + parseAmount(t.amount), 0),
        [txPrev],
    );

    const prevExpense = useMemo(
        () =>
            txPrev
                .filter((t) => t.type === "EXPENSE")
                .reduce((sum, t) => sum + parseAmount(t.amount), 0),
        [txPrev],
    );

    const periodChange = useMemo(() => {
        const currentNet = totalIncome - totalExpense;
        const prevNet = prevIncome - prevExpense;
        return {
            currentNet,
            prevNet,
            delta: currentNet - prevNet,
            percent:
                prevNet !== 0
                    ? ((currentNet - prevNet) / Math.abs(prevNet)) * 100
                    : 0,
        };
    }, [prevExpense, prevIncome, totalExpense, totalIncome]);

    const statCards = useMemo(
        () => [
            {
                label: "Tổng tài sản",
                value: formatCurrency(totalAssets),
                pillType: "up" as const,
                pill: `${(totalAssets !== 0 ? 3.12 : 0).toFixed(2)}%`,
            },
            {
                label: "Số dư khả dụng",
                value: formatCurrency(availableBalance),
                pillType: availableBalance >= 0 ? "up" : "down",
                pill: `${(availableBalance >= 0 ? 0 : -2.5).toFixed(2)}%`,
            },
            {
                label: "Total Period Change",
                value: formatCurrency(periodChange.currentNet),
                pillType:
                    periodChange.delta >= 0
                        ? ("up" as const)
                        : ("down" as const),
                pill: `${Math.abs(periodChange.percent).toFixed(2)}%`,
                note: "Last month",
            },
            {
                label: "Total Period Expenses",
                value: formatCurrency(totalExpense),
                pillType: "down" as const,
                pill: `${(prevExpense !== 0 ? (Math.abs(totalExpense - prevExpense) / Math.abs(prevExpense)) * 100 : 0).toFixed(2)}%`,
                note: "Last month",
            },
            {
                label: "Total Period Income",
                value: formatCurrency(totalIncome),
                pillType: "up" as const,
                pill: `${(prevIncome !== 0 ? (Math.abs(totalIncome - prevIncome) / Math.abs(prevIncome)) * 100 : 0).toFixed(2)}%`,
                note: "Last month",
            },
        ],
        [
            periodChange,
            prevExpense,
            prevIncome,
            totalBalance,
            totalExpense,
            totalIncome,
        ],
    );

    const dailyTrend = useMemo(() => {
        const labels: string[] = [];
        const values: number[] = [];
        const start = currentRange.start;

        for (let i = 0; i < 12; i++) {
            const d = start.add(Math.round((i * 29) / 11), "day");
            labels.push(d.format("D MMM"));
        }

        const points = labels.map((l) => dayjs(l, "D MMM"));
        const bucket = points.map((p) => ({
            start: p.startOf("day"),
            end: p.endOf("day"),
        }));

        bucket.forEach((b, idx) => {
            const sum = txCurrent.reduce((acc, t) => {
                const d = dayjs(t.date);
                if (d.isAfter(b.start) && d.isBefore(b.end)) {
                    return (
                        acc +
                        (t.type === "INCOME"
                            ? parseAmount(t.amount)
                            : -parseAmount(t.amount))
                    );
                }
                return acc;
            }, 0);

            const prev = idx === 0 ? 0 : values[idx - 1];
            values[idx] = prev + sum;
        });

        return { labels, values };
    }, [currentRange.start, txCurrent]);

    const lineData = useMemo(
        () => ({
            labels: dailyTrend.labels,
            datasets: [
                {
                    label: "Balance Trends",
                    data: dailyTrend.values,
                    borderColor: "#4f46e5",
                    backgroundColor: "rgba(79, 70, 229, 0.10)",
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
                        color:
                            theme === "dark"
                                ? "rgba(229, 231, 235, 0.72)"
                                : "#64748b",
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 6,
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
                        color:
                            theme === "dark"
                                ? "rgba(229, 231, 235, 0.72)"
                                : "#64748b",
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
        txCurrent
            .filter((t) => t.type === "EXPENSE")
            .forEach((t) => {
                const key = t.category || "Khác";
                map[key] = (map[key] || 0) + parseAmount(t.amount);
            });

        const entries = Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
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
            ][idx % 6],
        }));
    }, [txCurrent]);

    const monthlyIncomeExpense = useMemo(() => {
        const months = Array.from({ length: 10 }, (_, i) =>
            now.subtract(9 - i, "month").startOf("month"),
        );
        const labels = months.map((m) => m.format("MMM"));
        const income = months.map((m) => {
            const start = m.startOf("month");
            const end = m.endOf("month");
            return transactions
                .filter((t) => t.type === "INCOME")
                .reduce((acc, t) => {
                    const d = dayjs(t.date);
                    if (d.isAfter(start) && d.isBefore(end))
                        return acc + parseAmount(t.amount);
                    return acc;
                }, 0);
        });
        const expense = months.map((m) => {
            const start = m.startOf("month");
            const end = m.endOf("month");
            return transactions
                .filter((t) => t.type === "EXPENSE")
                .reduce((acc, t) => {
                    const d = dayjs(t.date);
                    if (d.isAfter(start) && d.isBefore(end))
                        return acc + parseAmount(t.amount);
                    return acc;
                }, 0);
        });

        return { labels, income, expense };
    }, [now, transactions]);

    const incomeExpenseBarData = useMemo(
        () => ({
            labels: monthlyIncomeExpense.labels,
            datasets: [
                {
                    label: "Income",
                    data: monthlyIncomeExpense.income,
                    backgroundColor: (context: any) => {
                        const chart = context.chart;
                        const area = chart?.chartArea;
                        if (!area) return "rgba(79, 70, 229, 0.9)";
                        return makeBarGradient(
                            chart.ctx,
                            area,
                            "rgba(79, 70, 229, 0.35)",
                            "rgba(79, 70, 229, 0.98)",
                        );
                    },
                    hoverBackgroundColor: "rgba(79, 70, 229, 1)",
                    borderColor: "rgba(79, 70, 229, 1)",
                    borderWidth: 0,
                    borderRadius: 6,
                    maxBarThickness: 18,
                },
                {
                    label: "Expense",
                    data: monthlyIncomeExpense.expense,
                    backgroundColor: (context: any) => {
                        const chart = context.chart;
                        const area = chart?.chartArea;
                        if (!area)
                            return theme === "dark"
                                ? "rgba(244, 63, 94, 0.55)"
                                : "rgba(244, 63, 94, 0.65)";
                        return makeBarGradient(
                            chart.ctx,
                            area,
                            theme === "dark"
                                ? "rgba(244, 63, 94, 0.22)"
                                : "rgba(244, 63, 94, 0.28)",
                            theme === "dark"
                                ? "rgba(244, 63, 94, 0.88)"
                                : "rgba(244, 63, 94, 0.92)",
                        );
                    },
                    hoverBackgroundColor:
                        theme === "dark"
                            ? "rgba(244, 63, 94, 0.98)"
                            : "rgba(244, 63, 94, 1)",
                    borderColor:
                        theme === "dark"
                            ? "rgba(244, 63, 94, 1)"
                            : "rgba(244, 63, 94, 1)",
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
                        color:
                            theme === "dark"
                                ? "rgba(229, 231, 235, 0.72)"
                                : "#64748b",
                        boxWidth: 10,
                        boxHeight: 10,
                    },
                },
                tooltip: {
                    backgroundColor:
                        theme === "dark"
                            ? "rgba(2, 6, 23, 0.92)"
                            : "rgba(15, 23, 42, 0.92)",
                    borderColor:
                        theme === "dark"
                            ? "rgba(148, 163, 184, 0.22)"
                            : "rgba(226, 232, 240, 0.65)",
                    borderWidth: 1,
                    titleColor: "rgba(248, 250, 252, 0.95)",
                    bodyColor: "rgba(248, 250, 252, 0.95)",
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
                        color:
                            theme === "dark"
                                ? "rgba(229, 231, 235, 0.72)"
                                : "#64748b",
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
                        color:
                            theme === "dark"
                                ? "rgba(229, 231, 235, 0.72)"
                                : "#64748b",
                        callback: (value: any) =>
                            `${Number(value).toLocaleString("vi-VN")}`,
                    },
                },
            },
        }),
        [theme],
    );

    const weeklyExpenseBarData = useMemo(() => {
        const end = now.endOf("week");
        const weeks = Array.from({ length: 8 }, (_, i) =>
            end.subtract(7 - i, "week").startOf("week"),
        );
        const labels = weeks.map((w) => {
            const s = w.startOf("week");
            const e = w.endOf("week");
            return `${s.format("D/M")}-${e.format("D/M")}`;
        });
        const data = weeks.map((w) => {
            const s = w.startOf("week");
            const e = w.endOf("week");
            return transactions
                .filter((t) => t.type === "EXPENSE")
                .reduce((acc, t) => {
                    const d = dayjs(t.date);
                    if (d.isAfter(s) && d.isBefore(e))
                        return acc + parseAmount(t.amount);
                    return acc;
                }, 0);
        });
        return {
            labels,
            datasets: [
                {
                    label: "Weekly Expenses",
                    data,
                    backgroundColor: (context: any) => {
                        const chart = context.chart;
                        const area = chart?.chartArea;
                        if (!area)
                            return theme === "dark"
                                ? "rgba(56, 189, 248, 0.55)"
                                : "rgba(56, 189, 248, 0.7)";
                        return makeBarGradient(
                            chart.ctx,
                            area,
                            theme === "dark"
                                ? "rgba(56, 189, 248, 0.22)"
                                : "rgba(56, 189, 248, 0.30)",
                            theme === "dark"
                                ? "rgba(56, 189, 248, 0.92)"
                                : "rgba(56, 189, 248, 0.98)",
                        );
                    },
                    hoverBackgroundColor:
                        theme === "dark"
                            ? "rgba(56, 189, 248, 1)"
                            : "rgba(56, 189, 248, 1)",
                    borderRadius: 6,
                    maxBarThickness: 18,
                },
            ],
        };
    }, [now, theme, transactions]);

    const payments = useMemo(() => {
        return [...txCurrent]
            .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
            .slice(0, 6)
            .map((t) => ({
                id: t._id,
                title: t.category || "Payment",
                date: formatDate(t.date),
                amount: `${t.type === "INCOME" ? "+" : "-"}${formatCurrency(parseAmount(t.amount))}`,
                status: t.type === "INCOME" ? "Paid" : "Due",
                statusType: t.type === "INCOME" ? "paid" : "due",
            }));
    }, [txCurrent]);

    const budgets = useMemo(() => {
        const items = expenseBreakdown.map((e) => {
            const budget = Math.max(e.value * 1.3, 1);
            return {
                name: e.name,
                spent: e.value,
                budget,
                color: e.color,
            };
        });
        return items.slice(0, 5);
    }, [expenseBreakdown]);

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
                    <h2 className="ekash_title">Dashboard</h2>
                    <p className="ekash_subtitle">
                        Welcome Ekash Finance Management
                    </p>
                </div>
                <div className="ekash_breadcrumb">
                    Home <span className="sep">›</span> Dashboard
                </div>
            </div>

            <div className="ekash_grid_4">
                {statCards.map((s) => (
                    <div key={s.label} className="ekash_card">
                        <div className="ekash_stat_label">{s.label}</div>
                        <div className="ekash_stat_value">{s.value}</div>
                        <div className="ekash_stat_delta">
                            <span className={`ekash_pill ${s.pillType}`}>
                                {s.pill}
                            </span>
                            <span>{s.note}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="ekash_grid_main">
                <div className="ekash_card ekash_chart_card">
                    <div className="ekash_card_header">
                        <div>
                            <p className="ekash_card_title">Balance Trends</p>
                            <div className="ekash_big_value">
                                {formatCurrency(
                                    dailyTrend.values[
                                        dailyTrend.values.length - 1
                                    ] || 0,
                                )}
                            </div>
                        </div>
                        <div className="ekash_card_hint">
                            Last Month <span className="sep">•</span>
                            <span
                                className={`ekash_pill ${periodChange.delta >= 0 ? "up" : "down"}`}
                            >
                                {`${Math.abs(periodChange.percent).toFixed(2)}%`}
                            </span>
                        </div>
                    </div>
                    <div className="ekash_chart" style={{ height: 220 }}>
                        <LineChart data={lineData} options={lineOptions} />
                    </div>
                </div>

                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">
                            Monthly Expenses Breakdown
                        </p>
                    </div>

                    <div className="ekash_breakdown_bar">
                        {expenseBreakdown.map((e) => (
                            <span
                                key={e.name}
                                className="seg"
                                style={{
                                    width: `${Math.max(e.percent, 3)}%`,
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
                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Monthly Budgets</p>
                        <span className="ekash_card_hint">This month</span>
                    </div>
                    <div className="ekash_budget_list">
                        {budgets.map((b) => {
                            const percent =
                                b.budget > 0
                                    ? Math.min((b.spent / b.budget) * 100, 100)
                                    : 0;
                            return (
                                <div className="ekash_budget_item" key={b.name}>
                                    <div className="ekash_budget_row">
                                        <div className="left">
                                            <span
                                                className="circle"
                                                style={{
                                                    backgroundColor: b.color,
                                                }}
                                            />
                                            <span className="name">
                                                {b.name}
                                            </span>
                                        </div>
                                        <div className="right">
                                            {Math.round(percent)}/{100}
                                        </div>
                                    </div>
                                    <div className="ekash_progress">
                                        <span
                                            className="bar"
                                            style={{
                                                width: `${percent}%`,
                                                backgroundColor: b.color,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="ekash_card ekash_chart_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">
                            Monthly Income vs Expenses
                        </p>
                        <span className="ekash_card_hint">10 months</span>
                    </div>
                    <div className="ekash_chart" style={{ height: 240 }}>
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
            </div>

            <div className="ekash_grid_2">
                <div className="ekash_card ekash_chart_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Weekly Expenses</p>
                        <span className="ekash_card_hint">Last 8 weeks</span>
                    </div>
                    <div className="ekash_chart" style={{ height: 220 }}>
                        <div
                            className="ekash_chart_bg"
                            style={{ height: "100%" }}
                        >
                            <BarChart
                                data={weeklyExpenseBarData}
                                options={barOptions}
                            />
                        </div>
                    </div>
                </div>

                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Payments History</p>
                        <span className="ekash_link">See more</span>
                    </div>

                    <div className="ekash_payments">
                        {payments.map((p) => (
                            <div key={p.id} className="ekash_payment_row">
                                <div className="left">
                                    <div className="title">{p.title}</div>
                                    <div className="date">{p.date}</div>
                                </div>
                                <div className="right">
                                    <div className="amount">{p.amount}</div>
                                    <span className={`status ${p.statusType}`}>
                                        {p.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {payments.length === 0 ? (
                            <div className="ekash_empty">Chưa có giao dịch</div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard_new;
