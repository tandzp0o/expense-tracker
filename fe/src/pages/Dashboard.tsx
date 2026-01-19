import { useMemo, useState, useEffect } from "react";
import {
    Card,
    Col,
    Row,
    Typography,
    Progress,
    Button,
    List,
    Tag,
    message,
    Spin,
} from "antd";
import { MenuUnfoldOutlined } from "@ant-design/icons";
import Paragraph from "antd/lib/typography/Paragraph";
import { walletApi, transactionApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { auth } from "../firebase/config";
import { useTheme } from "../contexts/ThemeContext";

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

const Dashboard = () => {
    const { Title, Text } = Typography;
    const { theme } = useTheme();
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [reverse, setReverse] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const parseAmount = (raw: unknown) => {
        if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
        if (typeof raw === "string") {
            const cleaned = raw.replace(/[^0-9.-]/g, "");
            const v = Number(cleaned);
            return Number.isFinite(v) ? v : 0;
        }
        return 0;
    };

    const fetchData = async () => {
        try {
            const firebaseUser = auth.currentUser;
            if (!firebaseUser) return;

            const token = await firebaseUser.getIdToken();

            const now = dayjs();
            const startDate = now
                .subtract(29, "day")
                .startOf("day")
                .toISOString();
            const endDate = now.endOf("day").toISOString();

            const [walletsRes, transactionsRes] = await Promise.all([
                walletApi.getWallets(token),
                transactionApi.getTransactions(
                    {
                        startDate,
                        endDate,
                    },
                    token,
                ),
            ]);

            setWallets(walletsRes?.wallets || []);
            const txs = transactionsRes?.data?.transactions || [];
            setAllTransactions(txs);
            setTransactions(txs.slice(0, 10));
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            message.error("Không thể tải dữ liệu");
        } finally {
            setLoading(false);
        }
    };

    // Statistics
    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    const incomeTransactions = allTransactions.filter(
        (t) => t.type === "INCOME",
    );
    const expenseTransactions = allTransactions.filter(
        (t) => t.type === "EXPENSE",
    );
    const totalIncome = incomeTransactions.reduce(
        (sum, t) => sum + parseAmount(t.amount),
        0,
    );
    const totalExpense = expenseTransactions.reduce(
        (sum, t) => sum + parseAmount(t.amount),
        0,
    );

    const weekRange = useMemo(() => {
        const now = dayjs();
        const monday = now.subtract((now.day() + 6) % 7, "day").startOf("day");
        const sunday = monday.add(6, "day").endOf("day");
        return { monday, sunday };
    }, []);

    const weekLabels = useMemo(() => {
        const labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
        return labels;
    }, []);

    const weeklyTotals = useMemo(() => {
        const totals = Array.from({ length: 7 }, () => ({
            income: 0,
            expense: 0,
        }));

        allTransactions.forEach((t) => {
            const d = dayjs(t.date);
            if (d.isBefore(weekRange.monday) || d.isAfter(weekRange.sunday)) {
                return;
            }

            const idx = (d.day() + 6) % 7;
            if (t.type === "INCOME")
                totals[idx].income += parseAmount(t.amount);
            if (t.type === "EXPENSE")
                totals[idx].expense += parseAmount(t.amount);
        });

        return totals;
    }, [allTransactions, weekRange.monday, weekRange.sunday]);

    const barChartDataFromBe = useMemo(
        () => ({
            labels: weekLabels,
            datasets: [
                {
                    label: "Chi tiêu",
                    data: weeklyTotals.map((d) => d.expense),
                    backgroundColor: "#f59e0b",
                    borderRadius: 5,
                    maxBarThickness: 22,
                },
                {
                    label: "Thu nhập",
                    data: weeklyTotals.map((d) => d.income),
                    backgroundColor: "#14b8a6",
                    borderRadius: 5,
                    maxBarThickness: 22,
                },
            ],
        }),
        [weekLabels, weeklyTotals],
    );

    const barChartOptionsFromBe = useMemo(
        () => ({
            color: theme === "dark" ? "#e5e7eb" : "#0f172a",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top" as const,
                    labels: {
                        color: theme === "dark" ? "#cbd5e1" : "#475569",
                        usePointStyle: true,
                    },
                },
                tooltip: {
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
                        color: theme === "dark" ? "#cbd5e1" : "#64748b",
                        maxRotation: 0,
                        autoSkip: false,
                        maxTicksLimit: 7,
                    },
                },
                y: {
                    grid: {
                        display: true,
                        color:
                            theme === "dark"
                                ? "rgba(148, 163, 184, 0.18)"
                                : "rgba(15, 23, 42, 0.10)",
                        borderDash: [2, 2],
                    },
                    ticks: {
                        color: theme === "dark" ? "#cbd5e1" : "#64748b",
                        callback: (value: any) =>
                            `${Number(value).toLocaleString("vi-VN")}`,
                    },
                    title: {
                        display: true,
                        text: "Số tiền (VND)",
                        color: theme === "dark" ? "#cbd5e1" : "#64748b",
                    },
                },
            },
        }),
        [theme],
    );

    const topExpenseCategories = useMemo(() => {
        const categories: Record<string, number> = {};
        allTransactions
            .filter((t) => t.type === "EXPENSE")
            .forEach((t) => {
                const key = t.category || "Khác";
                categories[key] =
                    (categories[key] || 0) + parseAmount(t.amount);
            });

        return Object.entries(categories)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
    }, [allTransactions]);

    const topExpenseChartData = useMemo(
        () => ({
            labels: topExpenseCategories.map(([name]) => name),
            datasets: [
                {
                    label: "Chi tiêu",
                    data: topExpenseCategories.map(([, total]) => total),
                    backgroundColor: "rgba(245, 158, 11, 0.9)",
                    borderRadius: 8,
                    maxBarThickness: 18,
                },
            ],
        }),
        [topExpenseCategories],
    );

    const topExpenseChartOptions = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y" as const,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            const value =
                                typeof context.parsed?.x === "number"
                                    ? context.parsed.x
                                    : 0;
                            return `${value.toLocaleString("vi-VN")} VND`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: {
                        display: true,
                        color:
                            theme === "dark"
                                ? "rgba(148, 163, 184, 0.18)"
                                : "rgba(15, 23, 42, 0.10)",
                        borderDash: [2, 2],
                    },
                    ticks: {
                        color: theme === "dark" ? "#cbd5e1" : "#64748b",
                        callback: (value: any) =>
                            `${Number(value).toLocaleString("vi-VN")}`,
                    },
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: theme === "dark" ? "#cbd5e1" : "#475569",
                    },
                },
            },
        }),
        [theme],
    );

    const dollor = [
        <svg
            width="22"
            height="22"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            key={0}
        >
            <path
                d="M8.43338 7.41784C8.58818 7.31464 8.77939 7.2224 9 7.15101L9.00001 8.84899C8.77939 8.7776 8.58818 8.68536 8.43338 8.58216C8.06927 8.33942 8 8.1139 8 8C8 7.8861 8.06927 7.66058 8.43338 7.41784Z"
                fill="#fff"
            ></path>
            <path
                d="M11 12.849L11 11.151C11.2206 11.2224 11.4118 11.3146 11.5666 11.4178C11.9308 11.6606 12 11.8861 12 12C12 12.1139 11.9308 12.3394 11.5666 12.5822C11.4118 12.6854 11.2206 12.7776 11 12.849Z"
                fill="#fff"
            ></path>
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18ZM11 5C11 4.44772 10.5523 4 10 4C9.44772 4 9 4.44772 9 5V5.09199C8.3784 5.20873 7.80348 5.43407 7.32398 5.75374C6.6023 6.23485 6 7.00933 6 8C6 8.99067 6.6023 9.76515 7.32398 10.2463C7.80348 10.5659 8.37841 10.7913 9.00001 10.908L9.00002 12.8492C8.60902 12.7223 8.31917 12.5319 8.15667 12.3446C7.79471 11.9275 7.16313 11.8827 6.74599 12.2447C6.32885 12.6067 6.28411 13.2382 6.64607 13.6554C7.20855 14.3036 8.05956 14.7308 9 14.9076L9 15C8.99999 15.5523 9.44769 16 9.99998 16C10.5523 16 11 15.5523 11 15L11 14.908C11.6216 14.7913 12.1965 14.5659 12.676 14.2463C13.3977 13.7651 14 12.9907 14 12C14 11.0093 13.3977 10.2348 12.676 9.75373C12.1965 9.43407 11.6216 9.20873 11 9.09199L11 7.15075C11.391 7.27771 11.6808 7.4681 11.8434 7.65538C12.2053 8.07252 12.8369 8.11726 13.254 7.7553C13.6712 7.39335 13.7159 6.76176 13.354 6.34462C12.7915 5.69637 11.9405 5.26915 11 5.09236V5Z"
                fill="#fff"
            ></path>
        </svg>,
    ];

    const profile = [
        <svg
            width="22"
            height="22"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            key={0}
        >
            <path
                d="M9 6C9 7.65685 7.65685 9 6 9C4.34315 9 3 7.65685 3 6C3 4.34315 4.34315 3 6 3C7.65685 3 9 4.34315 9 6Z"
                fill="#fff"
            ></path>
            <path
                d="M17 6C17 7.65685 15.6569 9 14 9C12.3431 9 11 7.65685 11 6C11 4.34315 12.3431 3 14 3C15.6569 3 17 4.34315 17 6Z"
                fill="#fff"
            ></path>
            <path
                d="M12.9291 17C12.9758 16.6734 13 16.3395 13 16C13 14.3648 12.4393 12.8606 11.4998 11.6691C12.2352 11.2435 13.0892 11 14 11C16.7614 11 19 13.2386 19 16V17H12.9291Z"
                fill="#fff"
            ></path>
            <path
                d="M6 11C8.76142 11 11 13.2386 11 16V17H1V16C1 13.2386 3.23858 11 6 11Z"
                fill="#fff"
            ></path>
        </svg>,
    ];

    const heart = [
        <svg
            width="22"
            height="22"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            key={0}
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.17157 5.17157C4.73367 3.60948 7.26633 3.60948 8.82843 5.17157L10 6.34315L11.1716 5.17157C12.7337 3.60948 15.2663 3.60948 16.8284 5.17157C18.3905 6.73367 18.3905 9.26633 16.8284 10.8284L10 17.6569L3.17157 10.8284C1.60948 9.26633 1.60948 6.73367 3.17157 5.17157Z"
                fill="#fff"
            ></path>
        </svg>,
    ];

    const cart = [
        <svg
            width="22"
            height="22"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            key={0}
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10 2C7.79086 2 6 3.79086 6 6V7H5C4.49046 7 4.06239 7.38314 4.00612 7.88957L3.00612 16.8896C2.97471 17.1723 3.06518 17.455 3.25488 17.6669C3.44458 17.8789 3.71556 18 4 18H16C16.2844 18 16.5554 17.8789 16.7451 17.6669C16.9348 17.455 17.0253 17.1723 16.9939 16.8896L15.9939 7.88957C15.9376 7.38314 15.5096 7 15 7H14V6C14 3.79086 12.2091 2 10 2ZM12 7V6C12 4.89543 11.1046 4 10 4C8.89543 4 8 4.89543 8 6V7H12ZM6 10C6 9.44772 6.44772 9 7 9C7.55228 9 8 9.44772 8 10C8 10.5523 7.55228 11 7 11C6.44772 11 6 10.5523 6 10ZM13 9C12.4477 9 12 9.44772 12 10C12 10.5523 12.4477 11 13 11C13.5523 11 14 10.5523 14 10C14 9.44772 13.5523 9 13 9Z"
                fill="#fff"
            ></path>
        </svg>,
    ];

    const count = [
        {
            today: "Tổng số dư",
            title: formatCurrency(totalBalance),
            persent: `${wallets.length} ví`,
            icon: dollor,
            bnb: "bnb2",
        },
        {
            today: "Tổng thu nhập",
            title: formatCurrency(totalIncome),
            persent: `${incomeTransactions.length} ghi chép`,
            icon: profile,
            bnb: "bnb2",
        },
        {
            today: "Tổng chi tiêu",
            title: formatCurrency(totalExpense),
            persent: `${expenseTransactions.length} ghi chép`,
            icon: heart,
            bnb: "redtext",
        },
        {
            today: "Giao dịch gần đây",
            title: allTransactions.length.toString(),
            persent: "trong 30 ngày",
            icon: cart,
            bnb: "bnb2",
        },
    ];

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "50px" }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <>
            <div className="layout-content">
                {/* Statistics Cards */}
                <Row className="rowgap-vbox" gutter={[24, 0]}>
                    {count.map((c, index) => (
                        <Col
                            key={index}
                            xs={24}
                            sm={24}
                            md={12}
                            lg={6}
                            xl={6}
                            className="mb-24"
                        >
                            <Card bordered={false} className="criclebox">
                                <div className="number">
                                    <Row align="middle" gutter={[24, 0]}>
                                        <Col xs={18}>
                                            <span>{c.today}</span>
                                            <Title
                                                level={3}
                                                className="dashboard-stat-title"
                                            >
                                                <span
                                                    className="dashboard-stat-amount"
                                                    title={c.title}
                                                >
                                                    {c.title}
                                                </span>
                                                <small className={c.bnb}>
                                                    {c.persent}
                                                </small>
                                            </Title>
                                        </Col>
                                        <Col xs={6}>
                                            <div className="icon-box">
                                                {c.icon}
                                            </div>
                                        </Col>
                                    </Row>
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>

                {/* Charts Section */}
                <Row gutter={[24, 0]}>
                    <Col
                        xs={24}
                        sm={24}
                        md={24}
                        lg={24}
                        xl={16}
                        className="mb-24"
                    >
                        <Card
                            bordered={false}
                            className="criclebox cardbody h-full"
                        >
                            <div className="linechart">
                                <div>
                                    <Title level={5}>
                                        Phân tích thu/chi theo tuần
                                    </Title>
                                    <Paragraph
                                        className="lastweek"
                                        style={{ marginBottom: 0 }}
                                    >
                                        Tuần này (T2 - CN)
                                    </Paragraph>
                                </div>
                            </div>
                            <div style={{ height: 260 }}>
                                <BarChart
                                    data={barChartDataFromBe}
                                    options={barChartOptionsFromBe}
                                />
                            </div>
                        </Card>
                    </Col>

                    <Col
                        xs={24}
                        sm={24}
                        md={24}
                        lg={24}
                        xl={8}
                        className="mb-24"
                    >
                        <Card bordered={false} className="criclebox h-full">
                            <Title level={5} style={{ marginBottom: 0 }}>
                                Top danh mục chi
                            </Title>
                            <Paragraph
                                className="lastweek"
                                style={{ marginBottom: 16 }}
                            >
                                6 danh mục cao nhất (30 ngày gần nhất)
                            </Paragraph>
                            <div style={{ height: 260 }}>
                                <BarChart
                                    data={topExpenseChartData}
                                    options={topExpenseChartOptions}
                                />
                            </div>
                        </Card>
                    </Col>
                </Row>

                {/* Recent Transactions Section */}
                <Row gutter={[24, 0]}>
                    <Col
                        xs={24}
                        sm={24}
                        md={12}
                        lg={12}
                        xl={16}
                        className="mb-24"
                    >
                        <Card
                            bordered={false}
                            className="criclebox cardbody h-full"
                            title={
                                <div className="dashboard-card-header">
                                    <div>
                                        <Title
                                            level={5}
                                            style={{ marginBottom: 0 }}
                                        >
                                            Lịch sử giao dịch gần đây
                                        </Title>
                                        <Paragraph
                                            className="lastweek"
                                            style={{ marginBottom: 0 }}
                                        >
                                            10 giao dịch mới nhất
                                        </Paragraph>
                                    </div>
                                    <Button
                                        type="text"
                                        className="dashboard-sort-btn"
                                        icon={<MenuUnfoldOutlined />}
                                        onClick={() => setReverse(!reverse)}
                                    />
                                </div>
                            }
                        >
                            <List
                                className={`transactions-list ${reverse ? "ant-newest" : ""}`}
                                itemLayout="horizontal"
                                dataSource={[...transactions]
                                    .sort((a, b) =>
                                        reverse
                                            ? dayjs(a.date).valueOf() -
                                              dayjs(b.date).valueOf()
                                            : dayjs(b.date).valueOf() -
                                              dayjs(a.date).valueOf(),
                                    )
                                    .slice(0, 10)}
                                renderItem={(t) => (
                                    <List.Item>
                                        <List.Item.Meta
                                            title={
                                                <div className="tx-title-row">
                                                    <span>
                                                        {t.category ||
                                                            "Giao dịch"}
                                                    </span>
                                                    <Tag
                                                        color={
                                                            t.type === "INCOME"
                                                                ? "green"
                                                                : "red"
                                                        }
                                                    >
                                                        {t.type === "INCOME"
                                                            ? "Thu"
                                                            : "Chi"}
                                                    </Tag>
                                                </div>
                                            }
                                            description={
                                                t.walletId?.name
                                                    ? `${formatDate(t.date)} • ${t.walletId.name}`
                                                    : formatDate(t.date)
                                            }
                                        />
                                        <div
                                            className={`amount ${
                                                t.type === "INCOME"
                                                    ? "text-success"
                                                    : "text-danger"
                                            }`}
                                        >
                                            {`${t.type === "INCOME" ? "+" : "-"} ${formatCurrency(parseAmount(t.amount))}`}
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </Col>

                    {/* Wallets Section */}
                    <Col
                        xs={24}
                        sm={24}
                        md={12}
                        lg={12}
                        xl={8}
                        className="mb-24"
                    >
                        <Card
                            bordered={false}
                            className="criclebox h-full"
                            title={
                                <h6 className="font-semibold m-0">
                                    Các ví của bạn
                                </h6>
                            }
                        >
                            <div className="wallet-list">
                                {wallets.length > 0 ? (
                                    wallets.map((wallet) => (
                                        <div
                                            key={wallet._id}
                                            className="wallet-item"
                                            style={{ marginBottom: "15px" }}
                                        >
                                            <Row
                                                justify="space-between"
                                                align="middle"
                                            >
                                                <Col>
                                                    <Text strong>
                                                        {wallet.name}
                                                    </Text>
                                                </Col>
                                                <Col>
                                                    <Text
                                                        className="text-success"
                                                        strong
                                                    >
                                                        {formatCurrency(
                                                            wallet.balance,
                                                        )}
                                                    </Text>
                                                </Col>
                                            </Row>
                                            <Progress
                                                percent={
                                                    totalBalance > 0
                                                        ? Math.min(
                                                              Math.max(
                                                                  Math.round(
                                                                      ((wallet.balance /
                                                                          totalBalance) *
                                                                          100) /
                                                                          0.1,
                                                                  ) * 0.1,
                                                                  0,
                                                              ),
                                                              100,
                                                          )
                                                        : 0
                                                }
                                                size="small"
                                                status="active"
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <Text type="secondary">
                                        Không có ví nào
                                    </Text>
                                )}
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>
        </>
    );
};

export default Dashboard;
