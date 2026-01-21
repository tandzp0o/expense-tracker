import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
    DatePicker,
    Input,
    InputNumber,
    Modal,
    Select,
    Spin,
    message,
} from "antd";
import { RangePickerProps } from "antd/es/date-picker";
import { auth } from "../firebase/config";
import { transactionApi, walletApi, goalApi, budgetApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import AlertNotification from "../components/AlertNotification";

dayjs.locale("vi");

type TransactionType = "INCOME" | "EXPENSE" | "GOAL_DEPOSIT" | "GOAL_WITHDRAW";

interface Wallet {
    _id: string;
    name: string;
    balance: number;
}

interface Transaction {
    _id: string;
    walletId: string | { _id: string; name?: string };
    type: TransactionType;
    amount: number | string;
    category: string;
    date: string;
    note?: string;
    budgetId?: string;
    goalId?: string;
}

const categories = [
    { type: "INCOME" as const, name: "Lương" },
    { type: "INCOME" as const, name: "Thưởng" },
    { type: "INCOME" as const, name: "Đầu tư" },
    { type: "INCOME" as const, name: "Khác" },
    { type: "EXPENSE" as const, name: "Ăn uống" },
    { type: "EXPENSE" as const, name: "Mua sắm" },
    { type: "EXPENSE" as const, name: "Hóa đơn" },
    { type: "EXPENSE" as const, name: "Giải trí" },
    { type: "EXPENSE" as const, name: "Y tế" },
    { type: "EXPENSE" as const, name: "Khác" },
];

const moneyFormatter = (value: any) =>
    `${value ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const moneyParser = (value: any) =>
    value ? Number(String(value).replace(/[^0-9.-]+/g, "")) : 0;

const Transactions_new: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [budgets, setBudgets] = useState<any[]>([]);
    const [goals, setGoals] = useState<any[]>([]);

    const [activeId, setActiveId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const transactionsPerPage = 10;
    const [dateRange, setDateRange] = useState<
        [dayjs.Dayjs, dayjs.Dayjs] | null
    >(null);
    const [selectedPeriod, setSelectedPeriod] =
        useState<string>("current_month");

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Transaction | null>(null);

    const [formType, setFormType] = useState<TransactionType>("EXPENSE");
    const [formWalletId, setFormWalletId] = useState<string>("");
    const [formCategory, setFormCategory] = useState<string>("");
    const [formAmount, setFormAmount] = useState<number>(0);
    const [formDate, setFormDate] = useState<string>(dayjs().toISOString());
    const [formNote, setFormNote] = useState<string>("");
    const [formBudgetId, setFormBudgetId] = useState<string>("");
    const [formGoalId, setFormGoalId] = useState<string>("");
    const [selectedBudgetOrCategory, setSelectedBudgetOrCategory] =
        useState<string>(""); // For unified dropdown
    const [modalSource, setModalSource] = useState<
        "regular" | "savings" | "edit"
    >("regular"); // Track modal source
    const [alertVisible, setAlertVisible] = useState(false);
    const [transactionToDelete, setTransactionToDelete] =
        useState<Transaction | null>(null);

    const parseAmount = (raw: unknown) => {
        if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
        if (typeof raw === "string") {
            const cleaned = raw.replace(/[^0-9.-]/g, "");
            const v = Number(cleaned);
            return Number.isFinite(v) ? v : 0;
        }
        return 0;
    };

    const getToken = useCallback(async () => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            message.error("Người dùng chưa được xác thực");
            return null;
        }
        return firebaseUser.getIdToken();
    }, []);

    const getDateRange = useCallback(() => {
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
            case "current_week":
                return {
                    start: now.startOf("week"),
                    end: now.endOf("week"),
                };
            case "last_week":
                return {
                    start: now.subtract(1, "week").startOf("week"),
                    end: now.subtract(1, "week").endOf("week"),
                };
            case "custom":
                if (dateRange) {
                    return {
                        start: dateRange[0].startOf("day"),
                        end: dateRange[1].endOf("day"),
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
    }, [selectedPeriod, dateRange]);

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const token = await getToken();
            if (!token) return;

            const range = getDateRange();
            const startDate = range.start.toISOString();
            const endDate = range.end.toISOString();

            const [walletRes, txRes, budgetRes, goalRes] = await Promise.all([
                walletApi.getWallets(token),
                transactionApi.getTransactions(
                    {
                        startDate,
                        endDate,
                        sort: "-date",
                        limit: 500,
                    },
                    token,
                ),
                budgetApi.getBudgetSummary(
                    { month: dayjs().month() + 1, year: dayjs().year() },
                    token,
                ),
                goalApi.getGoals(token),
            ]);

            const w = walletRes?.wallets ?? [];
            setWallets(w);

            const tx = txRes?.data?.transactions ?? [];
            setTransactions(tx);
            setActiveId((prev) => prev || (tx[0]?._id ?? null));
            setBudgets(
                Array.isArray(budgetRes) ? budgetRes : budgetRes?.items || [],
            );
            setGoals(Array.isArray(goalRes) ? goalRes : []);
        } catch (e) {
            console.error(e);
            message.error("Không thể tải dữ liệu giao dịch");
        } finally {
            setLoading(false);
        }
    }, [getToken, getDateRange]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]); // Giờ an toàn vì fetchAll stable

    // Reset trang khi thay đổi khoảng thời gian
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedPeriod, dateRange]);

    const handlePeriodChange = (value: string) => {
        setSelectedPeriod(value);
        if (value !== "custom") {
            setDateRange(null);
        }
    };

    const handleDateRangeChange = (dates: any) => {
        if (dates && dates.length === 2) {
            setDateRange([dates[0], dates[1]]);
            setSelectedPeriod("custom");
        }
    };

    const handleBackToCurrent = () => {
        setSelectedPeriod("current_month");
        setDateRange(null);
    };

    const getPeriodDisplayText = () => {
        const range = getDateRange();
        return `${range.start.format("DD/MM/YYYY")} - ${range.end.format("DD/MM/YYYY")}`;
    };

    // Logic phân trang
    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * transactionsPerPage;
        const endIndex = startIndex + transactionsPerPage;
        return transactions.slice(startIndex, endIndex);
    }, [transactions, currentPage]);

    useEffect(() => {
        const total = Math.ceil(transactions.length / transactionsPerPage);
        setTotalPages(total);
        if (currentPage > total && total > 0) {
            setCurrentPage(1);
        }
    }, [transactions.length, currentPage]);

    const selected = useMemo(
        () => transactions.find((t) => t._id === activeId) || null,
        [transactions, activeId],
    );

    const walletName = (tx: Transaction) => {
        const wId =
            typeof tx.walletId === "string" ? tx.walletId : tx.walletId?._id;
        const w = wallets.find((x) => x._id === wId);
        return w?.name || "-";
    };

    const resetForm = () => {
        setFormType("EXPENSE");
        setFormWalletId(wallets[0]?._id ?? "");
        setFormCategory("");
        setFormAmount(0);
        setFormDate(dayjs().toISOString());
        setFormNote("");
        setFormBudgetId("");
        setFormGoalId("");
        setSelectedBudgetOrCategory("");
        setModalSource("regular");
    };

    const openCreate = () => {
        setEditing(null);
        resetForm();
        setModalSource("regular");
        setModalOpen(true);
    };

    const openRegularTransaction = () => {
        setEditing(null);
        resetForm();
        setFormType("EXPENSE"); // Default to EXPENSE for regular transactions
        setModalSource("regular");
        setModalOpen(true);
    };

    const openSavings = () => {
        setEditing(null);
        resetForm();
        setFormType("GOAL_DEPOSIT");
        setFormCategory("Tiết kiệm");
        setModalSource("savings");
        setModalOpen(true);
    };

    const openEdit = (tx: Transaction) => {
        setEditing(tx);
        setFormType(tx.type);
        const wId =
            typeof tx.walletId === "string" ? tx.walletId : tx.walletId?._id;
        setFormWalletId(wId || "");
        setFormCategory(tx.category || "");
        setFormAmount(parseAmount(tx.amount));
        setFormDate(
            tx.date ? dayjs(tx.date).toISOString() : dayjs().toISOString(),
        );
        setFormNote(tx.note || "");
        setFormBudgetId(tx.budgetId || "");
        setFormGoalId(tx.goalId || "");

        // Set unified selection
        if (tx.budgetId) {
            setSelectedBudgetOrCategory(tx.budgetId);
        } else if (tx.type === "EXPENSE") {
            setSelectedBudgetOrCategory("other");
        } else {
            setSelectedBudgetOrCategory("");
        }

        setModalSource("edit");
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (!formWalletId) {
                message.error("Vui lòng chọn ví");
                return;
            }
            // Validation based on transaction type
            if (formType === "GOAL_DEPOSIT" || formType === "GOAL_WITHDRAW") {
                // chỉ hiển thị 2 option của goal thay vì có cả expense và income
                if (!formGoalId) {
                    message.error("Vui lòng chọn mục tiêu");
                    return;
                }
            } else if (formType === "EXPENSE") {
                if (!selectedBudgetOrCategory) {
                    message.error("Vui lòng chọn ngân sách hoặc danh mục");
                    return;
                }
                if (selectedBudgetOrCategory === "other" && !formCategory) {
                    message.error("Vui lòng chọn danh mục");
                    return;
                }
            } else if (formType === "INCOME") {
                if (!formCategory) {
                    message.error("Vui lòng chọn danh mục");
                    return;
                }
            }
            if (!Number.isFinite(formAmount) || formAmount <= 0) {
                message.error("Số tiền không hợp lệ");
                return;
            }

            setSaving(true);
            const token = await getToken();
            if (!token) return;

            const payload: any = {
                walletId: formWalletId,
                type: formType,
                amount: formAmount,
                date: dayjs(formDate).toISOString(),
                note: formNote?.trim() ? formNote.trim() : undefined,
            };

            // Handle category and budget based on transaction type
            if (formType === "INCOME") {
                payload.category = formCategory;
            } else if (formType === "EXPENSE") {
                if (selectedBudgetOrCategory === "other") {
                    // Khác (Không nằm trong ngân sách)
                    payload.category = formCategory;
                } else {
                    // Ngân sách được chọn
                    const selectedBudget = budgets.find(
                        (b: any) => b._id === selectedBudgetOrCategory,
                    );
                    if (selectedBudget) {
                        payload.budgetId = selectedBudgetOrCategory;
                        payload.category = selectedBudget.category;
                    }
                }
            } else if (
                formType === "GOAL_DEPOSIT" ||
                formType === "GOAL_WITHDRAW"
            ) {
                // Set category as goal title
                const selectedGoal = goals.find(
                    (g: any) => g._id === formGoalId,
                );
                payload.category = selectedGoal
                    ? selectedGoal.title
                    : "Tiết kiệm";
                payload.goalId = formGoalId;
            }

            if (editing?._id) {
                await transactionApi.updateTransaction(
                    editing._id,
                    payload,
                    token,
                );
                message.success("Cập nhật giao dịch thành công");
            } else {
                await transactionApi.createTransaction(payload, token);
                message.success("Tạo giao dịch thành công");
            }

            setModalOpen(false);
            await fetchAll();
        } catch (e: any) {
            console.error(e);
            message.error(e?.message || "Không thể lưu giao dịch");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (tx: Transaction) => {
        setTransactionToDelete(tx);
        setAlertVisible(true);
    };

    const confirmDelete = async () => {
        if (!transactionToDelete) return;

        try {
            setDeleting(true);
            const token = await getToken();
            if (!token) return;
            await transactionApi.deleteTransaction(
                transactionToDelete._id,
                token,
            );
            message.success("Đã xóa giao dịch");
            setActiveId((prev) => {
                if (prev !== transactionToDelete._id) return prev;
                const rest = transactions.filter(
                    (t) => t._id !== transactionToDelete._id,
                );
                return rest[0]?._id ?? null;
            });
            setAlertVisible(false);
            setTransactionToDelete(null);
            await fetchAll();
        } catch (e: any) {
            console.error(e);
            message.error(e?.message || "Không thể xóa giao dịch");
        } finally {
            setDeleting(false);
        }
    };

    const cancelDelete = () => {
        setAlertVisible(false);
        setTransactionToDelete(null);
    };

    const availableCategories = useMemo(() => {
        const fromPreset = categories
            .filter((c) => c.type === formType)
            .map((c) => c.name);
        const fromTx = transactions
            .filter((t) => t.type === formType)
            .map((t) => t.category)
            .filter(Boolean);
        return Array.from(new Set([...fromPreset, ...fromTx])).sort();
    }, [formType, transactions]);

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
                    <h2 className="ekash_title">Giao dịch</h2>
                    <p className="ekash_subtitle">
                        Tạo và quản lý thu nhập/chi tiêu
                    </p>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                    }}
                >
                    <Select
                        value={selectedPeriod}
                        onChange={handlePeriodChange}
                        style={{ width: 150 }}
                        options={[
                            { value: "current_month", label: "Tháng này" },
                            { value: "last_month", label: "Tháng trước" },
                            { value: "current_week", label: "Tuần này" },
                            { value: "last_week", label: "Tuần trước" },
                            { value: "custom", label: "Tùy chỉnh" },
                        ]}
                    />
                    {selectedPeriod === "custom" && (
                        <DatePicker.RangePicker
                            value={dateRange}
                            onChange={handleDateRangeChange}
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
                            fontSize: "14px",
                        }}
                    >
                        Về hiện tại
                    </button>
                    <button
                        type="button"
                        className="ekash_btn"
                        onClick={openCreate}
                    >
                        Thêm giao dịch mới
                    </button>
                    <button
                        type="button"
                        className="ekash_btn primary"
                        onClick={openSavings}
                    >
                        Tiết kiệm
                    </button>
                </div>
            </div>

            <div className="ekash_grid_main">
                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Danh sách giao dịch</p>
                        <span className="ekash_card_hint">
                            {getPeriodDisplayText()} • Trang {currentPage}/
                            {totalPages}
                        </span>
                    </div>

                    <div
                        className="ekash_list"
                        style={{
                            maxHeight: "400px",
                            overflowY: "auto",
                            padding: "16px",
                        }}
                    >
                        {paginatedTransactions.map((t) => {
                            const amt = parseAmount(t.amount);
                            const isActive = t._id === activeId;
                            return (
                                <button
                                    key={t._id}
                                    type="button"
                                    className={`ekash_list_row ${isActive ? "is_active" : ""}`}
                                    onClick={() => setActiveId(t._id)}
                                >
                                    <span className="left">
                                        <span
                                            className="dot"
                                            style={{
                                                backgroundColor:
                                                    t.type === "INCOME"
                                                        ? "#22c55e"
                                                        : "#f43f5e",
                                            }}
                                        />
                                        <span className="name">
                                            {t.category || "-"}
                                        </span>
                                    </span>
                                    <span className="right">
                                        <span className="amt">
                                            {formatCurrency(amt)}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                        {paginatedTransactions.length === 0 ? (
                            <div className="ekash_empty">
                                Không có giao dịch trong khoảng thời gian đã
                                chọn
                            </div>
                        ) : null}
                    </div>

                    {/* Phân trang */}
                    {totalPages > 1 && (
                        <div
                            style={{
                                padding: "16px",
                                borderTop: "1px solid var(--border-color)",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "8px",
                            }}
                        >
                            <button
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.max(1, prev - 1),
                                    )
                                }
                                disabled={currentPage === 1}
                                style={{
                                    padding: "8px 12px",
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "6px",
                                    backgroundColor:
                                        currentPage === 1
                                            ? "var(--background-secondary)"
                                            : "var(--card-background)",
                                    color: "var(--text-primary)",
                                    cursor:
                                        currentPage === 1
                                            ? "not-allowed"
                                            : "pointer",
                                    fontSize: "14px",
                                }}
                            >
                                Trước
                            </button>

                            <span
                                style={{
                                    margin: "0 12px",
                                    fontSize: "14px",
                                    color: "var(--text-secondary)",
                                }}
                            >
                                Trang {currentPage} / {totalPages}
                            </span>

                            <button
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.min(totalPages, prev + 1),
                                    )
                                }
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: "8px 12px",
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "6px",
                                    backgroundColor:
                                        currentPage === totalPages
                                            ? "var(--background-secondary)"
                                            : "var(--card-background)",
                                    color: "var(--text-primary)",
                                    cursor:
                                        currentPage === totalPages
                                            ? "not-allowed"
                                            : "pointer",
                                    fontSize: "14px",
                                }}
                            >
                                Sau
                            </button>
                        </div>
                    )}
                </div>

                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Chi tiết giao dịch</p>
                        <span className="ekash_card_hint">
                            {selected
                                ? dayjs(selected.date).format("DD/MM/YYYY")
                                : "-"}
                        </span>
                    </div>

                    {selected ? (
                        <>
                            <div className="ekash_form">
                                <div className="ekash_form_row">
                                    <div className="label">Loại</div>
                                    <div style={{ fontWeight: 900 }}>
                                        {selected.type === "INCOME"
                                            ? "Thu nhập"
                                            : "Chi tiêu"}
                                    </div>
                                </div>
                                <div className="ekash_form_row">
                                    <div className="label">Số tiền</div>
                                    <div
                                        style={{
                                            fontWeight: 900,
                                            fontSize: 18,
                                        }}
                                    >
                                        {formatCurrency(
                                            parseAmount(selected.amount),
                                        )}
                                    </div>
                                </div>
                                <div className="ekash_form_row">
                                    <div className="label">Danh mục</div>
                                    <div style={{ fontWeight: 900 }}>
                                        {selected.category || "-"}
                                    </div>
                                </div>
                                <div className="ekash_form_row">
                                    <div className="label">Ví</div>
                                    <div style={{ fontWeight: 900 }}>
                                        {walletName(selected)}
                                    </div>
                                </div>
                                <div className="ekash_form_row">
                                    <div className="label">Ghi chú</div>
                                    <div
                                        style={{
                                            fontWeight: 800,
                                            color: "var(--ekash_muted)",
                                        }}
                                    >
                                        {selected.note || "-"}
                                    </div>
                                </div>
                            </div>

                            <div className="ekash_actions">
                                <button
                                    type="button"
                                    className="ekash_btn"
                                    onClick={() => openEdit(selected)}
                                >
                                    Cập nhật
                                </button>
                                <button
                                    type="button"
                                    className="ekash_btn danger"
                                    onClick={() => handleDelete(selected)}
                                    disabled={deleting}
                                >
                                    Xóa
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="ekash_empty">
                            Chọn một giao dịch để xem chi tiết
                        </div>
                    )}
                </div>
            </div>

            <Modal
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                okText={editing ? "Cập nhật" : "Tạo"}
                cancelText="Hủy"
                confirmLoading={saving}
                title={editing ? "Cập nhật giao dịch" : "Tạo giao dịch"}
            >
                <div className="ekash_form">
                    <div className="ekash_form_row">
                        <div className="label">Loại giao dịch</div>
                        <Select
                            value={formType}
                            onChange={(v) => {
                                setFormType(v);
                                // Reset conditional fields when type changes
                                setFormBudgetId("");
                                setFormGoalId("");
                                setSelectedBudgetOrCategory("");
                                if (
                                    v === "GOAL_DEPOSIT" ||
                                    v === "GOAL_WITHDRAW"
                                ) {
                                    setFormCategory("Tiết kiệm");
                                } else {
                                    setFormCategory("");
                                }
                            }}
                            style={{ width: "100%" }}
                            options={
                                modalSource === "savings"
                                    ? [
                                          {
                                              value: "GOAL_DEPOSIT",
                                              label: "Tiết kiệm (Goal)",
                                          },
                                          {
                                              value: "GOAL_WITHDRAW",
                                              label: "Rút từ Goal",
                                          },
                                      ]
                                    : modalSource === "edit"
                                      ? [
                                            {
                                                value: "INCOME",
                                                label: "Thu nhập",
                                            },
                                            {
                                                value: "EXPENSE",
                                                label: "Chi tiêu",
                                            },
                                            {
                                                value: "GOAL_DEPOSIT",
                                                label: "Tiết kiệm (Goal)",
                                            },
                                            {
                                                value: "GOAL_WITHDRAW",
                                                label: "Rút từ Goal",
                                            },
                                        ]
                                      : [
                                            {
                                                value: "INCOME",
                                                label: "Thu nhập",
                                            },
                                            {
                                                value: "EXPENSE",
                                                label: "Chi tiêu",
                                            },
                                        ]
                            }
                        />
                    </div>

                    <div className="ekash_form_row">
                        <div className="label">Ví</div>
                        <Select
                            value={formWalletId}
                            onChange={(v) => setFormWalletId(v)}
                            style={{ width: "100%" }}
                            placeholder="Chọn ví"
                            options={wallets.map((w) => ({
                                value: w._id,
                                label: `${w.name} (${formatCurrency(w.balance)})`,
                            }))}
                        />
                    </div>

                    {/* Unified Budget/Category dropdown for EXPENSE */}
                    {formType === "EXPENSE" && (
                        <div className="ekash_form_row">
                            <div className="label">Ngân sách/Danh mục</div>
                            <Select
                                value={selectedBudgetOrCategory}
                                onChange={(v) => {
                                    setSelectedBudgetOrCategory(v);
                                    if (v === "other") {
                                        setFormBudgetId("");
                                    } else {
                                        setFormBudgetId(v);
                                        // Auto-set category from selected budget
                                        const selectedBudget = budgets.find(
                                            (b: any) => b._id === v,
                                        );
                                        if (selectedBudget) {
                                            setFormCategory(
                                                selectedBudget.category,
                                            );
                                        }
                                    }
                                }}
                                style={{ width: "100%" }}
                                placeholder="Chọn ngân sách hoặc danh mục"
                                options={[
                                    ...budgets.map((b: any) => ({
                                        value: b._id,
                                        label: `${b.category} - Còn ${formatCurrency(b.amount - (b.spent || 0))}`,
                                    })),
                                    {
                                        value: "other",
                                        label: "Khác (Không nằm trong ngân sách)",
                                    },
                                ]}
                            />
                        </div>
                    )}

                    {/* Show category input for "other" selection */}
                    {formType === "EXPENSE" &&
                        selectedBudgetOrCategory === "other" && (
                            <div className="ekash_form_row">
                                <div className="label">Danh mục</div>
                                <Input
                                    value={formCategory}
                                    onChange={(e) =>
                                        setFormCategory(e.target.value)
                                    }
                                    placeholder="Nhập danh mục (ví dụ: Cấp cứu, Sửa xe...)"
                                />
                            </div>
                        )}

                    {(formType === "GOAL_DEPOSIT" ||
                        formType === "GOAL_WITHDRAW") && (
                        <div className="ekash_form_row">
                            <div className="label">Mục tiêu</div>
                            <Select
                                value={formGoalId}
                                onChange={(v) => setFormGoalId(v)}
                                style={{ width: "100%" }}
                                placeholder="Chọn mục tiêu"
                                options={goals
                                    .filter((g: any) => g.status === "active")
                                    .map((g: any) => ({
                                        value: g._id,
                                        label: `${g.title} (${formatCurrency(g.currentAmount)} / ${formatCurrency(g.targetAmount)})`,
                                    }))}
                            />
                        </div>
                    )}

                    {/* Category dropdown for INCOME */}
                    {formType === "INCOME" && (
                        <div className="ekash_form_row">
                            <div className="label">Danh mục</div>
                            <Input
                                value={formCategory}
                                onChange={(e) =>
                                    setFormCategory(e.target.value)
                                }
                                placeholder="Nhập danh mục (ví dụ: Lương, Thưởng...)"
                            />
                        </div>
                    )}

                    <div className="ekash_form_row">
                        <div className="label">Số tiền</div>
                        <InputNumber
                            value={formAmount}
                            onChange={(v) => setFormAmount(Number(v || 0))}
                            style={{ width: "100%" }}
                            min={0}
                            formatter={moneyFormatter}
                            parser={moneyParser}
                        />
                    </div>

                    <div className="ekash_form_row">
                        <div className="label">Ngày</div>
                        <DatePicker
                            value={dayjs(formDate)}
                            onChange={(d) =>
                                setFormDate(
                                    (d || dayjs()).startOf("day").toISOString(),
                                )
                            }
                            style={{ width: "100%" }}
                            format="DD/MM/YYYY"
                        />
                    </div>

                    <div className="ekash_form_row">
                        <div className="label">Ghi chú</div>
                        <Input
                            value={formNote}
                            onChange={(e) => setFormNote(e.target.value)}
                            placeholder="Ví dụ: cà phê, đi chợ..."
                        />
                    </div>
                </div>
            </Modal>

            <AlertNotification
                visible={alertVisible}
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
                title="Xóa giao dịch"
                content="Bạn có chắc muốn xóa giao dịch này không?"
                confirmText="Xóa"
                cancelText="Hủy"
                type="warning"
            />
        </div>
    );
};

export default Transactions_new;
