/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
    Filter,
    PencilLine,
    Plus,
    ReceiptText,
    Search,
    Trash2,
} from "lucide-react";
import { auth } from "../firebase/config";
import { transactionApi, walletApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import { PageHeader } from "../components/app/page-header";
import { EmptyState } from "../components/app/empty-state";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Spinner } from "../components/ui/spinner";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";

dayjs.locale("vi");

interface Transaction {
    _id: string;
    walletId: string | { _id: string; name?: string };
    type: "INCOME" | "EXPENSE" | "GOAL_DEPOSIT" | "GOAL_WITHDRAW";
    amount: number | string;
    category: string;
    date: string;
    note?: string;
}

interface WalletItem {
    _id: string;
    name: string;
}

const categoryOptions = [
    { value: "An uong", vi: "Ăn uống", en: "Food" },
    { value: "Di chuyen", vi: "Di chuyển", en: "Transport" },
    { value: "Mua sam", vi: "Mua sắm", en: "Shopping" },
    { value: "Giai tri", vi: "Giải trí", en: "Entertainment" },
    { value: "Suc khoe", vi: "Sức khỏe", en: "Health" },
    { value: "Giao duc", vi: "Giáo dục", en: "Education" },
    { value: "Hoa don", vi: "Hóa đơn", en: "Bills" },
    { value: "Khac", vi: "Khác", en: "Other" },
] as const;

const transactionTypeText = {
    INCOME: { vi: "Thu nhập", en: "Income" },
    EXPENSE: { vi: "Chi tiêu", en: "Expense" },
    GOAL_DEPOSIT: { vi: "Nạp mục tiêu", en: "Goal deposit" },
    GOAL_WITHDRAW: { vi: "Rút mục tiêu", en: "Goal withdrawal" },
} as const;

const parseAmount = (raw: unknown) => {
    if (typeof raw === "number") {
        return raw;
    }
    if (typeof raw === "string") {
        return parseFloat(raw.replace(/[^0-9.-]/g, "")) || 0;
    }
    return 0;
};

