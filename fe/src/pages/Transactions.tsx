/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { budgetApi, transactionApi, walletApi } from "../services/api";
import {
  formatCurrency,
  formatDate,
  formatWholeNumberInput,
  parseWholeNumberInput,
} from "../utils/formatters";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import { useDebounce } from "../hooks/useDebounce";
import { PageHeader } from "../components/app/page-header";
import { EmptyState } from "../components/app/empty-state";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  ConfirmDialog,
  Dialog,
  DialogFooter,
  DialogSection,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { AmountInput } from "../components/ui/amount-input";
import { Select } from "../components/ui/select";
import { Spinner } from "../components/ui/spinner";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";

dayjs.locale("vi");

interface Transaction {
  _id: string;
  walletId: string | { _id: string; name?: string };
  budgetId?: string;
  type: "INCOME" | "EXPENSE" | "GOAL_DEPOSIT" | "GOAL_WITHDRAW";
  status?: "SCHEDULED" | "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
  amount: number | string;
  category: string;
  date: string;
  note?: string;
  transferGroupId?: string;
}

type TransactionStatus =
  | "SCHEDULED"
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

interface WalletItem {
  _id: string;
  name: string;
}

type TransactionComposerMode = "manual" | "voice" | "scan";

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

const incomeCategoryOptions = [
  { value: "Salary", vi: "L\u01b0\u01a1ng", en: "Salary" },
  { value: "Bonus", vi: "Th\u01b0\u1edfng", en: "Bonus" },
  { value: "Side income", vi: "Thu nh\u1eadp ph\u1ee5", en: "Side income" },
  { value: "Other", vi: "Kh\u00e1c", en: "Other" },
] as const;

interface BudgetOption {
  _id: string;
  walletId: string;
  walletName: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
}

const transactionTypeText = {
  INCOME: { vi: "Thu nhập", en: "Income" },
  EXPENSE: { vi: "Chi tiêu", en: "Expense" },
  GOAL_DEPOSIT: { vi: "Nạp mục tiêu", en: "Goal deposit" },
  GOAL_WITHDRAW: { vi: "Rút mục tiêu", en: "Goal withdrawal" },
} as const;

const transactionStatusText: Record<
  TransactionStatus,
  { vi: string; en: string }
> = {
  COMPLETED: { vi: "Đã ghi nhận", en: "Completed" },
  SCHEDULED: { vi: "Đã lên lịch", en: "Scheduled" },
  PENDING: { vi: "Đang chờ", en: "Pending" },
  FAILED: { vi: "Thất bại", en: "Failed" },
  CANCELLED: { vi: "Đã hủy", en: "Cancelled" },
};

const parseAmount = (raw: unknown) => {
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string") {
    return parseFloat(raw.replace(/[^0-9.-]/g, "")) || 0;
  }
  return 0;
};

const isTransferTransaction = (
  transaction: Pick<Transaction, "category" | "transferGroupId">,
) =>
  transaction.category === "Transfer" || Boolean(transaction.transferGroupId);

const getTransactionStatus = (
  transaction: Pick<Transaction, "status">,
): TransactionStatus => transaction.status || "COMPLETED";

const isLedgerTransaction = (transaction: Pick<Transaction, "status">) =>
  getTransactionStatus(transaction) === "COMPLETED";

