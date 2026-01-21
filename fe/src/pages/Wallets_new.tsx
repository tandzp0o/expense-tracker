import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
    DatePicker,
    Input,
    InputNumber,
    Modal,
    Select,
    message,
    Spin,
} from "antd";
import { auth } from "../firebase/config";
import { transactionApi, walletApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import { useTheme } from "../contexts/ThemeContext";
import AlertNotification from "../components/AlertNotification";

dayjs.locale("vi");

interface Wallet {
    _id: string;
    userId: string;
    name: string;
    accountNumber?: string;
    description?: string;
    balance: number;
    initialBalance: number;
    createdAt: string;
    updatedAt: string;
}

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

const Wallets_new: React.FC = () => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const transactionsPerPage = 10;

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Wallet | null>(null);
    const [formName, setFormName] = useState<string>("");
    const [formBalance, setFormBalance] = useState<number>(0); // số tiền hiện tại
    const [formBalanceInitial, setFormBalanceInitial] = useState<number>(0); // số tiền ban đầu
    const [formAccountNumber, setFormAccountNumber] = useState<string>("");
    const [formDescription, setFormDescription] = useState<string>("");
    const [alertVisible, setAlertVisible] = useState(false);
    const [walletToDelete, setWalletToDelete] = useState<string | null>(null);

    const parseAmount = (raw: unknown) => {
        if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
        if (typeof raw === "string") {
            const cleaned = raw.replace(/[^0-9.-]/g, "");
            const v = Number(cleaned);
            return Number.isFinite(v) ? v : 0;
        }
        return 0;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) return;
                const token = await firebaseUser.getIdToken();

                const startDate = dayjs()
                    .subtract(90, "day")
                    .startOf("day")
                    .toISOString();
                const endDate = dayjs().endOf("day").toISOString();

                const [walletsRes, txRes] = await Promise.all([
                    walletApi.getWallets(token),
                    transactionApi.getTransactions(
                        { startDate, endDate, sort: "-date", limit: 200 },
                        token,
                    ),
                ]);

                const w = walletsRes?.wallets || [];
                setWallets(w);
                setTransactions(txRes?.data?.transactions || []);
                setActiveWalletId((prev) => prev || (w[0]?._id ?? null));
            } catch (e) {
                console.error(e);
                message.error("Không thể tải dữ liệu ví");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getToken = async () => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            message.error("Người dùng chưa được xác thực");
            return null;
        }
        return firebaseUser.getIdToken();
    };

    const resetForm = () => {
        setFormName("");
        setFormBalance(0);
        setFormBalanceInitial(0);
        setFormAccountNumber("");
        setFormDescription("");
    };

    const openCreate = () => {
        setEditing(null);
        resetForm();
        setModalOpen(true);
    };

    const openEdit = (w: Wallet) => {
        setEditing(w);
        setFormName(w.name);
        setFormBalance(Number(w.balance) || 0);
        setFormBalanceInitial(Number(w.initialBalance) || 0);
        setFormAccountNumber(w.accountNumber || "");
        setFormDescription(w.description || "");
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (!formName.trim()) {
                message.error("Tên ví không được để trống");
                return;
            }
            if (!Number.isFinite(formBalance) || formBalance < 0) {
                message.error("Số dư không hợp lệ");
                return;
            }
            setSaving(true);
            const token = await getToken();
            if (!token) return;
            const payload = {
                name: formName.trim(),
                balance: formBalance,
                initialBalance: formBalanceInitial,
                accountNumber: formAccountNumber.trim() || undefined,
                description: formDescription.trim() || undefined,
            };
            if (editing?._id) {
                await walletApi.updateWallet(editing._id, payload, token);
                message.success("Cập nhật ví thành công");
            } else {
                await walletApi.createWallet(payload, token);
                message.success("Tạo ví thành công");
            }
            setModalOpen(false);
            await fetchData();
        } catch (e: any) {
            console.error(e);
            message.error(e?.message || "Không thể lưu ví");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (wallet: Wallet) => {
        setWalletToDelete(wallet._id);
        setAlertVisible(true);
    };

    const confirmDelete = async () => {
        if (!walletToDelete) return;

        try {
            setDeleting(true);
            const token = await getToken();
            if (!token) return;

            await walletApi.deleteWallet(walletToDelete, token);
            message.success("Đã xóa ví thành công");
            setActiveWalletId((prev) => {
                if (prev === walletToDelete) return null;
                const remaining = wallets.filter(
                    (w) => w._id !== walletToDelete,
                );
                return remaining[0]?._id ?? null;
            });
            await fetchData();
        } catch (e: any) {
            console.error(e);
            message.error(e?.message || "Không thể xóa ví");
        } finally {
            setDeleting(false);
            setAlertVisible(false);
            setWalletToDelete(null);
        }
    };

    const fetchData = async () => {
        try {
            const firebaseUser = auth.currentUser;
            if (!firebaseUser) return;
            const token = await firebaseUser.getIdToken();

            // Chỉ lấy giao dịch trong tuần hiện tại (từ đầu tuần đến hôm nay)
            const weekStart = dayjs().startOf("week").toISOString();
            const weekEnd = dayjs().endOf("day").toISOString();

            const [walletsRes, txRes] = await Promise.all([
                walletApi.getWallets(token),
                transactionApi.getTransactions(
                    {
                        startDate: weekStart,
                        endDate: weekEnd,
                        sort: "-date",
                        limit: 100,
                    },
                    token,
                ),
            ]);

            const w = walletsRes?.wallets || [];
            setWallets(w);
            setTransactions(txRes?.data?.transactions || []);
            setActiveWalletId((prev) => prev || (w[0]?._id ?? null));
        } catch (e) {
            console.error(e);
            message.error("Không thể tải dữ liệu ví");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const totalBalance = useMemo(
        () => wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0),
        [wallets],
    );

    const activeWallet = useMemo(
        () => wallets.find((w) => w._id === activeWalletId) || null,
        [activeWalletId, wallets],
    );

    const weekStart = useMemo(() => dayjs().startOf("week"), []);
    const weekEnd = useMemo(() => dayjs().endOf("week"), []);

    const weeklyTx = useMemo(
        () =>
            transactions.filter((t) => {
                const d = dayjs(t.date);
                return (
                    d.isAfter(weekStart.subtract(1, "day")) &&
                    d.isBefore(weekEnd.add(1, "day"))
                );
            }),
        [weekEnd, weekStart, transactions],
    );

    const walletTx = useMemo(() => {
        if (!activeWalletId) return [];
        return weeklyTx
            .filter((t) => t.walletId?._id === activeWalletId)
            .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
    }, [activeWalletId, weeklyTx]);

    // Tính toán phân trang
    const paginatedTx = useMemo(() => {
        const startIndex = (currentPage - 1) * transactionsPerPage;
        const endIndex = startIndex + transactionsPerPage;
        return walletTx.slice(startIndex, endIndex);
    }, [walletTx, currentPage]);

    useEffect(() => {
        const total = Math.ceil(walletTx.length / transactionsPerPage);
        setTotalPages(total);
        if (currentPage > total && total > 0) {
            setCurrentPage(1);
        }
    }, [walletTx.length, currentPage]);

    const recentTx = useMemo(
        () =>
            paginatedTx.map((t) => ({
                id: t._id,
                title: t.category || "Giao dịch",
                date: formatDate(t.date),
                amount: `${t.type === "INCOME" ? "+" : "-"}${formatCurrency(parseAmount(t.amount))}`,
                status: t.type === "INCOME" ? "Thu" : "Chi",
                statusType: t.type === "INCOME" ? "paid" : "due",
                note: t.note,
            })),
        [paginatedTx],
    );

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
                    <h2 className="ekash_title">Ví</h2>
                    <p className="ekash_subtitle">Quản lý tài khoản và số dư</p>
                </div>
                <div className="ekash_wallet_header_actions">
                    <div className="ekash_wallet_balance">
                        <div className="ekash_wallet_balance_label">
                            Tổng số dư
                        </div>
                        <div className="ekash_wallet_balance_value">
                            {formatCurrency(totalBalance)}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="ekash_btn primary"
                        onClick={openCreate}
                    >
                        Thêm ví mới
                    </button>
                </div>
            </div>

            <div className="ekash_grid_main">
                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Danh sách ví</p>
                    </div>

                    <div className="ekash_list">
                        {wallets.map((w) => (
                            <button
                                key={w._id}
                                type="button"
                                className={`ekash_list_row ${w._id === activeWalletId ? "is_active" : ""}`}
                                onClick={() => setActiveWalletId(w._id)}
                            >
                                <span className="left">
                                    <span
                                        className="dot"
                                        style={{
                                            background:
                                                w._id === activeWalletId
                                                    ? "#4f46e5"
                                                    : "rgba(148, 163, 184, 0.7)",
                                        }}
                                    />
                                    <span className="name">{w.name}</span>
                                </span>
                                <span className="right">
                                    <span className="amt">
                                        {formatCurrency(Number(w.balance) || 0)}
                                    </span>
                                </span>
                            </button>
                        ))}
                        {wallets.length === 0 ? (
                            <div className="ekash_empty">Chưa có ví</div>
                        ) : null}
                    </div>
                </div>

                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Lịch sử giao dịch</p>
                        <span className="ekash_card_hint">
                            {activeWallet ? activeWallet.name : "-"} • Tuần này
                        </span>
                    </div>

                    <div
                        className="ekash_payments"
                        style={{
                            maxHeight: "400px",
                            overflowY: "auto",
                            padding: "16px",
                        }}
                    >
                        {recentTx.map((p, index) => (
                            <div
                                key={p.id}
                                className={`ekash_payment_row ${index % 2 === 0 ? "even" : "odd"}`}
                                style={{
                                    backgroundColor:
                                        index % 2 === 0
                                            ? "var(--card-background)"
                                            : "var(--background-secondary)",
                                    padding: "12px 16px",
                                    borderRadius: "8px",
                                    marginBottom: "8px",
                                }}
                            >
                                <div className="left">
                                    <div className="title">{p.title}</div>
                                    <div className="date">
                                        {p.date}
                                        {p.note ? (
                                            <span className="sep">•</span>
                                        ) : null}
                                        {p.note ? p.note : null}
                                    </div>
                                </div>
                                <div className="right">
                                    <div className="amount">{p.amount}</div>
                                    <span className={`status ${p.statusType}`}>
                                        {p.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {recentTx.length === 0 ? (
                            <div className="ekash_empty">
                                Chưa có giao dịch trong tuần này
                            </div>
                        ) : null}
                    </div>

                    {/* Phân trang */}
                    {totalPages > 1 && (
                        <div className="ekash_pagination">
                            <button
                                className="ekash_pagination_btn"
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.max(1, prev - 1),
                                    )
                                }
                                disabled={currentPage === 1}
                            >
                                Trước
                            </button>

                            <span className="ekash_pagination_info">
                                Trang {currentPage} / {totalPages}
                            </span>

                            <button
                                className="ekash_pagination_btn"
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.min(totalPages, prev + 1),
                                    )
                                }
                                disabled={currentPage === totalPages}
                            >
                                Sau
                            </button>
                        </div>
                    )}

                    {activeWallet && (
                        <div className="ekash_actions">
                            <button
                                type="button"
                                className="ekash_btn"
                                onClick={() => openEdit(activeWallet)}
                            >
                                Cập nhật
                            </button>
                            <button
                                type="button"
                                className="ekash_btn danger"
                                onClick={() => handleDelete(activeWallet)}
                                disabled={deleting}
                            >
                                Xóa
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <AlertNotification
                visible={alertVisible}
                onConfirm={confirmDelete}
                onCancel={() => {
                    setAlertVisible(false);
                    setWalletToDelete(null);
                }}
                title="Xác nhận xóa ví"
                content={`Bạn có chắc muốn xóa ví "${wallets.find((w) => w._id === walletToDelete)?.name || ""}" không? Hành động này sẽ xóa toàn bộ giao dịch liên quan đến ví này và không thể hoàn tác.`}
                confirmText="Xóa"
                cancelText="Hủy"
                type="error"
            />

            <Modal
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                okText={editing ? "Cập nhật" : "Tạo"}
                cancelText="Hủy"
                confirmLoading={saving}
                title={editing ? "Cập nhật ví" : "Tạo ví"}
            >
                <div className="ekash_form">
                    <div className="ekash_form_row">
                        <div className="label">Tên ví</div>
                        <Input
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="Ví dụ: Tiền mặt, ATM..."
                        />
                    </div>
                    <div className="ekash_form_row">
                        <div className="label">Số dư ban đầu</div>
                        <InputNumber
                            value={formBalanceInitial}
                            onChange={(v) =>
                                setFormBalanceInitial(Number(v || 0))
                            }
                            style={{ width: "100%" }}
                            min={0}
                            formatter={moneyFormatter}
                            parser={moneyParser}
                        />
                    </div>
                    <div className="ekash_form_row">
                        <div className="label">Số dư hiện tại</div>
                        <InputNumber
                            value={formBalance}
                            onChange={(v) => setFormBalance(Number(v || 0))}
                            style={{ width: "100%" }}
                            min={0}
                            formatter={moneyFormatter}
                            parser={moneyParser}
                        />
                    </div>
                    <div className="ekash_form_row">
                        <div className="label">Số tài khoản (tùy chọn)</div>
                        <Input
                            value={formAccountNumber}
                            onChange={(e) =>
                                setFormAccountNumber(e.target.value)
                            }
                            placeholder="Ví dụ: 1234567890"
                        />
                    </div>
                    <div className="ekash_form_row">
                        <div className="label">Mô tả (tùy chọn)</div>
                        <Input.TextArea
                            value={formDescription}
                            onChange={(e) => setFormDescription(e.target.value)}
                            placeholder="Mô tả về ví này..."
                            rows={3}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const moneyFormatter = (value: any) =>
    `${value ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const moneyParser = (value: any) =>
    value ? Number(String(value).replace(/[^0-9.-]+/g, "")) : 0;

export default Wallets_new;
