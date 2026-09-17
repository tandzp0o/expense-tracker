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
  Plus,
  Receipt,
  ReceiptText,
} from "lucide-react";
import {
  FeatureGuideDialog,
  useFeatureGuide,
} from "components/app/feature-guide";
import { getFeatureGuideCopy } from "components/app/feature-guide-content";
import { auth } from "lib/firebase/config";
import {
  formatCurrency,
  formatDate,
  formatWholeNumberInput,
  toDateInputValue,
} from "utils/formatters";
import { useLocale } from "contexts/LocaleContext";
import { useQuests } from "contexts/QuestContext";
import { useToast } from "contexts/ToastContext";
import { useDebounce } from "hooks/useDebounce";
import { PageHeader } from "components/app/page-header";
import { Button } from "components/ui/button";
import {
  Card,
  CardContent,
} from "components/ui/card";
import { Spinner } from "components/ui/spinner";
import { DeleteTransactionModal } from "../modals/DeleteTransactionModal";
import { TransactionFormModal } from "../modals/TransactionFormModal";
import {
  categoryOptions,
  incomeCategoryOptions,
  transactionStatusText,
  DEFAULT_EXPENSE_CATEGORY,
} from "../constants";
import { budgetApi, transactionApi, walletApi } from "../services/transactionApi";
import { TransactionFilters } from "../components/TransactionFilters";
import {
  TransactionList,
  type Transaction,
  type TransactionStatus,
} from "../components/TransactionList";
import type { WalletItem } from "../components/TransactionFilters";

dayjs.locale("vi");

type TransactionComposerMode = "manual" | "voice" | "scan";

interface BudgetOption {
  _id: string;
  walletId: string;
  walletName: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
}