const Transactions: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, isVietnamese } = useLocale();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [expenseBudgets, setExpenseBudgets] = useState<BudgetOption[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [expenseBudgetsLoading, setExpenseBudgetsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedWallet, setSelectedWallet] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<TransactionStatus | "">(
    "",
  );
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [composerMode, setComposerMode] =
    useState<TransactionComposerMode | null>(null);
  const [formValues, setFormValues] = useState({
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    status: "COMPLETED" as TransactionStatus,
    amount: 0,
    note: "",
    category: "",
    budgetId: "",
    walletId: "",
    date: dayjs().format("YYYY-MM-DD"),
  });
  const [amountInput, setAmountInput] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const hasLoadedWalletsRef = useRef(false);

  const baseCopy = isVietnamese
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
        transactionListDesc: (
          currentPage: number,
          totalPages: number,
          totalRows: number,
        ) =>
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
        showingRows: (count: number) =>
          `Đang hiển thị ${count} dòng trên trang này.`,
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
        transactionListDesc: (
          currentPage: number,
          totalPages: number,
          totalRows: number,
        ) =>
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
  const copy = {
    ...baseCopy,
    pageDescription: isVietnamese
      ? "Tìm, lọc và quản lý giao dịch theo ghi chú, danh mục và ví."
      : "Search, filter, and manage transactions by note, category, and wallet.",
    transactionListDesc: (
      currentPage: number,
      totalPages: number,
      totalRows: number,
    ) =>
      isVietnamese
        ? `Trang ${currentPage}/${totalPages} • Tổng ${totalRows} giao dịch`
        : `Page ${currentPage}/${totalPages} • ${totalRows} transactions total`,
    formDescription: isVietnamese
      ? "Nhập các thông tin chính để tạo giao dịch thực tế hoặc khoản đã lên kế hoạch."
      : "Enter the key details to create an actual transaction or a planned one.",
    status: isVietnamese ? "Trạng thái" : "Status",
    allStatuses: isVietnamese ? "Tất cả trạng thái" : "All statuses",
    selectStatus: isVietnamese ? "Chọn trạng thái" : "Select status",
    statusHelp: isVietnamese
      ? "Khoản tương lai phải để ở trạng thái đã lên lịch hoặc đang chờ."
      : "Future items must stay in scheduled or pending status.",
    plannedDeleteWarning: (label: string) =>
      isVietnamese
        ? `Xóa "${label}"? Đây là khoản kế hoạch nên số dư sẽ không thay đổi.`
        : `Delete "${label}"? This is a planned item, so balances will not change.`,
    plannedDeleteSuccess: isVietnamese
      ? "Khoản kế hoạch đã được gỡ khỏi danh sách."
      : "The planned item has been removed.",
    futureCompletedTitle: isVietnamese
      ? "Khoản tương lai phải lên lịch"
      : "Future transactions must be planned",
    futureCompletedDesc: isVietnamese
      ? "Nếu ngày lớn hơn hôm nay, hãy chuyển trạng thái sang Đã lên lịch."
      : "If the date is in the future, switch the status to Scheduled.",
    expenseBudget: isVietnamese
      ? "Ng\u00e2n s\u00e1ch chi ti\u00eau"
      : "Expense budget",
    incomeCategory: isVietnamese
      ? "Nh\u00f3m thu nh\u1eadp"
      : "Income category",
    selectBudget: isVietnamese
      ? "Ch\u1ecdn ng\u00e2n s\u00e1ch"
      : "Select budget",
    budgetRequired: isVietnamese
      ? "C\u1ea7n ch\u1ecdn ng\u00e2n s\u00e1ch"
      : "Budget required",
    budgetRequiredDesc: isVietnamese
      ? "Kho\u1ea3n chi ph\u1ea3i g\u1eafn v\u1edbi ng\u00e2n s\u00e1ch c\u1ee7a v\u00ed v\u00e0 \u0111\u00fang th\u00e1ng giao d\u1ecbch."
      : "Expense transactions must be linked to a wallet budget for the same month.",
    budgetHint: isVietnamese
      ? "Danh m\u1ee5c chi s\u1ebd l\u1ea5y t\u1ef1 \u0111\u1ed9ng t\u1eeb ng\u00e2n s\u00e1ch c\u1ee7a v\u00ed."
      : "Expense categories come directly from the selected wallet budget.",
    budgetEmpty: isVietnamese
      ? "V\u00ed n\u00e0y ch\u01b0a c\u00f3 ng\u00e2n s\u00e1ch trong th\u00e1ng \u0111\u00e3 ch\u1ecdn."
      : "This wallet has no budget in the selected month.",
    incomeCategoryRequiredDesc: isVietnamese
      ? "H\u00e3y ch\u1ecdn m\u1ed9t nh\u00f3m thu nh\u1eadp ph\u00f9 h\u1ee3p."
      : "Choose an income category.",
    otherIncomeNoteHint: isVietnamese
      ? 'B\u1ea1n \u0111ang ch\u1ecdn "Kh\u00e1c", h\u00e3y ghi r\u00f5 ngu\u1ed3n thu \u1edf ph\u1ea7n ghi ch\u00fa \u0111\u1ec3 d\u00f2ng ti\u1ec1n kh\u00f4ng b\u1ecb m\u01a1 h\u1ed3.'
      : 'You selected "Other". Add a clear note so this income source is not ambiguous.',
    otherIncomeNotePlaceholder: isVietnamese
      ? "V\u00ed d\u1ee5: Ti\u1ec1n m\u1eebng, b\u00e1n \u0111\u1ed3 c\u0169, ho\u00e0n ti\u1ec1n..."
      : "Example: Gift money, sold old item, reimbursement...",
    loadingBudgets: isVietnamese
      ? "\u0110ang t\u1ea3i ng\u00e2n s\u00e1ch..."
      : "Loading budgets...",
  };
  const todayDate = dayjs().format("YYYY-MM-DD");
  const futureDateErrorTitle = copy.futureCompletedTitle;
  const futureDateErrorDesc = copy.futureCompletedDesc;
  const getCategoryLabel = (category: string) => {
    if (category === "Transfer") {
      return isVietnamese ? "Chuyển khoản" : "Transfer";
    }

    const match = [...categoryOptions, ...incomeCategoryOptions].find(
      (item) => item.value === category,
    );
    if (!match) {
      return category;
    }

    return language === "vi" ? match.vi : match.en;
  };

  const getTransactionTypeLabel = (type: Transaction["type"]) =>
    transactionTypeText[type][language];
  const getTransactionStatusLabel = (status?: Transaction["status"]) =>
    transactionStatusText[(status || "COMPLETED") as TransactionStatus][
      language
    ];
  const getWalletName = (walletId: Transaction["walletId"]) => {
    if (typeof walletId !== "string") {
      return walletId?.name || copy.noWalletFallback;
    }

    return wallets.find((wallet) => wallet._id === walletId)?.name || walletId;
  };
  const getTransactionDisplayLabel = (transaction: Transaction) =>
    transaction.note || getCategoryLabel(transaction.category);
  const getDeleteWarningDescription = (transaction: Transaction) => {
    const label = getTransactionDisplayLabel(transaction);
    const amountLabel = formatCurrency(parseAmount(transaction.amount));

    if (isTransferTransaction(transaction)) {
      return isVietnamese
        ? `Xóa "${label}"? Cả hai giao dịch chuyển nội bộ sẽ bị hoàn tác và cập nhật lại số dư.`
        : `Delete "${label}"? Both sides of this internal transfer will be reversed and balances will be updated.`;
    }

    if (!isLedgerTransaction(transaction)) {
      return copy.plannedDeleteWarning(label);
    }

    switch (transaction.type) {
      case "EXPENSE":
        return isVietnamese
          ? `Xóa "${label}"? ${amountLabel} sẽ được hoàn lại vào ví.`
          : `Delete "${label}"? ${amountLabel} will be refunded to the wallet.`;
      case "INCOME":
        return isVietnamese
          ? `Xóa "${label}"? ${amountLabel} sẽ bị trừ khỏi ví.`
          : `Delete "${label}"? ${amountLabel} will be deducted from the wallet.`;
      case "GOAL_DEPOSIT":
        return isVietnamese
          ? `Xóa "${label}"? ${amountLabel} sẽ hoàn về ví và trừ khỏi mục tiêu.`
          : `Delete "${label}"? ${amountLabel} will go back to the wallet and be removed from the goal.`;
      case "GOAL_WITHDRAW":
        return isVietnamese
          ? `Xóa "${label}"? ${amountLabel} sẽ bị trừ khỏi ví và hoàn lại mục tiêu.`
          : `Delete "${label}"? ${amountLabel} will be deducted from the wallet and restored to the goal.`;
      default:
        return isVietnamese
          ? `Xóa "${label}"? Số dư liên quan sẽ được cập nhật lại.`
          : `Delete "${label}"? Related balances will be recalculated.`;
    }
  };
  const getDeleteSuccessDescription = (transaction: Transaction) => {
    const amountLabel = formatCurrency(parseAmount(transaction.amount));
    const transactionStatus = getTransactionStatus(transaction);

    if (isTransferTransaction(transaction)) {
      return isVietnamese
        ? "Cả hai giao dịch chuyển nội bộ đã được hoàn tác."
        : "Both sides of the internal transfer have been reversed.";
    }

    if (transactionStatus !== "COMPLETED") {
      return copy.plannedDeleteSuccess;
    }

    switch (transaction.type) {
      case "EXPENSE":
        return isVietnamese
          ? `${amountLabel} đã được hoàn lại vào ví.`
          : `${amountLabel} has been refunded to the wallet.`;
      case "INCOME":
        return isVietnamese
          ? `${amountLabel} đã bị trừ khỏi ví.`
          : `${amountLabel} has been deducted from the wallet.`;
      case "GOAL_DEPOSIT":
        return isVietnamese
          ? `${amountLabel} đã được hoàn về ví và trừ khỏi mục tiêu.`
          : `${amountLabel} has been returned to the wallet and removed from the goal.`;
      case "GOAL_WITHDRAW":
        return isVietnamese
          ? `${amountLabel} đã bị trừ khỏi ví và trả lại mục tiêu.`
          : `${amountLabel} has been deducted from the wallet and returned to the goal.`;
      default:
        return isVietnamese
          ? "Số dư liên quan đã được cập nhật lại."
          : "Related balances have been updated.";
    }
  };

  const currentBudgetPeriod = useMemo(() => {
    const selectedDate = dayjs(formValues.date || dayjs().format("YYYY-MM-DD"));

    return {
      month: selectedDate.month() + 1,
      year: selectedDate.year(),
    };
  }, [formValues.date]);
  const selectedExpenseBudget = useMemo(
    () =>
      expenseBudgets.find((budget) => budget._id === formValues.budgetId) ||
      null,
    [expenseBudgets, formValues.budgetId],
  );
  const incomeCategoryOptionsForForm = useMemo(() => {
    const hasCurrentCategory = incomeCategoryOptions.some(
      (item) => item.value === formValues.category,
    );

    if (
      formValues.type !== "INCOME" ||
      !formValues.category ||
      hasCurrentCategory
    ) {
      return incomeCategoryOptions;
    }

    return [
      ...incomeCategoryOptions,
      {
        value: formValues.category,
        vi: formValues.category,
        en: formValues.category,
      },
    ];
  }, [formValues.category, formValues.type]);
  const shouldHighlightIncomeOtherNote =
    formValues.type === "INCOME" && formValues.category === "Other";
  const composerModeCopy = useMemo(() => {
    if (!composerMode) {
      return null;
    }

    if (composerMode === "voice") {
      return {
        badge: isVietnamese ? "Nói nhanh" : "Voice entry",
        title: isVietnamese
          ? "AI sẽ ưu tiên tách thông tin từ giọng nói của bạn"
          : "AI will prioritize extracting details from your voice input",
        description: isVietnamese
          ? "Khi backend AI sẵn sàng, khoản ăn uống, đi lại, mua sắm hay thuốc sẽ được gợi ý danh mục trước khi lưu."
          : "Once the AI backend is wired in, food, shopping, transport, or medicine can be suggested before saving.",
        tone: "border-orange-200 bg-orange-50/80 text-orange-800",
      };
    }

    if (composerMode === "scan") {
      return {
        badge: isVietnamese ? "Quét ảnh" : "Scan entry",
        title: isVietnamese
          ? "Luồng này dành cho hóa đơn, vé và ảnh mua sắm"
          : "This mode is meant for receipts, tickets, and shopping photos",
        description: isVietnamese
          ? "Bạn sẽ sớm có OCR + vision để AI nhận diện danh mục như Ăn uống, Shopping, Y tế hay Giải trí."
          : "OCR + vision will soon suggest categories such as Food, Shopping, Health, or Entertainment.",
        tone: "border-sky-200 bg-sky-50/80 text-sky-800",
      };
    }

    return {
      badge: isVietnamese ? "Nhập tay" : "Manual entry",
      title: isVietnamese
        ? "Bạn đang ở luồng nhập giao dịch truyền thống"
        : "You are using the classic transaction flow",
      description: isVietnamese
        ? "Nếu cần AI hỗ trợ sau, bạn có thể quay lại nút giữa ở thanh điều hướng mobile."
        : "If you want AI assistance later, reopen the center action from mobile navigation.",
      tone: "border-primary/15 bg-primary-soft/80 text-primary",
    };
  }, [composerMode, isVietnamese]);
  const categoryFilterOptions = useMemo(() => {
    const categories = new Set<string>();

    filterCategories.forEach((category) => {
      if (category && category !== "Transfer") {
        categories.add(category);
      }
    });

    transactions.forEach((transaction) => {
      if (transaction.category && transaction.category !== "Transfer") {
        categories.add(transaction.category);
      }
    });

    if (
      selectedCategory &&
      selectedCategory !== "Transfer" &&
      !categories.has(selectedCategory)
    ) {
      categories.add(selectedCategory);
    }

    return Array.from(categories).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [filterCategories, selectedCategory, transactions]);

  useEffect(() => {
    if (!modalOpen || formValues.type !== "EXPENSE" || !formValues.walletId) {
      setExpenseBudgets([]);
      setExpenseBudgetsLoading(false);
      return;
    }

    let active = true;

    const loadExpenseBudgets = async () => {
      setExpenseBudgetsLoading(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          return;
        }

        const summary = await budgetApi.getBudgetSummary(
          {
            walletId: formValues.walletId,
            month: currentBudgetPeriod.month,
            year: currentBudgetPeriod.year,
          },
          token,
        );

        if (!active) {
          return;
        }

        const nextBudgets: BudgetOption[] = summary?.items || [];
        setExpenseBudgets(nextBudgets);

        setFormValues((current) => {
          if (current.type !== "EXPENSE") {
            return current;
          }

          const matchedBudget =
            nextBudgets.find((budget) => budget._id === current.budgetId) ||
            nextBudgets.find(
              (budget) =>
                !current.budgetId &&
                current.category &&
                budget.category === current.category,
            ) ||
            (!current.budgetId && !current.category && nextBudgets[0]
              ? nextBudgets[0]
              : null);

          const nextBudgetId = matchedBudget?._id || "";
          const nextCategory = matchedBudget?.category || "";

          if (
            current.budgetId === nextBudgetId &&
            current.category === nextCategory
          ) {
            return current;
          }

          return {
            ...current,
            budgetId: nextBudgetId,
            category: nextCategory,
          };
        });
      } catch (error: any) {
        if (!active) {
          return;
        }

        setExpenseBudgets([]);
        toast({
          title: copy.saveFailed,
          description: error.message || copy.budgetEmpty,
          variant: "destructive",
        });
      } finally {
        if (active) {
          setExpenseBudgetsLoading(false);
        }
      }
    };

    void loadExpenseBudgets();

    return () => {
      active = false;
    };
  }, [
    copy.budgetEmpty,
    copy.saveFailed,
    currentBudgetPeriod.month,
    currentBudgetPeriod.year,
    formValues.type,
    formValues.walletId,
    modalOpen,
    toast,
  ]);

  useEffect(() => {
    if (!modalOpen || formValues.type !== "INCOME" || formValues.category) {
      return;
    }

    setFormValues((current) => ({
      ...current,
      category: incomeCategoryOptions[0].value,
    }));
  }, [formValues.category, formValues.type, modalOpen]);

  // Locale-derived error labels are intentionally reduced to stable primitives above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        return;
      }

      if (!hasLoadedWalletsRef.current) {
        const walletResponse = await walletApi.getWallets(token);
        const walletList = walletResponse?.wallets || [];

        setWallets(walletList);
        hasLoadedWalletsRef.current = true;

        if (!formValues.walletId && walletList.length > 0) {
          setFormValues((current) => ({
            ...current,
            walletId: walletList[0]._id,
          }));
        }
      }

      const [transactionResponse, budgetSummaryResponse] = await Promise.all([
        transactionApi.getTransactions(
          {
            page,
            limit: pageSize,
            status: selectedStatus || undefined,
            category: selectedCategory || undefined,
            walletId: selectedWallet || undefined,
            note: debouncedSearchQuery || undefined,
          },
          token,
        ),
        budgetApi.getBudgetSummary(
          {
            month: dayjs().month() + 1,
            year: dayjs().year(),
          },
          token,
        ),
      ]);

      setTransactions(transactionResponse?.data?.transactions || []);
      setTotalTransactions(transactionResponse?.data?.total || 0);
      setFilterCategories(
        Array.from(
          new Set(
            (budgetSummaryResponse?.items || [])
              .map((item: BudgetOption) => item.category)
              .filter(Boolean),
          ),
        ),
      );
    } catch (error: any) {
      toast({
        title: isVietnamese
          ? "Không thể tải giao dịch"
          : "Could not load transactions",
        description:
          error.message ||
          (isVietnamese ? "Vui lòng thử lại." : "Please retry."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearchQuery,
    isVietnamese,
    page,
    pageSize,
    selectedCategory,
    selectedStatus,
    selectedWallet,
    toast,
  ]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleOpenModal = (
    transaction: Transaction | null = null,
    nextComposerMode: TransactionComposerMode | null = null,
  ) => {
    if (transaction) {
      setComposerMode(null);
      if (
        isTransferTransaction(transaction) ||
        (transaction.type !== "INCOME" && transaction.type !== "EXPENSE")
      ) {
        toast({
          title: isVietnamese
            ? "Không thể sửa giao dịch này"
            : "This transaction cannot be edited",
          description: isTransferTransaction(transaction)
            ? isVietnamese
              ? "Chuyển nội bộ cần được xóa và tạo lại từ màn hình ví."
              : "Internal transfers should be deleted and recreated from the wallet screen."
            : isVietnamese
              ? "Giao dịch tiết kiệm hoặc điều chỉnh cần đi theo luồng nghiệp vụ riêng."
              : "Goal or adjustment transactions need a dedicated workflow.",
          variant: "destructive",
        });
        return;
      }

      setEditing(transaction);
      const parsedAmount = parseAmount(transaction.amount);
      setFormValues({
        type: transaction.type === "INCOME" ? "INCOME" : "EXPENSE",
        status: getTransactionStatus(transaction),
        amount: parsedAmount,
        note: transaction.note || "",
        category: transaction.category,
        budgetId: transaction.budgetId || "",
        walletId:
          typeof transaction.walletId === "string"
            ? transaction.walletId
            : transaction.walletId?._id || "",
        date: dayjs(transaction.date).format("YYYY-MM-DD"),
      });
      setAmountInput(formatWholeNumberInput(parsedAmount));
    } else {
      setComposerMode(nextComposerMode);
      setEditing(null);
      setFormValues({
        type: "EXPENSE",
        status: "COMPLETED",
        amount: 0,
        note: "",
        category: "",
        budgetId: "",
        walletId: wallets[0]?._id || "",
        date: dayjs().format("YYYY-MM-DD"),
      });
      setAmountInput("");
    }
    setModalOpen(true);
  };

  useEffect(() => {
    if (loading || modalOpen || wallets.length === 0) {
      return;
    }

    const nextMode = new URLSearchParams(location.search).get("composer");
    if (nextMode !== "manual" && nextMode !== "voice" && nextMode !== "scan") {
      return;
    }

    handleOpenModal(null, nextMode);

    const params = new URLSearchParams(location.search);
    params.delete("composer");
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { replace: true },
    );
  }, [
    loading,
    location.pathname,
    location.search,
    modalOpen,
    navigate,
    wallets.length,
  ]);

  const handleAmountChange = (value: string, numericValue: number) => {
    setAmountInput(value);
    setFormValues((current) => ({
      ...current,
      amount: numericValue,
    }));
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedWallet("");
    setSelectedStatus("");
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

    if (formValues.type === "EXPENSE" && !selectedExpenseBudget) {
      toast({
        title: copy.budgetRequired,
        description: copy.budgetRequiredDesc,
        variant: "destructive",
      });
      return;
    }

    if (
      formValues.type === "INCOME" &&
      !String(formValues.category || "").trim()
    ) {
      toast({
        title: copy.incomeCategory,
        description: copy.incomeCategoryRequiredDesc,
        variant: "destructive",
      });
      return;
    }

    if (
      formValues.date > todayDate &&
      formValues.status !== "SCHEDULED" &&
      formValues.status !== "PENDING"
    ) {
      toast({
        title: futureDateErrorTitle,
        description: futureDateErrorDesc,
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
        type: formValues.type,
        status: formValues.status,
        amount: formValues.amount,
        note: formValues.note,
        walletId: formValues.walletId,
        category:
          formValues.type === "EXPENSE"
            ? selectedExpenseBudget?.category || ""
            : String(formValues.category || "").trim(),
        ...(formValues.type === "EXPENSE"
          ? { budgetId: selectedExpenseBudget?._id }
          : { budgetId: undefined }),
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
      setAmountInput("");
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
    const transactionToDelete = pendingDelete;

    if (!transactionToDelete) {
      return;
    }

    setSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        return;
      }
      await transactionApi.deleteTransaction(transactionToDelete._id, token);
      toast({
        title: copy.transactionDeleted,
        description: getDeleteSuccessDescription(transactionToDelete),
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
        if (
          isTransferTransaction(transaction) ||
          !isLedgerTransaction(transaction)
        ) {
          return result;
        }

        const amount = parseAmount(transaction.amount);
        if (transaction.type === "INCOME") {
          result.income += amount;
        } else if (transaction.type === "EXPENSE") {
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
    <div className="space-y-4 sm:space-y-6">
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

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex gap-4 w-full">
          <Card className="flex-1">
            <CardContent className="p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">{copy.pageIncome}</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">
                {formatCurrency(totals.income)}
              </p>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">
                {copy.pageExpense}
              </p>
              <p className="mt-2 text-2xl font-semibold text-rose-600">
                {formatCurrency(totals.expense)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="md:col-span-2">
          <CardContent className="p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr,1fr,1fr,1fr,auto]">
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
                {categoryFilterOptions.map((category) => (
                  <option key={category} value={category}>
                    {getCategoryLabel(category)}
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

              <Select
                onChange={(event) => {
                  setPage(1);
                  setSelectedStatus(
                    event.target.value as TransactionStatus | "",
                  );
                }}
                value={selectedStatus}
              >
                <option value="">{copy.allStatuses}</option>
                {Object.entries(transactionStatusText).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label[language]}
                  </option>
                ))}
              </Select>

              <Button
                className="w-full md:w-auto"
                onClick={resetFilters}
                variant="outline"
              >
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
              <div className="space-y-2.5 md:hidden">
                {transactions.map((transaction) => {
                  const amount = parseAmount(transaction.amount);
                  const isIncome = transaction.type === "INCOME";
                  const walletName = getWalletName(transaction.walletId);
                  const transactionStatus = getTransactionStatus(transaction);
                  const amountTone =
                    transactionStatus === "COMPLETED"
                      ? isIncome
                        ? "text-sm font-semibold text-emerald-600"
                        : "text-sm font-semibold text-rose-600"
                      : "text-sm font-semibold text-amber-600";

                  return (
                    <div
                      key={transaction._id}
                      className="rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--app-radius-md)-5px)] bg-primary-soft text-primary">
                            <ReceiptText className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-foreground">
                              {transaction.note || copy.untitledTransaction}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">
                              {getCategoryLabel(transaction.category)} •{" "}
                              {walletName} • {formatDate(transaction.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge
                            className="h-5 whitespace-nowrap rounded-full px-2 text-[10px] leading-none"
                            variant={isIncome ? "success" : "danger"}
                          >
                            {getTransactionTypeLabel(transaction.type)}
                          </Badge>
                          {transactionStatus !== "COMPLETED" ? (
                            <Badge
                              className="h-5 whitespace-nowrap rounded-full px-2 text-[10px] leading-none"
                              variant="outline"
                            >
                              {getTransactionStatusLabel(transaction.status)}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className={amountTone}>
                          {isIncome ? "+" : "-"}
                          {formatCurrency(amount)}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            className="h-7 w-7"
                            onClick={() => handleOpenModal(transaction)}
                            size="icon"
                            variant="ghost"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            className="h-7 w-7"
                            onClick={() => setPendingDelete(transaction)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-border text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">{copy.note}</th>
                      <th className="pb-3 font-medium">{copy.category}</th>
                      <th className="pb-3 font-medium">{copy.wallet}</th>
                      <th className="pb-3 font-medium">{copy.date}</th>
                      <th className="pb-3 font-medium">{copy.type}</th>
                      <th className="pb-3 font-medium">{copy.status}</th>
                      <th className="pb-3 font-medium text-right">
                        {copy.amount}
                      </th>
                      <th className="pb-3 font-medium text-right">
                        {copy.action}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => {
                      const transactionStatus =
                        getTransactionStatus(transaction);
                      const isCompleted = transactionStatus === "COMPLETED";

                      return (
                        <tr
                          key={transaction._id}
                          className="border-b border-border/70 text-sm last:border-b-0"
                        >
                          <td className="py-3.5">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-[calc(var(--app-radius-md)-4px)] bg-primary-soft text-primary">
                                <ReceiptText className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {transaction.note || copy.untitledTransaction}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 text-muted-foreground">
                            {getCategoryLabel(transaction.category)}
                          </td>
                          <td className="py-3.5 text-muted-foreground">
                            {getWalletName(transaction.walletId)}
                          </td>
                          <td className="py-3.5 text-muted-foreground">
                            {formatDate(transaction.date)}
                          </td>
                          <td className="py-3.5">
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
                          <td className="py-3.5">
                            <Badge
                              className={
                                isCompleted
                                  ? undefined
                                  : "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                              }
                              variant="outline"
                            >
                              {getTransactionStatusLabel(transaction.status)}
                            </Badge>
                          </td>
                          <td className="py-3.5 text-right font-semibold">
                            <span
                              className={
                                isCompleted
                                  ? transaction.type === "INCOME"
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                  : "text-amber-600"
                              }
                            >
                              {transaction.type === "INCOME" ? "+" : "-"}
                              {formatCurrency(parseAmount(transaction.amount))}
                            </span>
                          </td>
                          <td className="py-3.5">
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  {copy.showingRows(transactions.length)}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    className="w-full sm:w-auto"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    variant="outline"
                  >
                    {copy.previous}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
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
              actionLabel={
                wallets.length > 0 ? copy.createTransaction : undefined
              }
              description={
                wallets.length > 0
                  ? copy.noTransactionsDescWithWallet
                  : copy.noTransactionsDescWithoutWallet
              }
              icon={ReceiptText}
              onAction={
                wallets.length > 0 ? () => handleOpenModal() : undefined
              }
              title={copy.noTransactions}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        description={copy.formDescription}
        eyebrow={
          editing
            ? isVietnamese
              ? "C\u1eadp nh\u1eadt giao d\u1ecbch"
              : "Edit transaction"
            : isVietnamese
              ? "Ghi nh\u1eadn m\u1edbi"
              : "New transaction"
        }
        icon={ReceiptText}
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title={editing ? copy.editTransaction : copy.createTransactionTitle}
        tone="transaction"
      >
        <div className="space-y-3">
          {composerModeCopy ? (
            <div
              className={`rounded-[var(--app-radius-lg)] border px-4 py-3 ${composerModeCopy.tone}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                {composerModeCopy.badge}
              </p>
              <p className="mt-2 text-sm font-semibold">
                {composerModeCopy.title}
              </p>
              <p className="mt-1 text-xs leading-5 opacity-90">
                {composerModeCopy.description}
              </p>
            </div>
          ) : null}
          <DialogSection
            description={
              isVietnamese
                ? "Ch\u1ecdn lo\u1ea1i, tr\u1ea1ng th\u00e1i v\u00e0 s\u1ed1 ti\u1ec1n tr\u01b0\u1edbc khi g\u1eafn giao d\u1ecbch v\u00e0o v\u00ed."
                : "Set the transaction type, lifecycle status, and amount first."
            }
            title={isVietnamese ? "Thi\u1ebft l\u1eadp nhanh" : "Quick setup"}
          >
            <div className="grid gap-3 md:grid-cols-2">
                {/* loại */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {copy.type}
                </label>
                <Select
                  onChange={(event) =>
                    setFormValues((current) => {
                      const nextType = event.target.value as
                        | "INCOME"
                        | "EXPENSE";

                      if (nextType === current.type) {
                        return current;
                      }

                      return {
                        ...current,
                        type: nextType,
                        category:
                          nextType === "INCOME"
                            ? incomeCategoryOptions[0].value
                            : "",
                        budgetId: "",
                      };
                    })
                  }
                  value={formValues.type}
                >
                  <option value="EXPENSE">{copy.typeExpense}</option>
                  <option value="INCOME">{copy.typeIncome}</option>
                </Select>
              </div>
                {/* trạng thái */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {copy.status}
                </label>
                <Select
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      status: event.target.value as TransactionStatus,
                    }))
                  }
                  value={formValues.status}
                >
                  <option value="COMPLETED">
                    {getTransactionStatusLabel("COMPLETED")}
                  </option>
                  <option value="SCHEDULED">
                    {getTransactionStatusLabel("SCHEDULED")}
                  </option>
                  <option value="PENDING">
                    {getTransactionStatusLabel("PENDING")}
                  </option>
                </Select>
              </div>
                {/* số tiền */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  {copy.amount}
                </label>
                
                <AmountInput
                  className="w-full"
                  onChange={handleAmountChange}
                  value={amountInput}
                  placeholder={copy.amount}
                  type="desktop"
                />
              </div>
            </div>
          </DialogSection>

          <DialogSection
            description={
              isVietnamese
                ? "Kho\u1ea3n chi s\u1ebd \u0111i theo ng\u00e2n s\u00e1ch c\u1ee7a v\u00ed, c\u00f2n kho\u1ea3n thu s\u1ebd d\u00f9ng nh\u00f3m thu nh\u1eadp."
                : "Expenses follow wallet budgets while income uses dedicated income groups."
            }
            title={
              isVietnamese
                ? "Ngu\u1ed3n ti\u1ec1n v\u00e0 ph\u00e2n lo\u1ea1i"
                : "Source and classification"
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {formValues.type === "EXPENSE"
                    ? copy.expenseBudget
                    : copy.incomeCategory}
                </label>
                {formValues.type === "EXPENSE" ? (
                  <>
                    <Select
                      onChange={(event) => {
                        const nextBudget = expenseBudgets.find(
                          (budget) => budget._id === event.target.value,
                        );

                        setFormValues((current) => ({
                          ...current,
                          budgetId: event.target.value,
                          category: nextBudget?.category || "",
                        }));
                      }}
                      value={formValues.budgetId}
                    >
                      <option value="">{copy.selectBudget}</option>
                      {expenseBudgets.map((budget) => (
                        <option key={budget._id} value={budget._id}>
                          {`${budget.category} - ${formatCurrency(
                            budget.remaining,
                          )} / ${formatCurrency(budget.amount)}`}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {expenseBudgetsLoading
                        ? copy.loadingBudgets
                        : expenseBudgets.length > 0
                          ? copy.budgetHint
                          : copy.budgetEmpty}
                    </p>
                  </>
                ) : (
                  <Select
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        category: event.target.value,
                        budgetId: "",
                      }))
                    }
                    value={formValues.category}
                  >
                    {incomeCategoryOptionsForForm.map((category) => (
                      <option key={category.value} value={category.value}>
                        {language === "vi" ? category.vi : category.en}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {copy.wallet}
                </label>
                <Select
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      walletId: event.target.value,
                      ...(current.type === "EXPENSE"
                        ? { budgetId: "", category: "" }
                        : {}),
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
          </DialogSection>

          <DialogSection
            description={
              isVietnamese
                ? "Ghi th\u00eam ng\u1eef c\u1ea3nh \u0111\u1ec3 sau n\u00e0y xem l\u1ea1i d\u00f2ng ti\u1ec1n d\u1ec5 h\u01a1n."
                : "Add the date and context so the entry remains clear later."
            }
            title={
              isVietnamese
                ? "Th\u1eddi \u0111i\u1ec3m v\u00e0 ghi ch\u00fa"
                : "Timing and note"
            }
          >
            <div>
              <label className="mb-2 block text-sm font-medium">
                {copy.date}
              </label>
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
              <p className="mt-2 text-xs text-muted-foreground">
                {copy.statusHelp}
              </p>
            </div>

            <div>
              <label
                className={`mb-2 block text-sm font-medium ${
                  shouldHighlightIncomeOtherNote ? "text-amber-700" : ""
                }`}
              >
                {copy.note}
              </label>
              <Textarea
                className={
                  shouldHighlightIncomeOtherNote
                    ? "border-amber-300 bg-amber-50/40 focus-visible:ring-amber-200"
                    : undefined
                }
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder={
                  shouldHighlightIncomeOtherNote
                    ? copy.otherIncomeNotePlaceholder
                    : copy.whatHappened
                }
                value={formValues.note}
              />
              {shouldHighlightIncomeOtherNote ? (
                <p className="mt-2 text-xs text-amber-700">
                  {copy.otherIncomeNoteHint}
                </p>
              ) : null}
            </div>
          </DialogSection>

          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={() => setModalOpen(false)}
              variant="outline"
            >
              {copy.cancel}
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting
                ? copy.saving
                : editing
                  ? copy.updateTransaction
                  : copy.createTransaction}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>

      <ConfirmDialog
        busy={submitting}
        cancelLabel={copy.keep}
        confirmLabel={copy.delete}
        description={
          pendingDelete ? getDeleteWarningDescription(pendingDelete) : ""
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