const Transactions: React.FC = () => {
    const { language, isVietnamese } = useLocale();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [wallets, setWallets] = useState<WalletItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedWallet, setSelectedWallet] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Transaction | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
    const [formValues, setFormValues] = useState({
        type: "EXPENSE" as "INCOME" | "EXPENSE",
        amount: 0,
        note: "",
        category: "An uong",
        walletId: "",
        date: dayjs().format("YYYY-MM-DD"),
    });

    const copy = isVietnamese
        ? {
              pageTitle: "Giao dịch",
              pageDescription:
                  "Bộ lọc phía server dùng đúng các tham số note, category và wallet từ transactions API.",
              newTransaction: "Thêm giao dịch",
              pageIncome: "Thu trong trang",
              pageExpense: "Chi trong trang",
              searchByNote: "Tìm theo ghi chú...",
              allCategories: "Tất cả danh mục",
              allWallets: "Tất cả ví",
              reset: "Đặt lại",
              transactionList: "Danh sách giao dịch",
              transactionListDesc: (currentPage: number, totalPages: number, totalRows: number) =>
                  `Trang ${currentPage}/${totalPages}. Tổng số dòng từ API: ${totalRows}.`,
              note: "Ghi chú",
              category: "Danh mục",
              wallet: "Ví",
              date: "Ngày",
              type: "Loại",
              amount: "Số tiền",
              action: "Thao tác",
              untitledTransaction: "Giao dịch chưa đặt tên",
              unknown: "Không xác định",
              showingRows: (count: number) => `Đang hiển thị ${count} dòng trên trang này.`,
              previous: "Trước",
              next: "Tiếp",
              noTransactions: "Chưa có giao dịch",
              noTransactionsDescWithWallet:
                  "Không có giao dịch nào khớp với bộ lọc hiện tại.",
              noTransactionsDescWithoutWallet:
                  "Hãy tạo ví trước. Không thể ghi nhận giao dịch nếu chưa có ví.",
              createTransaction: "Tạo giao dịch",
              formDescription:
                  "Biểu mẫu này map trực tiếp với payload create/update transaction của API.",
              editTransaction: "Chỉnh sửa giao dịch",
              createTransactionTitle: "Tạo giao dịch",
              walletRequired: "Cần chọn ví",
              walletRequiredDesc: "Hãy chọn ví trước khi lưu giao dịch.",
              invalidAmount: "Số tiền không hợp lệ",
              invalidAmountDesc: "Số tiền phải lớn hơn 0.",
              transactionUpdated: "Đã cập nhật giao dịch",
              transactionCreated: "Đã tạo giao dịch",
              saveFailed: "Lưu thất bại",
              saveFailedDesc: "Không thể lưu giao dịch.",
              transactionDeleted: "Đã xóa giao dịch",
              deleteFailed: "Xóa thất bại",
              deleteFailedDesc: "Không thể xóa giao dịch.",
              keep: "Giữ lại",
              delete: "Xóa",
              deleteTransaction: "Xóa giao dịch",
              deleteTransactionDesc: (label: string) => `Xóa "${label}"?`,
              typeExpense: "Chi tiêu",
              typeIncome: "Thu nhập",
              selectWallet: "Chọn ví",
              whatHappened: "Nội dung giao dịch",
              cancel: "Hủy",
              saving: "Đang lưu...",
              updateTransaction: "Cập nhật giao dịch",
              noWalletFallback: "Không xác định",
          }
        : {
              pageTitle: "Transactions",
              pageDescription:
                  "Server-side filters use note, category and wallet params from the transactions API.",
              newTransaction: "New transaction",
              pageIncome: "Page income",
              pageExpense: "Page expense",
              searchByNote: "Search by note...",
              allCategories: "All categories",
              allWallets: "All wallets",
              reset: "Reset",
              transactionList: "Transaction list",
              transactionListDesc: (currentPage: number, totalPages: number, totalRows: number) =>
                  `Page ${currentPage} of ${totalPages}. Total rows from API: ${totalRows}.`,
              note: "Note",
              category: "Category",
              wallet: "Wallet",
              date: "Date",
              type: "Type",
              amount: "Amount",
              action: "Action",
              untitledTransaction: "Untitled transaction",
              unknown: "Unknown",
              showingRows: (count: number) => `Showing ${count} rows on this page.`,
              previous: "Previous",
              next: "Next",
              noTransactions: "No transactions",
              noTransactionsDescWithWallet:
                  "No transaction matches the current filters.",
              noTransactionsDescWithoutWallet:
                  "Create a wallet first. Transactions cannot be recorded without one.",
              createTransaction: "Create transaction",
              formDescription:
                  "This form maps exactly to the create/update transaction API payload.",
              editTransaction: "Edit transaction",
              createTransactionTitle: "Create transaction",
              walletRequired: "Wallet required",
              walletRequiredDesc: "Select a wallet before saving.",
              invalidAmount: "Invalid amount",
              invalidAmountDesc: "Amount must be greater than zero.",
              transactionUpdated: "Transaction updated",
              transactionCreated: "Transaction created",
              saveFailed: "Save failed",
              saveFailedDesc: "The transaction could not be saved.",
              transactionDeleted: "Transaction deleted",
              deleteFailed: "Delete failed",
              deleteFailedDesc: "Could not delete the transaction.",
              keep: "Keep",
              delete: "Delete",
              deleteTransaction: "Delete transaction",
              deleteTransactionDesc: (label: string) => `Delete "${label}"?`,
              typeExpense: "Expense",
              typeIncome: "Income",
              selectWallet: "Select wallet",
              whatHappened: "What happened in this transaction?",
              cancel: "Cancel",
              saving: "Saving...",
              updateTransaction: "Update transaction",
              noWalletFallback: "Unknown",
          };
    const getCategoryLabel = (category: string) => {
        if (category === "Transfer") {
            return isVietnamese ? "Chuyển khoản" : "Transfer";
        }

        const match = categoryOptions.find((item) => item.value === category);
        if (!match) {
            return category;
        }

        return language === "vi" ? match.vi : match.en;
    };

    const getTransactionTypeLabel = (type: Transaction["type"]) =>
        transactionTypeText[type][language];

    // Locale-derived error labels are intentionally reduced to stable primitives above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }

            const [walletResponse, transactionResponse] = await Promise.all([
                walletApi.getWallets(token),
                transactionApi.getTransactions(
                    {
                        page,
                        limit: pageSize,
                        category: selectedCategory || undefined,
                        walletId: selectedWallet || undefined,
                        note: searchQuery || undefined,
                    },
                    token,
                ),
            ]);

            const walletList = walletResponse?.wallets || [];
            setWallets(walletList);
            setTransactions(transactionResponse?.data?.transactions || []);
            setTotalTransactions(transactionResponse?.data?.total || 0);

            if (!formValues.walletId && walletList.length > 0) {
                setFormValues((current) => ({
                    ...current,
                    walletId: walletList[0]._id,
                }));
            }
        } catch (error: any) {
            toast({
                title: isVietnamese
                    ? "Không thể tải giao dịch"
                    : "Could not load transactions",
                description: error.message || (isVietnamese ? "Vui lòng thử lại." : "Please retry."),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [
        formValues.walletId,
        isVietnamese,
        page,
        pageSize,
        searchQuery,
        selectedCategory,
        selectedWallet,
        toast,
    ]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const handleOpenModal = (transaction: Transaction | null = null) => {
        if (transaction) {
            setEditing(transaction);
            setFormValues({
                type:
                    transaction.type === "INCOME" ? "INCOME" : "EXPENSE",
                amount: parseAmount(transaction.amount),
                note: transaction.note || "",
                category: transaction.category,
                walletId:
                    typeof transaction.walletId === "string"
                        ? transaction.walletId
                        : transaction.walletId?._id || "",
                date: dayjs(transaction.date).format("YYYY-MM-DD"),
            });
        } else {
            setEditing(null);
            setFormValues({
                type: "EXPENSE",
                amount: 0,
                note: "",
                category: categoryOptions[0].value,
                walletId: wallets[0]?._id || "",
                date: dayjs().format("YYYY-MM-DD"),
            });
        }
        setModalOpen(true);
    };

    const resetFilters = () => {
        setSearchQuery("");
        setSelectedCategory("");
        setSelectedWallet("");
        setPage(1);
    };

    const handleSubmit = async () => {
        if (!formValues.walletId) {
            toast({
                title: copy.walletRequired,
                description: copy.walletRequiredDesc,
                variant: "destructive",
            });
            return;
        }

        if (formValues.amount <= 0) {
            toast({
                title: copy.invalidAmount,
                description: copy.invalidAmountDesc,
                variant: "destructive",
            });
            return;
        }

        setSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }

            const payload = {
                ...formValues,
                date: new Date(`${formValues.date}T12:00:00`).toISOString(),
            };

            if (editing) {
                await transactionApi.updateTransaction(editing._id, payload, token);
                toast({
                    title: copy.transactionUpdated,
                    variant: "success",
                });
            } else {
                await transactionApi.createTransaction(payload, token);
                toast({
                    title: copy.transactionCreated,
                    variant: "success",
                });
            }

            setModalOpen(false);
            await fetchAll();
        } catch (error: any) {
            toast({
                title: copy.saveFailed,
                description: error.message || copy.saveFailedDesc,
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!pendingDelete) {
            return;
        }

        setSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }
            await transactionApi.deleteTransaction(pendingDelete._id, token);
            toast({
                title: copy.transactionDeleted,
                variant: "success",
            });
            setPendingDelete(null);
            await fetchAll();
        } catch (error: any) {
            toast({
                title: copy.deleteFailed,
                description: error.message || copy.deleteFailedDesc,
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const totals = useMemo(() => {
        return transactions.reduce(
            (result, transaction) => {
                const amount = parseAmount(transaction.amount);
                if (transaction.type === "INCOME") {
                    result.income += amount;
                } else {
                    result.expense += amount;
                }
                return result;
            },
            { income: 0, expense: 0 },
        );
    }, [transactions]);

    const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));

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
                    <Button onClick={() => handleOpenModal()}>
                        <Plus className="h-4 w-4" />
                        {copy.newTransaction}
                    </Button>
                }
                description={copy.pageDescription}
                title={copy.pageTitle}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardContent className="p-5">
                        <p className="text-sm text-muted-foreground">{copy.pageIncome}</p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-600">
                            {formatCurrency(totals.income)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-5">
                        <p className="text-sm text-muted-foreground">{copy.pageExpense}</p>
                        <p className="mt-2 text-2xl font-semibold text-rose-600">
                            {formatCurrency(totals.expense)}
                        </p>
                    </CardContent>
                </Card>
                <Card className="md:col-span-2">
                    <CardContent className="p-5">
                        <div className="grid gap-3 md:grid-cols-[1.3fr,1fr,1fr,auto]">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    className="pl-9"
                                    onChange={(event) => {
                                        setPage(1);
                                        setSearchQuery(event.target.value);
                                    }}
                                    placeholder={copy.searchByNote}
                                    value={searchQuery}
                                />
                            </div>

                            <Select
                                onChange={(event) => {
                                    setPage(1);
                                    setSelectedCategory(event.target.value);
                                }}
                                value={selectedCategory}
                            >
                                <option value="">{copy.allCategories}</option>
                                {categoryOptions.map((category) => (
                                    <option key={category.value} value={category.value}>
                                        {language === "vi" ? category.vi : category.en}
                                    </option>
                                ))}
                            </Select>

                            <Select
                                onChange={(event) => {
                                    setPage(1);
                                    setSelectedWallet(event.target.value);
                                }}
                                value={selectedWallet}
                            >
                                <option value="">{copy.allWallets}</option>
                                {wallets.map((wallet) => (
                                    <option key={wallet._id} value={wallet._id}>
                                        {wallet.name}
                                    </option>
                                ))}
                            </Select>

                            <Button onClick={resetFilters} variant="outline">
                                <Filter className="h-4 w-4" />
                                {copy.reset}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{copy.transactionList}</CardTitle>
                    <CardDescription>
                        {copy.transactionListDesc(page, totalPages, totalTransactions)}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {transactions.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[860px] text-left">
                                    <thead>
                                        <tr className="border-b border-border text-sm text-muted-foreground">
                                            <th className="pb-3 font-medium">{copy.note}</th>
                                            <th className="pb-3 font-medium">{copy.category}</th>
                                            <th className="pb-3 font-medium">{copy.wallet}</th>
                                            <th className="pb-3 font-medium">{copy.date}</th>
                                            <th className="pb-3 font-medium">{copy.type}</th>
                                            <th className="pb-3 font-medium text-right">{copy.amount}</th>
                                            <th className="pb-3 font-medium text-right">{copy.action}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((transaction) => (
                                            <tr
                                                key={transaction._id}
                                                className="border-b border-border/70 text-sm last:border-b-0"
                                            >
                                                <td className="py-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-[var(--app-radius-md)] bg-primary-soft text-primary">
                                                            <ReceiptText className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-foreground">
                                                                {transaction.note || copy.untitledTransaction}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                ID {transaction._id.slice(-6).toUpperCase()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-muted-foreground">
                                                    {getCategoryLabel(transaction.category)}
                                                </td>
                                                <td className="py-4 text-muted-foreground">
                                                    {typeof transaction.walletId === "string"
                                                        ? transaction.walletId
                                                        : transaction.walletId?.name || copy.noWalletFallback}
                                                </td>
                                                <td className="py-4 text-muted-foreground">
                                                    {formatDate(transaction.date)}
                                                </td>
                                                <td className="py-4">
                                                    <Badge
                                                        variant={
                                                            transaction.type === "INCOME"
                                                                ? "success"
                                                                : "danger"
                                                        }
                                                    >
                                                        {getTransactionTypeLabel(transaction.type)}
                                                    </Badge>
                                                </td>
                                                <td className="py-4 text-right font-semibold">
                                                    <span
                                                        className={
                                                            transaction.type === "INCOME"
                                                                ? "text-emerald-600"
                                                                : "text-rose-600"
                                                        }
                                                    >
                                                        {transaction.type === "INCOME" ? "+" : "-"}
                                                        {formatCurrency(parseAmount(transaction.amount))}
                                                    </span>
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            onClick={() => handleOpenModal(transaction)}
                                                            size="icon"
                                                            variant="ghost"
                                                        >
                                                            <PencilLine className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            onClick={() => setPendingDelete(transaction)}
                                                            size="icon"
                                                            variant="ghost"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    {copy.showingRows(transactions.length)}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        disabled={page <= 1}
                                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                                        variant="outline"
                                    >
                                        {copy.previous}
                                    </Button>
                                    <Button
                                        disabled={page >= totalPages}
                                        onClick={() =>
                                            setPage((current) => Math.min(totalPages, current + 1))
                                        }
                                        variant="outline"
                                    >
                                        {copy.next}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <EmptyState
                            actionLabel={wallets.length > 0 ? copy.createTransaction : undefined}
                            description={
                                wallets.length > 0
                                    ? copy.noTransactionsDescWithWallet
                                    : copy.noTransactionsDescWithoutWallet
                            }
                            icon={ReceiptText}
                            onAction={wallets.length > 0 ? () => handleOpenModal() : undefined}
                            title={copy.noTransactions}
                        />
                    )}
                </CardContent>
            </Card>

            <Dialog
                description={copy.formDescription}
                onClose={() => setModalOpen(false)}
                open={modalOpen}
                title={editing ? copy.editTransaction : copy.createTransactionTitle}
            >
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.type}</label>
                            <Select
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        type: event.target.value as "INCOME" | "EXPENSE",
                                    }))
                                }
                                value={formValues.type}
                            >
                                <option value="EXPENSE">{copy.typeExpense}</option>
                                <option value="INCOME">{copy.typeIncome}</option>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.amount}</label>
                            <Input
                                min={0}
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        amount: Number(event.target.value) || 0,
                                    }))
                                }
                                type="number"
                                value={formValues.amount}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.category}</label>
                            <Select
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        category: event.target.value,
                                    }))
                                }
                                value={formValues.category}
                            >
                                {categoryOptions.map((category) => (
                                    <option key={category.value} value={category.value}>
                                        {language === "vi" ? category.vi : category.en}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.wallet}</label>
                            <Select
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        walletId: event.target.value,
                                    }))
                                }
                                value={formValues.walletId}
                            >
                                <option value="">{copy.selectWallet}</option>
                                {wallets.map((wallet) => (
                                    <option key={wallet._id} value={wallet._id}>
                                        {wallet.name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.date}</label>
                        <Input
                            onChange={(event) =>
                                setFormValues((current) => ({
                                    ...current,
                                    date: event.target.value,
                                }))
                            }
                            type="date"
                            value={formValues.date}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.note}</label>
                        <Textarea
                            onChange={(event) =>
                                setFormValues((current) => ({
                                    ...current,
                                    note: event.target.value,
                                }))
                            }
                            placeholder={copy.whatHappened}
                            value={formValues.note}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button onClick={() => setModalOpen(false)} variant="outline">
                            {copy.cancel}
                        </Button>
                        <Button disabled={submitting} onClick={handleSubmit}>
                            {submitting
                                ? copy.saving
                                : editing
                                  ? copy.updateTransaction
                                  : copy.createTransaction}
                        </Button>
                    </div>
                </div>
            </Dialog>

            <ConfirmDialog
                busy={submitting}
                cancelLabel={copy.keep}
                confirmLabel={copy.delete}
                description={
                    pendingDelete
                        ? copy.deleteTransactionDesc(
                              pendingDelete.note || getCategoryLabel(pendingDelete.category),
                          )
                        : ""
                }
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDelete}
                open={!!pendingDelete}
                title={copy.deleteTransaction}
                variant="destructive"
            />
        </div>
    );
};

export default Transactions;