interface TransactionWarning {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// The server records what actually happened instead of refusing it, and reports
// what it had to bend (a wallet going negative, a budget over its cap, a future
// date turned into a schedule) as warnings to read after the fact.
const extractWarnings = (response: any): TransactionWarning[] => {
  const warnings = response?.warnings ?? response?.data?.warnings;

  return Array.isArray(warnings) ? warnings : [];
};

const transactionTypeText = {
  INCOME: { vi: "Thu nhập", en: "Income" },
  EXPENSE: { vi: "Chi tiêu", en: "Expense" },
  GOAL_DEPOSIT: { vi: "Nạp mục tiêu", en: "Goal deposit" },
  GOAL_WITHDRAW: { vi: "Rút mục tiêu", en: "Goal withdrawal" },
} as const;

// vi-VN groups thousands with dots, so "1.000.000" is a million rather than a
// one with decimals. Only a single comma can be the decimal mark, or a lone dot
// that cannot be a group of three; every other separator is grouping.
const findDecimalSeparatorIndex = (value: string) => {
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if ((value.match(/,/g) || []).length === 1 && lastComma > lastDot) {
    return lastComma;
  }

  if (
    lastComma < 0 &&
    (value.match(/\./g) || []).length === 1 &&
    value.length - lastDot - 1 !== 3
  ) {
    return lastDot;
  }

  return -1;
};

const parseAmount = (raw: unknown) => {
  if (typeof raw === "number") {
    return raw;
  }

  if (typeof raw !== "string") {
    return 0;
  }

  const cleaned = raw.replace(/[^0-9.,-]/g, "");
  if (!cleaned) {
    return 0;
  }

  const sign = cleaned.startsWith("-") ? -1 : 1;
  const body = cleaned.replace(/-/g, "");
  const decimalIndex = findDecimalSeparatorIndex(body);
  const whole = (
    decimalIndex < 0 ? body : body.slice(0, decimalIndex)
  ).replace(/[^0-9]/g, "");
  const fraction =
    decimalIndex < 0
      ? ""
      : body.slice(decimalIndex + 1).replace(/[^0-9]/g, "");
  const parsed = Number(`${whole || "0"}.${fraction || "0"}`);

  return Number.isFinite(parsed) ? sign * parsed : 0;
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

const TransactionsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, isVietnamese, timezoneOffsetMinutes } = useLocale();
  const { stats: questStats, refresh: refreshQuestStats } = useQuests();
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
    date: toDateInputValue(new Date(), timezoneOffsetMinutes),
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
        pageIncome: "Thu tháng này",
        pageExpense: "Chi tháng này",
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
        pageIncome: "Income this month",
        pageExpense: "Expense this month",
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
      ? "Cứ chọn đúng ngày khoản tiền thực sự xảy ra, kể cả khi bạn ghi lại muộn."
      : "Pick the day this actually happened, even when you are logging it late.",
    plannedDeleteWarning: (label: string) =>
      isVietnamese
        ? `Xóa "${label}"? Đây là khoản kế hoạch nên số dư sẽ không thay đổi.`
        : `Delete "${label}"? This is a planned item, so balances will not change.`,
    plannedDeleteSuccess: isVietnamese
      ? "Khoản kế hoạch đã được gỡ khỏi danh sách."
      : "The planned item has been removed.",
    futureDateHint: isVietnamese
      ? "Ngày này ở tương lai nên khoản sẽ được lưu ở trạng thái Đã lên lịch."
      : "This date is in the future, so it will be saved as Scheduled.",
    expenseBudget: isVietnamese
      ? "Ngân sách chi tiêu"
      : "Expense budget",
    incomeCategory: isVietnamese
      ? "Nhóm thu nhập"
      : "Income category",
    expenseCategoryHint: isVietnamese
      ? "Danh mục quyết định khoản chi này nằm ở đâu trong báo cáo. Ngân sách chỉ thêm hạn mức cho danh mục đó."
      : "The category decides where this expense appears in reports. A budget only adds a limit on top of it.",
    noteOptional: isVietnamese ? "Ghi chú (không bắt buộc)" : "Note (optional)",
    selectBudget: isVietnamese ? "Không gắn ngân sách" : "No budget",
    linkedBudgetMissing: isVietnamese
      ? "Ngân sách đã gắn trước đó (không thuộc tháng này)"
      : "Previously linked budget (outside this month)",
    budgetHint: isVietnamese
      ? "Chọn ngân sách nếu bạn muốn khoản chi này được trừ vào hạn mức tháng. Bỏ trống cũng được, khoản chi vẫn được ghi theo danh mục bạn chọn."
      : "Pick a budget if you want this expense counted against a monthly limit. Leaving it empty is fine, the expense keeps the category you chose.",
    budgetEmpty: isVietnamese
      ? "Tháng đã chọn chưa có ngân sách nào, khoản chi vẫn được ghi theo danh mục bạn chọn. Chỉ cần lập ngân sách khi bạn muốn đặt hạn mức cho một nhóm chi."
      : "No budget exists for the selected month; the expense still keeps the category you chose. Create a budget only when you want a spending limit.",
    otherIncomeNoteHint: isVietnamese
      ? 'Bạn đang chọn "Khác", hãy ghi rõ nguồn thu ở phần ghi chú để dòng tiền không bị mơ hồ.'
      : 'You selected "Other". Add a clear note so this income source is not ambiguous.',
    otherIncomeNotePlaceholder: isVietnamese
      ? "Ví dụ: Tiền mừng, bán đồ cũ, hoàn tiền..."
      : "Example: Gift money, sold old item, reimbursement...",
    loadingBudgets: isVietnamese
      ? "Đang tải ngân sách..."
      : "Loading budgets...",
  };
  const todayDate = toDateInputValue(new Date(), timezoneOffsetMinutes);
  // A future date is never refused: the server stores it as SCHEDULED and the
  // form only says so, so people can log what they already know is coming.
  const isFutureDate = formValues.date > todayDate;
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
    const selectedDate = dayjs(
      formValues.date || toDateInputValue(new Date(), timezoneOffsetMinutes),
    );

    return {
      month: selectedDate.month() + 1,
      year: selectedDate.year(),
    };
  }, [formValues.date]);
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
  const expenseCategoryOptionsForForm = useMemo(() => {
    const currentCategory = String(formValues.category || "").trim();
    const hasCurrentCategory = categoryOptions.some(
      (item) => item.value === currentCategory,
    );

    if (
      formValues.type !== "EXPENSE" ||
      !currentCategory ||
      hasCurrentCategory
    ) {
      return categoryOptions;
    }

    // Older rows carry categories the taxonomy no longer offers; keeping the
    // stored value in the list is what stops an edit from silently changing it.
    return [
      ...categoryOptions,
      {
        value: currentCategory,
        vi: currentCategory,
        en: currentCategory,
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
    if (!modalOpen || formValues.type !== "EXPENSE") {
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

        // Most budgets apply to every wallet (walletId null); filtering by the
        // picked wallet hid exactly those, so the month is the only filter.
        const summary = await budgetApi.getBudgetSummary(
          {
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

        // An existing transaction keeps whatever it was saved with: its budget
        // may belong to another month or have been deleted, and dropping the
        // link here would quietly recategorise a row the user only came to fix.
        if (editing) {
          return;
        }

        setFormValues((current) => {
          // Budgets are optional and never auto-attached, so the only thing to
          // reconcile is a selection that is no longer offered for this month.
          if (
            current.type !== "EXPENSE" ||
            !current.budgetId ||
            nextBudgets.some((budget) => budget._id === current.budgetId)
          ) {
            return current;
          }

          return {
            ...current,
            budgetId: "",
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
    editing,
    formValues.type,
    modalOpen,
    toast,
  ]);

  useEffect(() => {
    if (!modalOpen || formValues.category) {
      return;
    }

    // Both pickers are always visible, so an empty category would show the
    // first option while saving something else.
    setFormValues((current) => ({
      ...current,
      category:
        current.type === "INCOME"
          ? incomeCategoryOptions[0].value
          : DEFAULT_EXPENSE_CATEGORY,
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
        date: toDateInputValue(transaction.date, timezoneOffsetMinutes),
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
        category: DEFAULT_EXPENSE_CATEGORY,
        budgetId: "",
        walletId: wallets[0]?._id || "",
        date: toDateInputValue(new Date(), timezoneOffsetMinutes),
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

    // Nothing else blocks the save: the note is optional and a future date is
    // stored as a scheduled item, because refusing an entry only means the
    // spending never gets recorded at all.
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
        // The category is the user's own answer to "what was this?", not a
        // side effect of the budget they happened to pick.
        category:
          String(formValues.category || "").trim() ||
          (formValues.type === "EXPENSE" ? DEFAULT_EXPENSE_CATEGORY : ""),
        // JSON.stringify drops undefined, so clearing the budget has to travel
        // as an explicit null or the server keeps the previous link.
        budgetId:
          formValues.type === "EXPENSE" && formValues.budgetId
            ? formValues.budgetId
            : null,
        // Midday of the picked day *in the selected timezone*, so the stored
        // instant lands on that calendar day no matter where it is read from.
        date: new Date(
          Date.UTC(
            Number(formValues.date.slice(0, 4)),
            Number(formValues.date.slice(5, 7)) - 1,
            Number(formValues.date.slice(8, 10)),
            12,
          ) +
            timezoneOffsetMinutes * 60 * 1000,
        ).toISOString(),
        // The server decides whether a date is in the future; without this it
        // would judge "today" in its own timezone, not the user's.
        timezoneOffset: timezoneOffsetMinutes,
      };

      const response = editing
        ? await transactionApi.updateTransaction(editing._id, payload, token)
        : await transactionApi.createTransaction(payload, token);

      toast({
        title: editing ? copy.transactionUpdated : copy.transactionCreated,
        variant: "success",
      });

      // The save already s쳮ded, so anything the server adjusted is news to
      // pass on, not an error to alarm the user with.
      extractWarnings(response).forEach((warning) => {
        toast({
          title: warning.message,
          variant: "default",
        });
      });

      setModalOpen(false);
      setAmountInput("");
      await fetchAll();
      await refreshQuestStats();
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
      await refreshQuestStats();
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

  // Totals cover the whole current month, not just the rows on this page, so
  // they come from the server-side monthly aggregate rather than the page data.
  const totals = useMemo(
    () => ({
      income: questStats.monthlyIncome,
      expense: questStats.monthlyExpense,
    }),
    [questStats.monthlyExpense, questStats.monthlyIncome],
  );

  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));

  const featureGuide = useFeatureGuide("transactions", !loading);
  const featureGuideCopy = getFeatureGuideCopy("transactions", isVietnamese);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <FeatureGuideDialog
        copy={featureGuideCopy}
        icon={Receipt}
        isVietnamese={isVietnamese}
        onAction={() => {
          featureGuide.dismiss();
          handleOpenModal();
        }}
        onSkip={featureGuide.dismiss}
        open={featureGuide.open}
      />

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
            <TransactionFilters
              categoryFilterOptions={categoryFilterOptions}
              copy={{
                allCategories: copy.allCategories,
                allStatuses: copy.allStatuses,
                allWallets: copy.allWallets,
                reset: copy.reset,
                searchByNote: copy.searchByNote,
              }}
              getCategoryLabel={getCategoryLabel}
              language={language}
              onCategoryChange={(value) => {
                setPage(1);
                setSelectedCategory(value);
              }}
              onReset={resetFilters}
              onSearchChange={(value) => {
                setPage(1);
                setSearchQuery(value);
              }}
              onStatusChange={(value) => {
                setPage(1);
                setSelectedStatus(value);
              }}
              onWalletChange={(value) => {
                setPage(1);
                setSelectedWallet(value);
              }}
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              selectedStatus={selectedStatus}
              selectedWallet={selectedWallet}
              statusOptions={
                Object.entries(transactionStatusText) as Array<
                  [TransactionStatus, { en: string; vi: string }]
                >
              }
              wallets={wallets}
            />
          </CardContent>
        </Card>
      </div>

      <TransactionList
        copy={{
          action: copy.action,
          amount: copy.amount,
          category: copy.category,
          createTransaction: copy.createTransaction,
          date: copy.date,
          next: copy.next,
          noTransactions: copy.noTransactions,
          noTransactionsDescWithWallet: copy.noTransactionsDescWithWallet,
          noTransactionsDescWithoutWallet: copy.noTransactionsDescWithoutWallet,
          note: copy.note,
          previous: copy.previous,
          showingRows: copy.showingRows,
          status: copy.status,
          transactionList: copy.transactionList,
          transactionListDesc: copy.transactionListDesc,
          type: copy.type,
          untitledTransaction: copy.untitledTransaction,
          wallet: copy.wallet,
        }}
        emptyState={{
          actionLabel:
            wallets.length > 0 ? copy.createTransaction : undefined,
          description:
            wallets.length > 0
              ? copy.noTransactionsDescWithWallet
              : copy.noTransactionsDescWithoutWallet,
          icon: ReceiptText,
          onAction:
            wallets.length > 0 ? () => handleOpenModal() : undefined,
          title: copy.noTransactions,
        }}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
        getCategoryLabel={getCategoryLabel}
        getTransactionStatus={getTransactionStatus}
        getTransactionStatusLabel={getTransactionStatusLabel}
        getTransactionTypeLabel={getTransactionTypeLabel}
        getWalletName={getWalletName}
        header={{
          description: copy.transactionListDesc(
            page,
            totalPages,
            totalTransactions,
          ),
          title: copy.transactionList,
        }}
        onDelete={setPendingDelete}
        onEdit={handleOpenModal}
        onNextPage={() =>
          setPage((current) => Math.min(totalPages, current + 1))
        }
        onPrevPage={() => setPage((current) => Math.max(1, current - 1))}
        page={page}
        parseAmount={parseAmount}
        totalPages={totalPages}
        totalTransactions={totalTransactions}
        transactions={transactions}
      />

      <TransactionFormModal
        amountInput={amountInput}
        composerModeCopy={composerModeCopy}
        copy={{
          amount: copy.amount,
          budgetEmpty: copy.budgetEmpty,
          budgetHint: copy.budgetHint,
          cancel: copy.cancel,
          category: copy.category,
          createTransaction: copy.createTransaction,
          createTransactionTitle: copy.createTransactionTitle,
          date: copy.date,
          editTransaction: copy.editTransaction,
          expenseBudget: copy.expenseBudget,
          expenseCategoryHint: copy.expenseCategoryHint,
          formDescription: copy.formDescription,
          futureDateHint: copy.futureDateHint,
          incomeCategory: copy.incomeCategory,
          linkedBudgetMissing: copy.linkedBudgetMissing,
          loadingBudgets: copy.loadingBudgets,
          noteOptional: copy.noteOptional,
          otherIncomeNoteHint: copy.otherIncomeNoteHint,
          otherIncomeNotePlaceholder: copy.otherIncomeNotePlaceholder,
          saving: copy.saving,
          selectBudget: copy.selectBudget,
          selectWallet: copy.selectWallet,
          status: copy.status,
          statusHelp: copy.statusHelp,
          type: copy.type,
          typeExpense: copy.typeExpense,
          typeIncome: copy.typeIncome,
          updateTransaction: copy.updateTransaction,
          wallet: copy.wallet,
          whatHappened: copy.whatHappened,
        }}
        editing={editing}
        expenseBudgets={expenseBudgets}
        expenseBudgetsLoading={expenseBudgetsLoading}
        expenseCategoryOptionsForForm={expenseCategoryOptionsForForm}
        formatCurrency={formatCurrency}
        formValues={formValues}
        getTransactionStatusLabel={getTransactionStatusLabel}
        incomeCategoryOptionsForForm={incomeCategoryOptionsForForm}
        isFutureDate={isFutureDate}
        isVietnamese={isVietnamese}
        language={language}
        onAmountChange={handleAmountChange}
        onClose={() => setModalOpen(false)}
        onFormValuesChange={setFormValues}
        onSubmit={handleSubmit}
        open={modalOpen}
        shouldHighlightIncomeOtherNote={shouldHighlightIncomeOtherNote}
        submitting={submitting}
        wallets={wallets}
      />

      <DeleteTransactionModal
        copy={{
          delete: copy.delete,
          deleteTransaction: copy.deleteTransaction,
          keep: copy.keep,
        }}
        description={
          pendingDelete ? getDeleteWarningDescription(pendingDelete) : ""
        }
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        submitting={submitting}
        transaction={pendingDelete}
      />
    </div>
  );
};

export default TransactionsPage;
