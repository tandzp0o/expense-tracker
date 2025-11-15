import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
    Card,
    Row,
    Col,
    Statistic,
    Typography,
    List,
    Tag,
    Spin,
    Empty,
    message,
    Button,
    Progress,
    Space,
} from "antd";
import {
    ErrorBoundary,
    FallbackProps,
    useErrorBoundary,
} from "react-error-boundary";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FileExcelOutlined, FilePdfOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { walletApi, transactionApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
    ArrowUpOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined as IncomeIcon,
    ArrowDownOutlined as ExpenseIcon,
    WalletOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase/config"; // <-- ĐÃ THÊM

dayjs.locale("vi");

interface Transaction {
    _id: string;
    type: "INCOME" | "EXPENSE";
    amount: number;
    category: string;
    date: string;
    note?: string;
    walletId?: {
        _id: string;
        name: string;
    };
    walletName?: string;
}

interface DashboardStats {
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    incomeChange: number;
    expenseChange: number;
}

interface CategoryStat {
    _id: string;
    name: string;
    total: number;
    color: string;
    percentage?: number;
}

interface LoadingState {
    stats: boolean;
    transactions: boolean;
    categories: boolean;
    wallets: boolean;
}

const { Title, Text } = Typography;

// Error Fallback Component
const ErrorFallback: React.FC<FallbackProps> = ({
    error,
    resetErrorBoundary,
}) => {
    return (
        <div
            style={{
                padding: "24px",
                textAlign: "center",
                maxWidth: "600px",
                margin: "40px auto",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
        >
            <Title level={3} style={{ color: "#ff4d4f", marginBottom: "16px" }}>
                Đã xảy ra lỗi
            </Title>
            <div
                style={{
                    background: "#fff2f0",
                    padding: "16px",
                    borderRadius: "4px",
                    marginBottom: "20px",
                    textAlign: "left",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                }}
            >
                {error.message || "Không có thông tin lỗi"}
            </div>
            <Button
                type="primary"
                onClick={resetErrorBoundary}
                icon={<ArrowDownOutlined />}
            >
                Tải lại trang
            </Button>
        </div>
    );
};

const exportToExcel = (recentTransactions: Transaction[]) => {
    // Tạo dữ liệu cho Excel
    const data = recentTransactions.map((trans) => ({
        Ngày: dayjs(trans.date).format("DD/MM/YYYY"),
        Loại: trans.type === "INCOME" ? "Thu nhập" : "Chi tiêu",
        "Danh mục": trans.category,
        "Số tiền": trans.amount.toLocaleString("vi-VN"),
        "Ghi chú": trans.note || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Giao dịch");
    XLSX.writeFile(
        wb,
        `bao-cao-giao-dich-${dayjs().format("DD-MM-YYYY")}.xlsx`
    );
};

const exportToPdf = async () => {
    const input = document.getElementById("dashboard-content");
    if (!input) return;

    const canvas = await (html2canvas as any)(input, {
        scale: window.devicePixelRatio,
        useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }

    pdf.save(`bao-cao-${dayjs().format("DD-MM-YYYY")}.pdf`);
};

const DashboardContent: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState<LoadingState>({
        stats: true,
        transactions: true,
        categories: true,
        wallets: true,
    });

    const [stats, setStats] = useState<DashboardStats>({
        totalBalance: 0,
        totalIncome: 0,
        totalExpense: 0,
        incomeChange: 0,
        expenseChange: 0,
    });

    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
        []
    );
    const [expenseByCategory, setExpenseByCategory] = useState<CategoryStat[]>(
        []
    );
    const { currentUser } = useAuth();
    const [currentDate] = useState<Date>(new Date());
    const { showBoundary } = useErrorBoundary();

    const fetchDashboardData = useCallback(async () => {
        if (!currentUser) return;

        // BẮT ĐẦU CẬP NHẬT: LẤY TOKEN THEO CÁCH MỚI
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            message.error("Xác thực người dùng thất bại. Vui lòng tải lại trang.");
            setIsLoading({ stats: false, transactions: false, categories: false, wallets: false });
            return;
        }
        // KẾT THÚC CẬP NHẬT

        try {
            setIsLoading({
                stats: true,
                transactions: true,
                categories: true,
                wallets: true,
            });

            const month = currentDate.getMonth() + 1;
            const year = currentDate.getFullYear();
            const token = await firebaseUser.getIdToken(); // <-- ĐÃ THAY ĐỔI

            // Fetch data in parallel
            const [walletsData, statsData, transactionsData, categoriesData] =
                await Promise.all([
                    walletApi.getWallets(token),
                    transactionApi.getDashboardStats(month, year, token),
                    transactionApi.getTransactions(
                        {
                            limit: 5,
                            sort: "-date",
                        },
                        token
                    ),
                    transactionApi.getExpenseByCategory(month, year, token),
                ]);

            // Update states with the fetched data
            const totalBalance = walletsData?.totalBalance || 0;
            const totalIncome = statsData?.totalIncome || 0;
            const totalExpense = statsData?.totalExpense || 0;

            setStats({
                totalBalance,
                totalIncome,
                totalExpense,
                incomeChange: 0,
                expenseChange: 0,
            });

            setRecentTransactions(
                transactionsData?.data?.transactions?.map((t: any) => ({
                    ...t,
                    walletName: t.walletId?.name || "Unknown",
                })) || []
            );

            const totalExpenseForCategories = (
                categoriesData?.data || []
            ).reduce((sum: number, cat: any) => sum + (cat.total || 0), 0);

            setExpenseByCategory(
                (categoriesData?.data || []).map((cat: any) => ({
                    ...cat,
                    color: getCategoryColor(cat._id),
                    percentage:
                        totalExpenseForCategories > 0
                            ? Math.round(
                                  (cat.total / totalExpenseForCategories) * 100
                              )
                            : 0,
                }))
            );
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu dashboard:", error);
            showBoundary(error);
        } finally {
            setIsLoading({
                stats: false,
                transactions: false,
                categories: false,
                wallets: false,
            });
        }
    }, [currentUser, currentDate, showBoundary]);

    const getCategoryColor = useCallback((categoryId: string): string => {
        const colors = [
            "#1890ff", "#52c41a", "#faad14", "#f5222d", "#722ed1",
            "#13c2c2", "#fa8c16", "#eb2f96", "#2f54eb", "#fa541c",
        ];
        const index =
            categoryId
                .split("")
                .reduce((acc, char) => acc + char.charCodeAt(0), 0) %
            colors.length;
        return colors[index];
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const isLoadingAny = useMemo(
        () => Object.values(isLoading).some((loading) => loading),
        [isLoading]
    );

    if (isLoadingAny) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "60vh",
                }}
            >
                <Spin size="large" tip="Đang tải dữ liệu..." spinning={true}>
                    <div
                        style={{
                            padding: "50px",
                            background: "rgba(0, 0, 0, 0.05)",
                            borderRadius: "4px",
                        }}
                    />
                </Spin>
            </div>
        );
    }

    return (
        <div className="dashboard" style={{ padding: "24px" }}>
            <div
                className="page-header"
                style={{
                    marginBottom: "24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        Tổng quan
                    </Title>
                    <Text type="secondary">
                        {dayjs().format("dddd, D MMMM YYYY")}
                    </Text>
                </div>

                <Space>
                    <Button
                        type="primary"
                        icon={<FileExcelOutlined />}
                        onClick={() => exportToExcel(recentTransactions)}
                        disabled={recentTransactions.length === 0}
                    >
                        Xuất Excel
                    </Button>
                    <Button
                        type="primary"
                        danger
                        icon={<FilePdfOutlined />}
                        onClick={exportToPdf}
                        disabled={recentTransactions.length === 0}
                    >
                        Xuất PDF
                    </Button>
                </Space>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
                }
                .print-only { display: none; }
                @media print { .print-only { display: block; } }
            `}</style>

            <div className="print-only" style={{ textAlign: "center", marginBottom: "20px" }}>
                <h2>Báo cáo tài chính</h2>
                <p>Ngày xuất: {dayjs().format("DD/MM/YYYY HH:mm")}</p>
            </div>

            <div id="dashboard-content">
                <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
                    <Col xs={24} sm={12} lg={6}>
                        <Card>
                            <Statistic
                                title="Tổng số dư"
                                value={stats.totalBalance}
                                precision={0}
                                valueStyle={{ color: "#1890ff" }}
                                prefix={<WalletOutlined />}
                                formatter={(value) =>
                                    formatCurrency(value as number)
                                }
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card>
                            <Statistic
                                title="Tổng thu nhập tháng"
                                value={stats.totalIncome}
                                precision={0}
                                valueStyle={{ color: "#52c41a" }}
                                prefix={<IncomeIcon />}
                                formatter={(value) =>
                                    formatCurrency(value as number)
                                }
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card>
                            <Statistic
                                title="Tổng chi tiêu tháng"
                                value={stats.totalExpense}
                                precision={0}
                                valueStyle={{ color: "#f5222d" }}
                                prefix={<ExpenseIcon />}
                                formatter={(value) =>
                                    formatCurrency(value as number)
                                }
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card>
                            <Statistic
                                title="Thu chi tháng"
                                value={stats.totalIncome - stats.totalExpense}
                                precision={0}
                                valueStyle={{ color: (stats.totalIncome - stats.totalExpense) >= 0 ? "#52c41a" : "#f5222d" }}
                                formatter={(value) =>
                                    formatCurrency(value as number)
                                }
                            />
                        </Card>
                    </Col>
                </Row>

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={16}>
                        <Card
                            title="Giao dịch gần đây"
                            extra={<Button type="link" onClick={() => navigate('/transactions')}>Xem tất cả</Button>}
                        >
                            {recentTransactions.length > 0 ? (
                                <List
                                    itemLayout="horizontal"
                                    dataSource={recentTransactions}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <List.Item.Meta
                                                avatar={
                                                    <div style={{
                                                        width: 40, height: 40, borderRadius: "50%",
                                                        background: item.type === "INCOME" ? "#e6f7ff" : "#fff1f0",
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                    }}>
                                                        {item.type === "INCOME" ? <IncomeIcon style={{ color: "#52c41a" }} /> : <ExpenseIcon style={{ color: "#f5222d" }} />}
                                                    </div>
                                                }
                                                title={
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>{item.category}</span>
                                                        <span style={{ color: item.type === "INCOME" ? "#52c41a" : "#f5222d", fontWeight: 500 }}>
                                                            {item.type === "INCOME" ? "+" : "-"}
                                                            {formatCurrency(item.amount)}
                                                        </span>
                                                    </div>
                                                }
                                                description={
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>
                                                            {item.walletName && <Tag color="blue" style={{ marginRight: 8 }}>{item.walletName}</Tag>}
                                                            {item.note}
                                                        </span>
                                                        <span style={{ color: "rgba(0, 0, 0, 0.45)" }}>
                                                            {formatDate(item.date)}
                                                        </span>
                                                    </div>
                                                }
                                            />
                                        </List.Item>
                                    )}
                                />
                            ) : (
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có giao dịch gần đây" />
                            )}
                        </Card>
                    </Col>

                    <Col xs={24} lg={8}>
                        <Card title="Chi tiêu tháng theo danh mục">
                            {expenseByCategory.length > 0 ? (
                                <div>
                                    {expenseByCategory.map((category) => (
                                        <div key={category._id} style={{ marginBottom: 16 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                <span>{category.name}</span>
                                                <span>{formatCurrency(category.total)}</span>
                                            </div>
                                            <Progress
                                                percent={category.percentage}
                                                showInfo={true}
                                                strokeColor={category.color}
                                                format={(percent) => `${percent}%`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dữ liệu chi tiêu" />
                            )}
                        </Card>
                    </Col>
                </Row>
            </div>
        </div>
    );
};

// Wrap the Dashboard with ErrorBoundary
const Dashboard: React.FC = () => {
    return (
        <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => window.location.reload()}
        >
            <DashboardContent />
        </ErrorBoundary>
    );
};

export default Dashboard;