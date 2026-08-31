/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
  ArrowLeftRight,
  Building2,
  Car,
  ChartPie,
  ChevronRight,
  CreditCard,
  Home,
  PencilLine,
  Plane,
  Plus,
  ShoppingCart,
  Smartphone,
  Trash2,
  UtensilsCrossed,
  Wallet,
  WalletCards,
} from "lucide-react";
import { auth } from "lib/firebase/config";
import { budgetApi, transactionApi, userApi, walletApi } from "services/api";
import {
  formatCurrency,
  formatWholeNumberInput,
} from "utils/formatters";
import { useAuth } from "contexts/AuthContext";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import {
  getAppearanceGradientColors,
  useTheme,
} from "contexts/ThemeContext";
import { hexToRgba } from "lib/utils";
import { PageHeader } from "components/app/page-header";
import { MetricCard } from "components/app/metric-card";
import { EmptyState } from "components/app/empty-state";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import { MoneyField } from "components/app/money-field";
import { Select } from "components/ui/select";
import { Spinner } from "components/ui/spinner";
import WalletOnboardingDialog from "../components/WalletOnboardingDialog";
import LineChart from "components/charts/LineChart";
import { colorOptions, walletTypeText } from "../constants";
import { ConfirmWalletTypeChangeModal } from "../modals/ConfirmWalletTypeChangeModal";
import { DeleteWalletModal } from "../modals/DeleteWalletModal";
import { WalletFormModal } from "../modals/WalletFormModal";
import type { WalletFormValues } from "../modals/WalletFormModal";

dayjs.locale("vi");

interface WalletItem {
  _id: string;
  name: string;
  accountNumber?: string;
  balance: number;
  initialBalance?: number;
  imageUrl?: string;
  type: "cash" | "bank" | "ewallet";
  currency: string;
  icon?: string;
  color?: string;
  isArchived?: boolean;
  hasTransactions?: boolean;
  updatedAt: string;
}

interface WalletBudgetItem {
  _id: string;
  walletId: string;
  walletName: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  overspent?: number;
  color?: string;
}

interface WalletBudgetSummaryItem {
  walletId: string;
  walletName: string;
  walletCurrency: string;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  overspent: number;
  items: WalletBudgetItem[];
}

interface WalletBudgetSummaryResponse {
  month: number;
  year: number;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  walletSummaries: WalletBudgetSummaryItem[];
  items: WalletBudgetItem[];
}

const walletIconMap = {
  account_balance: Building2,
  payments: Wallet,
  credit_card: CreditCard,
  phone_android: Smartphone,
  wallet: WalletCards,
  home: Home,
  directions_car: Car,
  flight: Plane,
  shopping_cart: ShoppingCart,
  restaurant: UtensilsCrossed,
} as const;

const getTransferDestinationWalletId = (
  walletList: WalletItem[],
  fromWalletId: string,
  preferredToWalletId: string = "",
) => {
  if (!fromWalletId) {
    return preferredToWalletId &&
      walletList.some((wallet) => wallet._id === preferredToWalletId)
      ? preferredToWalletId
      : "";
  }

  const destinationWallets = walletList.filter(
    (wallet) => wallet._id !== fromWalletId,
  );

  if (
    preferredToWalletId &&
    destinationWallets.some((wallet) => wallet._id === preferredToWalletId)
  ) {
    return preferredToWalletId;
  }

  return destinationWallets[0]?._id || "";
};

const Wallets: React.FC = () => {
  const { currentUser, updateUserStatus } = useAuth();
  const { defaultCurrency, language, isVietnamese, timezoneOffsetMinutes } =
    useLocale();
  const { toast } = useToast();
  const { appearance } = useTheme();
  const themeColors = getAppearanceGradientColors(appearance);
  const baseCopy = isVietnamese
    ? {
        loadFailed: "Không thể tải ví",
        retry: "Vui lòng thử lại.",
        walletNameRequired: "Cần nhập tên ví",
        walletNameRequiredDesc: "Vui lòng nhập tên ví.",
        walletUpdated: "Đã cập nhật ví",
        walletCreated: "Đã tạo ví",
        initialBalanceLocked: "Số dư ban đầu đã bị khóa",
        initialBalanceLockedDesc:
          "Ví này đã có giao dịch. Hãy dùng giao dịch điều chỉnh thay vì sửa số dư ban đầu.",
        currencyCannotChange: "Không thể đổi tiền tệ",
        currencyCannotChangeDesc:
          "Ví này đã có giao dịch. Hãy tạo ví mới nếu cần dùng loại tiền khác.",
        saveFailed: "Lưu thất bại",
        saveFailedDesc: "Không thể lưu ví.",
        walletArchived: "Ví đã được lưu trữ",
        walletDeleted: "Đã xóa ví",
        deleteFailed: "Xóa thất bại",
        deleteFailedDesc: "Không thể xóa ví.",
        walletSelectionRequired: "Cần chọn ví",
        walletSelectionRequiredDesc: "Hãy chọn cả ví nguồn và ví đích.",
        differentWalletsRequired: "Hai ví phải khác nhau",
        differentWalletsRequiredDesc:
          "Ví nguồn và ví đích không được trùng nhau.",
        invalidTransferAmount: "Số tiền chuyển không hợp lệ",
        invalidTransferAmountDesc: "Số tiền phải lớn hơn 0.",
        transferCompleted: "Đã chuyển tiền",
        transferFailed: "Chuyển tiền thất bại",
        transferFailedDesc: "Không thể hoàn tất chuyển tiền nội bộ.",
        pageTitle: "Ví tiền",
        pageDescription:
          "Màn ví giữ nguyên luồng tạo, cập nhật, lưu trữ/xóa và chuyển nội bộ theo các API hiện có.",
        newWallet: "Thêm ví",
        totalBalance: "Tổng số dư",
        activeWallets: (count: number) => `${count} ví đang hoạt động`,
        walletCount: "Số lượng ví",
        monthOverMonthGrowth: (growth: number) =>
          `${growth}% tăng trưởng tài sản theo tháng`,
        transfersReady: "Sẵn sàng chuyển",
        transferReadyDesc:
          "Chuyển nội bộ được tạo ở client bằng cách ghi 2 giao dịch đối ứng",
        yes: "Có",
        needTwoWallets: "Cần 2 ví",
        hasHistory: "Đã có giao dịch",
        edit: "Chỉnh sửa",
        balanceTrend: "Xu hướng số dư",
        balanceTrendDesc: "Lịch sử 6 tháng từ API thống kê hồ sơ.",
        internalTransfer: "Chuyển nội bộ",
        internalTransferDesc:
          "Màn này tạo một giao dịch chi và một giao dịch thu vì backend chưa có transfer endpoint riêng.",
        fromWallet: "Từ ví",
        toWallet: "Đến ví",
        selectSource: "Chọn ví nguồn",
        selectDestination: "Chọn ví đích",
        amount: "Số tiền",
        transferNow: "Chuyển ngay",
        notEnoughWallets: "Chưa đủ ví",
        notEnoughWalletsDesc:
          "Hãy tạo ít nhất 2 ví trước khi dùng chuyển nội bộ.",
        noWallets: "Chưa có ví",
        noWalletsDesc:
          "Ví là thực thể gốc cho giao dịch, phân tích và theo dõi số dư.",
        createWallet: "Tạo ví",
        formDescription:
          "Biểu mẫu ví giữ nguyên upload ảnh, icon, màu, loại ví, tiền tệ và các rule nghiệp vụ từ backend.",
        editWallet: "Chỉnh sửa ví",
        createWalletTitle: "Tạo ví",
        cardImage: "Ảnh thẻ",
        walletPreview: "Xem trước ví",
        walletName: "Tên ví",
        walletNamePlaceholder: "Tiền mặt, Techcombank, Momo...",
        accountNumber: "Số tài khoản",
        walletType: "Loại ví",
        currency: "Tiền tệ",
        icon: "Biểu tượng",
        auto: "Tự động",
        iconPlaceholder: "Ví dụ: wallet, credit_card, phone_android...",
        iconHint:
          "Bạn có thể gõ hoặc dán tên biểu tượng. Danh sách gợi ý sẽ xuất hiện khi bạn nhập.",
        accentColor: "Màu nhấn",
        startingBalance: "Số dư ban đầu",
        startingBalancePlaceholder: "Ví dụ: 1.000.000",
        cancel: "Hủy",
        saving: "Đang lưu...",
        updateWallet: "Cập nhật ví",
        keep: "Giữ lại",
        archive: "Lưu trữ",
        delete: "Xóa",
        removeWallet: "Xóa ví",
        archiveWalletDesc:
          "Ví này đã có giao dịch nên sẽ được lưu trữ thay vì xóa cứng.",
        deleteWalletDesc: (name: string) => `Xóa ví "${name}"?`,
        confirmTypeChange: "Xác nhận đổi loại ví",
        changeType: "Đổi loại",
        changeTypeDesc:
          "Đổi loại ví sẽ ảnh hưởng cách các báo cáo lịch sử phân loại ví này. Bạn có muốn tiếp tục không?",
        balanceSeriesLabel: "Số dư",
        transferCategory: "Transfer",
        transferTo: (name?: string) => `Chuyển tới ${name || "ví đích"}`,
        transferFrom: (name?: string) => `Nhận từ ${name || "ví nguồn"}`,
      }
    : {
        loadFailed: "Could not load wallets",
        retry: "Please retry.",
        walletNameRequired: "Wallet name required",
        walletNameRequiredDesc: "Please enter a wallet name.",
        walletUpdated: "Wallet updated",
        walletCreated: "Wallet created",
        initialBalanceLocked: "Initial balance locked",
        initialBalanceLockedDesc:
          "This wallet already has transactions. Use an adjustment transaction instead of changing initial balance.",
        currencyCannotChange: "Currency cannot be changed",
        currencyCannotChangeDesc:
          "This wallet already has transactions. Create a new wallet for another currency.",
        saveFailed: "Save failed",
        saveFailedDesc: "Wallet could not be saved.",
        walletArchived: "Wallet archived",
        walletDeleted: "Wallet deleted",
        deleteFailed: "Delete failed",
        deleteFailedDesc: "Wallet could not be removed.",
        walletSelectionRequired: "Wallet selection required",
        walletSelectionRequiredDesc:
          "Choose both source and destination wallets.",
        differentWalletsRequired: "Different wallets required",
        differentWalletsRequiredDesc:
          "Source and destination wallets must be different.",
        invalidTransferAmount: "Invalid transfer amount",
        invalidTransferAmountDesc: "Amount must be greater than zero.",
        transferCompleted: "Transfer completed",
        transferFailed: "Transfer failed",
        transferFailedDesc: "Internal transfer could not be completed.",
        pageTitle: "Wallets",
        pageDescription:
          "Wallet page keeps create, update, archive/delete and internal transfer flows tied to the existing APIs.",
        newWallet: "New wallet",
        totalBalance: "Total balance",
        activeWallets: (count: number) => `${count} active wallet(s)`,
        walletCount: "Wallet count",
        monthOverMonthGrowth: (growth: number) =>
          `${growth}% month-over-month asset growth`,
        transfersReady: "Transfers ready",
        transferReadyDesc:
          "Internal transfer stays client-driven by creating paired transactions",
        yes: "Yes",
        needTwoWallets: "Need 2 wallets",
        hasHistory: "Has history",
        edit: "Edit",
        balanceTrend: "Balance trend",
        balanceTrendDesc: "Six month history from the profile stats API.",
        internalTransfer: "Internal transfer",
        internalTransferDesc:
          "This creates one expense and one income transaction because the backend has no dedicated transfer endpoint.",
        fromWallet: "From wallet",
        toWallet: "To wallet",
        selectSource: "Select source",
        selectDestination: "Select destination",
        amount: "Amount",
        transferNow: "Transfer now",
        notEnoughWallets: "Not enough wallets",
        notEnoughWalletsDesc:
          "Create at least two wallets before using internal transfer.",
        noWallets: "No wallets yet",
        noWalletsDesc:
          "Wallets are the base entity for transactions, analytics and balance tracking.",
        createWallet: "Create wallet",
        formDescription:
          "Wallet form keeps image upload, icon, color, type, currency and business rules from the backend.",
        editWallet: "Edit wallet",
        createWalletTitle: "Create wallet",
        cardImage: "Card image",
        walletPreview: "Wallet preview",
        walletName: "Wallet name",
        walletNamePlaceholder: "Cash, Techcombank, Momo...",
        accountNumber: "Account number",
        walletType: "Wallet type",
        currency: "Currency",
        icon: "Icon",
        auto: "Auto",
        iconPlaceholder: "Example: wallet, credit_card, phone_android...",
        iconHint:
          "Type or paste an icon name. Suggested values appear as you type.",
        accentColor: "Accent color",
        startingBalance: "Starting balance",
        startingBalancePlaceholder: "Example: 1.000.000",
        cancel: "Cancel",
        saving: "Saving...",
        updateWallet: "Update wallet",
        keep: "Keep",
        archive: "Archive",
        delete: "Delete",
        removeWallet: "Remove wallet",
        archiveWalletDesc:
          "This wallet already has transactions, so it will be archived instead of hard deleted.",
        deleteWalletDesc: (name: string) => `Delete wallet "${name}"?`,
        confirmTypeChange: "Confirm wallet type change",
        changeType: "Change type",
        changeTypeDesc:
          "Changing wallet type will affect how historical reports classify this wallet. Continue?",
        balanceSeriesLabel: "Balance",
        transferCategory: "Transfer",
        transferTo: (name?: string) =>
          `Transfer to ${name || "destination wallet"}`,
        transferFrom: (name?: string) =>
          `Received from ${name || "source wallet"}`,
      };
  const copy = {
    ...baseCopy,
    pageTitle: isVietnamese ? "Ví tiền" : "Wallets",
    pageDescription: isVietnamese
      ? "Quản lý ví, số dư và chuyển tiền nội bộ thật gọn trong một nơi."
      : "Manage wallets, balances, and internal transfers in one place.",
    transferReadyDesc: isVietnamese
      ? "Có thể chuyển tiền khi bạn đã có ít nhất hai ví."
      : "Transfers are available once you have at least two wallets.",
    balanceTrendDesc: isVietnamese
      ? "Theo dõi biến động số dư trong 6 tháng gần đây."
      : "Follow your balance movement over the last six months.",
    internalTransferDesc: isVietnamese
      ? "Chuyển nhanh tiền giữa các ví đang có."
      : "Move money quickly between your wallets.",
    noWalletsDesc: isVietnamese
      ? "Tạo ví đầu tiên để bắt đầu ghi nhận và theo dõi số dư."
      : "Create your first wallet to start tracking balances.",
    formDescription: isVietnamese
      ? "Điền các thông tin cơ bản để tạo hoặc cập nhật ví."
      : "Fill in the key details to create or update a wallet.",
    freeToSpend: isVietnamese ? "Ti\u1ec1n t\u1ef1 do" : "Free to spend",
    budgetReserved: isVietnamese
      ? "Gi\u1eef cho ng\u00e2n s\u00e1ch"
      : "Reserved for budgets",
    walletAllocation: isVietnamese
      ? "Ph\u00e2n b\u1ed5 trong v\u00ed"
      : "Wallet allocation",
    walletAllocationDetails: isVietnamese
      ? "Chi ti\u1ebft ph\u00e2n b\u1ed5"
      : "Allocation details",
    backToCard: isVietnamese ? "Quay l\u1ea1i" : "Back",
    walletAllocationDesc: isVietnamese
      ? "Thanh d\u01b0\u1edbi \u0111\u00e2y cho bi\u1ebft s\u1ed1 d\u01b0 t\u1ef1 do v\u00e0 ph\u1ea7n c\u00f2n l\u1ea1i c\u1ee7a t\u1eebng ng\u00e2n s\u00e1ch trong v\u00ed."
      : "The bar below splits free balance and remaining budget allocations inside this wallet.",
    noBudgetReserve: isVietnamese
      ? "Ch\u01b0a c\u00f3 ng\u00e2n s\u00e1ch n\u00e0o g\u1eafn v\u1edbi v\u00ed n\u00e0y trong th\u00e1ng hi\u1ec7n t\u1ea1i."
      : "No budgets are linked to this wallet in the current month.",
    oversubscribedWallet: isVietnamese
      ? "Ng\u00e2n s\u00e1ch c\u00f2n l\u1ea1i \u0111ang l\u1edbn h\u01a1n s\u1ed1 d\u01b0 v\u00ed, c\u1ea7n gi\u1ea3m reserve ho\u1eb7c n\u1ea1p th\u00eam ti\u1ec1n."
      : "Remaining budget reserves are larger than the wallet balance. Reduce allocations or top up the wallet.",
  };
  const onboardingNoticeTitle = isVietnamese
    ? "Ví tiền: lần đầu bạn truy cập app, hãy tạo 1 ví đầu tiên"
    : "Wallets: create your first wallet on your first visit";
  const onboardingNoticeDescription = isVietnamese
    ? "Bạn đang ở chế độ người dùng mới, nên các tab khác sẽ tạm khóa cho đến khi tạo ví đầu tiên. Chỉ cần tạo một ví để mở khóa giao dịch, ngân sách, mục tiêu và các báo cáo."
    : "You are currently in new user mode, so the other tabs stay locked until your first wallet is created. Create one wallet to unlock transactions, budgets, goals, and reports.";
  const onboardingBadgeLabel = isVietnamese ? "Người dùng mới" : "New user";
  const onboardingPageDescription = isVietnamese
    ? "Lần đầu truy cập app? Hãy tạo ví đầu tiên để mở khóa toàn bộ tính năng."
    : "First time in the app? Create your first wallet to unlock the rest of the experience.";
  const getWalletTypeLabel = (type: WalletItem["type"]) =>
    walletTypeText[type][language];
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [budgetSummary, setBudgetSummary] =
    useState<WalletBudgetSummaryResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WalletItem | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [pendingDelete, setPendingDelete] = useState<WalletItem | null>(null);
  const [confirmTypeChangeOpen, setConfirmTypeChangeOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [autoCreateRequested, setAutoCreateRequested] = useState(false);
  const [formValues, setFormValues] = useState<WalletFormValues>({
    name: "",
    accountNumber: "",
    initialBalance: 0,
    type: "cash",
    currency: defaultCurrency,
    icon: "",
    color: appearance.primaryColor,
  });
  const [initialBalanceInput, setInitialBalanceInput] = useState("");
  const [transferValues, setTransferValues] = useState({
    fromWalletId: "",
    toWalletId: "",
    amount: 0,
  });
  const [transferAmountInput, setTransferAmountInput] = useState("");
  const [expandedWalletId, setExpandedWalletId] = useState<string | null>(null);


  const onboardingStorageKey = useMemo(
    () =>
      currentUser?.uid ? `fintrack-wallet-onboarding:${currentUser.uid}` : "",
    [currentUser?.uid],
  );
  const onboardingSessionSkipKey = useMemo(
    () =>
      currentUser?.uid
        ? `fintrack-wallet-onboarding-session:${currentUser.uid}`
        : "",
    [currentUser?.uid],
  );
  const hasWallets = wallets.length > 0;
  const isGuideEligible = !!currentUser?.newUser && !hasWallets;
  const getGuideState = useCallback(() => {
    if (!onboardingStorageKey || typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(onboardingStorageKey);
  }, [onboardingStorageKey]);
  const getGuideSessionSkipState = useCallback(() => {
    if (!onboardingSessionSkipKey || typeof window === "undefined") {
      return null;
    }

    return window.sessionStorage.getItem(onboardingSessionSkipKey);
  }, [onboardingSessionSkipKey]);

  // Locale-derived error labels are intentionally reduced to stable primitives above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        return;
      }
      const [walletResponse, statsResponse, budgetSummaryResponse] =
        await Promise.all([
          walletApi.getWallets(token),
          userApi.getProfileStats(token),
          budgetApi.getBudgetSummary(
            {
              month: dayjs().month() + 1,
              year: dayjs().year(),
            },
            token,
          ),
        ]);

      const walletList = walletResponse?.wallets || [];
      setWallets(walletList);
      setStats(statsResponse?.data || statsResponse);
      setBudgetSummary(budgetSummaryResponse || null);

      if (walletList.length >= 2) {
        setTransferValues((current) => {
          const availableWalletIds = new Set(
            walletList.map((wallet: WalletItem) => wallet._id),
          );
          const nextFromWalletId = availableWalletIds.has(current.fromWalletId)
            ? current.fromWalletId
            : walletList[0]._id;
          const nextToWalletId = getTransferDestinationWalletId(
            walletList,
            nextFromWalletId,
            availableWalletIds.has(current.toWalletId)
              ? current.toWalletId
              : "",
          );

          return {
            ...current,
            fromWalletId: nextFromWalletId,
            toWalletId: nextToWalletId,
          };
        });
      } else {
        setTransferValues((current) => ({
          ...current,
          fromWalletId: walletList[0]?._id || "",
          toWalletId: "",
        }));
      }
    } catch (error: any) {
      toast({
        title: isVietnamese ? "Không thể tải ví" : "Could not load wallets",
        description:
          error.message ||
          (isVietnamese ? "Vui lòng thử lại." : "Please retry."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [isVietnamese, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!currentUser?.newUser || !hasWallets) {
      return;
    }
    updateUserStatus(false);
    if (onboardingStorageKey) {
      window.localStorage.setItem(onboardingStorageKey, "done");
    }
    if (onboardingSessionSkipKey) {
      window.sessionStorage.removeItem(onboardingSessionSkipKey);
    }
  }, [
    currentUser?.newUser,
    hasWallets,
    onboardingSessionSkipKey,
    onboardingStorageKey,
    updateUserStatus,
  ]);

  useEffect(() => {
    if (
      loading ||
      modalOpen ||
      autoCreateRequested ||
      !isGuideEligible ||
      !onboardingStorageKey
    ) {
      return;
    }

    if (getGuideSessionSkipState() === "skip" || getGuideState() === "done") {
      return;
    }

    setOnboardingOpen(true);
  }, [
    autoCreateRequested,
    getGuideSessionSkipState,
    getGuideState,
    isGuideEligible,
    loading,
    modalOpen,
    onboardingStorageKey,
  ]);

  useEffect(() => {
    if (!isGuideEligible) {
      setOnboardingOpen(false);
    }
  }, [isGuideEligible]);

  const finishOnboarding = (status: "done" | "skip") => {
    if (status === "done" && onboardingStorageKey) {
      window.localStorage.setItem(onboardingStorageKey, status);
    }
    if (status === "skip" && onboardingSessionSkipKey) {
      window.sessionStorage.setItem(onboardingSessionSkipKey, "skip");
    }
    if (status === "done" && onboardingSessionSkipKey) {
      window.sessionStorage.removeItem(onboardingSessionSkipKey);
    }
    setOnboardingOpen(false);
  };

  const openCreate = () => {
    setOnboardingOpen(false);
    setEditing(null);
    setFormValues({
      name: "",
      accountNumber: "",
      initialBalance: 0,
      type: "cash",
      currency: defaultCurrency,
      icon: "",
      color: appearance.primaryColor,
    });
    setInitialBalanceInput("");
    setImageFile(null);
    setImagePreview("");
    setModalOpen(true);
  };

  // "Create a wallet" from the locked-navigation notice lands here with
  // ?create=1 so the form opens immediately instead of just showing the page.
  useEffect(() => {
    if (loading || searchParams.get("create") !== "1") {
      return;
    }

    setAutoCreateRequested(true);
    openCreate();
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("create");
        return next;
      },
      { replace: true },
    );
    // openCreate only resets local form state; re-running on its identity would
    // wipe what the user has already typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams, setSearchParams]);

  const openEdit = (wallet: WalletItem) => {
    setEditing(wallet);
    setFormValues({
      name: wallet.name,
      accountNumber: wallet.accountNumber || "",
      initialBalance: wallet.initialBalance ?? wallet.balance,
      type: wallet.type,
      currency: wallet.currency || defaultCurrency,
      icon: wallet.icon || "",
      color: wallet.color || appearance.primaryColor,
    });
    setInitialBalanceInput(
      formatWholeNumberInput(wallet.initialBalance ?? wallet.balance),
    );
    setImageFile(null);
    setImagePreview(wallet.imageUrl || "");
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };
  const handleInitialBalanceChange = (value: string, numericValue: number) => {
    setInitialBalanceInput(value);
    setFormValues((current) => ({
      ...current,
      initialBalance: numericValue,
    }));
  };

  const handleTransferAmountChange = (value: string, numericValue: number) => {
    setTransferAmountInput(value);
    setTransferValues((current) => ({
      ...current,
      amount: numericValue,
    }));
  };
  const handleFromWalletChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextFromWalletId = event.target.value;

    setTransferValues((current) => ({
      ...current,
      fromWalletId: nextFromWalletId,
      toWalletId: getTransferDestinationWalletId(
        wallets,
        nextFromWalletId,
        current.toWalletId,
      ),
    }));
  };
  const handleToWalletChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextToWalletId = event.target.value;

    setTransferValues((current) => ({
      ...current,
      toWalletId:
        nextToWalletId && nextToWalletId === current.fromWalletId
          ? ""
          : nextToWalletId,
    }));
  };
  const transferDestinationWallets = useMemo(
    () =>
      wallets.filter((wallet) => wallet._id !== transferValues.fromWalletId),
    [wallets, transferValues.fromWalletId],
  );
  const walletBudgetSummaryMap = useMemo(
    () =>
      new Map(
        (budgetSummary?.walletSummaries || []).map((summary) => [
          summary.walletId,
          summary,
        ]),
      ),
    [budgetSummary],
  );

  const getBudgetColor = useCallback(
    (budget: WalletBudgetItem, index: number) =>
      budget.color || colorOptions[index % colorOptions.length],
    [],
  );

  const submitWallet = async (confirmTypeChange = false) => {
    if (!formValues.name.trim()) {
      toast({
        title: copy.walletNameRequired,
        description: copy.walletNameRequiredDesc,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const normalizedIcon = formValues.icon.trim();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        return;
      }

      const formData = new FormData();
      formData.append("name", formValues.name);
      formData.append("initialBalance", String(formValues.initialBalance));
      formData.append("type", formValues.type);
      formData.append("currency", formValues.currency);
      if (formValues.accountNumber) {
        formData.append("accountNumber", formValues.accountNumber);
      }
      if (normalizedIcon) {
        formData.append("icon", normalizedIcon);
      }
      if (formValues.color) {
        formData.append("color", formValues.color);
      }
      if (imageFile) {
        formData.append("image", imageFile);
      }
      if (confirmTypeChange) {
        formData.append("confirmTypeChange", "true");
      }

      if (editing) {
        await walletApi.updateWallet(editing._id, formData, token);
        toast({
          title: copy.walletUpdated,
          variant: "success",
        });
      } else {
        await walletApi.createWallet(formData, token);
        if (currentUser?.newUser) {
          updateUserStatus(false);
        }
        finishOnboarding("done");
        toast({
          title: copy.walletCreated,
          variant: "success",
        });
      }

      setConfirmTypeChangeOpen(false);
      setModalOpen(false);
      await fetchData();
    } catch (error: any) {
      const payload = error.payload || {};
      if (payload.requiresAdjustment) {
        toast({
          title: copy.initialBalanceLocked,
          description: copy.initialBalanceLockedDesc,
          variant: "destructive",
        });
      } else if (payload.requiresConfirmation && payload.field === "type") {
        setConfirmTypeChangeOpen(true);
      } else if (payload.field === "currency") {
        toast({
          title: copy.currencyCannotChange,
          description: copy.currencyCannotChangeDesc,
          variant: "destructive",
        });
      } else {
        toast({
          title: copy.saveFailed,
          description: error.message || copy.saveFailedDesc,
          variant: "destructive",
        });
      }
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
      const response: any = await walletApi.deleteWallet(
        pendingDelete._id,
        token,
      );
      toast({
        title: response?.data?.archived
          ? copy.walletArchived
          : copy.walletDeleted,
        description: response?.message,
        variant: "success",
      });
      setPendingDelete(null);
      await fetchData();
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

  const handleTransfer = async () => {
    if (!transferValues.fromWalletId || !transferValues.toWalletId) {
      toast({
        title: copy.walletSelectionRequired,
        description: copy.walletSelectionRequiredDesc,
        variant: "destructive",
      });
      return;
    }
    if (transferValues.fromWalletId === transferValues.toWalletId) {
      toast({
        title: copy.differentWalletsRequired,
        description: copy.differentWalletsRequiredDesc,
        variant: "destructive",
      });
      return;
    }
    if (transferValues.amount <= 0) {
      toast({
        title: copy.invalidTransferAmount,
        description: copy.invalidTransferAmountDesc,
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

      const sourceWallet = wallets.find(
        (wallet) => wallet._id === transferValues.fromWalletId,
      );
      const destinationWallet = wallets.find(
        (wallet) => wallet._id === transferValues.toWalletId,
      );

      await transactionApi.createTransfer(
        {
          fromWalletId: transferValues.fromWalletId,
          toWalletId: transferValues.toWalletId,
          amount: transferValues.amount,
          date: new Date().toISOString(),
          timezoneOffset: timezoneOffsetMinutes,
          sourceNote: copy.transferTo(destinationWallet?.name),
          destinationNote: copy.transferFrom(sourceWallet?.name),
        },
        token,
      );

      toast({
        title: copy.transferCompleted,
        variant: "success",
      });
      setTransferValues((current) => ({
        ...current,
        amount: 0,
      }));
      setTransferAmountInput("");
      await fetchData();
    } catch (error: any) {
      toast({
        title: copy.transferFailed,
        description: error.message || copy.transferFailedDesc,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);

  const chartData = {
    labels: stats?.history?.map((item: any) => item.month) || [],
    datasets: [
      {
        label: copy.balanceSeriesLabel,
        data: stats?.history?.map((item: any) => item.balance) || [],
        borderColor: appearance.primaryColor,
        backgroundColor: hexToRgba(appearance.primaryColor, 0.14),
        fill: true,
        tension: 0.35,
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <WalletOnboardingDialog
        isVietnamese={isVietnamese}
        onSkip={() => finishOnboarding("skip")}
        onStart={() => openCreate()}
        open={onboardingOpen}
        primaryColor={appearance.primaryColor}
      />

      {currentUser?.newUser ? (
        <div
          className="rounded-[var(--app-radius-xl)] border px-4 py-4 sm:px-5"
          style={{
            borderColor: hexToRgba(appearance.primaryColor, 0.28),
            backgroundColor: hexToRgba(appearance.primaryColor, 0.1),
            boxShadow: `0 10px 30px ${hexToRgba(
              appearance.primaryColor,
              0.08,
            )}`,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--app-radius-md)]"
              style={{
                backgroundColor: hexToRgba(appearance.primaryColor, 0.14),
                color: appearance.primaryColor,
              }}
            >
              <WalletCards className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p
                className="text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: appearance.primaryColor }}
              >
                {onboardingBadgeLabel}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-foreground">
                {onboardingNoticeTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {onboardingNoticeDescription}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => openCreate()} size="sm">
                  <Plus className="h-4 w-4" />
                  {isVietnamese ? "Tạo ví đầu tiên" : "Create first wallet"}
                </Button>
                <Button
                  onClick={() => setOnboardingOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  {isVietnamese ? "Xem hướng dẫn" : "Show the quick tour"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{copy.pageTitle}</h1>
            <p className="hidden md:block mt-1 text-sm text-muted-foreground">
              {currentUser?.newUser
                ? onboardingPageDescription
                : copy.pageDescription}
            </p>
          </div>
          <Button
            onClick={() => openCreate()}
            size="sm"
          >
            <Plus className="h-4 w-4" />
            {copy.newWallet}
          </Button>
        </div>
      </div>

      <PageHeader
        actions={
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            {copy.newWallet}
          </Button>
        }
        description={
          currentUser?.newUser
            ? onboardingPageDescription
            : copy.pageDescription
        }
        title={copy.pageTitle}
      />

      <div className="metric-card-grid">
        <MetricCard
          icon={WalletCards}
          subtitle={copy.activeWallets(wallets.length)}
          title={copy.totalBalance}
          value={formatCurrency(stats?.totalBalance || totalBalance, defaultCurrency, {
            displayMode: "full",
          })}
        />
        <MetricCard
          icon={Building2}
          subtitle={copy.monthOverMonthGrowth(stats?.growth || 0)}
          title={copy.walletCount}
          value={String(wallets.length)}
        />
        <MetricCard
          icon={ArrowLeftRight}
          subtitle={copy.transferReadyDesc}
          title={copy.transfersReady}
          value={wallets.length >= 2 ? copy.yes : copy.needTwoWallets}
        />
      </div>

      {wallets.length > 0 ? (
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.5fr,1fr]">
          <div className="space-y-4 sm:space-y-6">
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {wallets.map((wallet) => {
                const Icon =
                  wallet.icon && wallet.icon in walletIconMap
                    ? walletIconMap[wallet.icon as keyof typeof walletIconMap]
                    : wallet.type === "bank"
                      ? Building2
                      : wallet.type === "ewallet"
                        ? Smartphone
                        : Wallet;
                const walletBudgetSummary = walletBudgetSummaryMap.get(
                  wallet._id,
                );
                const reserveItems = (walletBudgetSummary?.items || []).filter(
                  (item) =>
                    Number(item.remaining || 0) > 0 ||
                    Number(item.spent || 0) > 0,
                );
                const reservedAmount = reserveItems.reduce(
                  (sum, item) => sum + Number(item.remaining || 0),
                  0,
                );
                const freeAmount = Math.max(
                  Number(wallet.balance || 0) - reservedAmount,
                  0,
                );
                const oversubscribedAmount = Math.max(
                  reservedAmount - Number(wallet.balance || 0),
                  0,
                );
                const allocationTotal = Math.max(
                  Number(wallet.balance || 0),
                  reservedAmount,
                  1,
                );
                const allocationSegments = [
                  ...(freeAmount > 0
                    ? [
                        {
                          key: `${wallet._id}-free`,
                          label: copy.freeToSpend,
                          amount: freeAmount,
                          color: hexToRgba(appearance.primaryColor, 0.82),
                        },
                      ]
                    : []),
                  ...reserveItems
                    .filter((item) => Number(item.remaining || 0) > 0)
                    .map((item, index) => ({
                      key: item._id,
                      label: item.category,
                      amount: Number(item.remaining || 0),
                      color: getBudgetColor(item, index),
                    })),
                ];

                const isExpanded = expandedWalletId === wallet._id;
                const walletBackground = wallet.imageUrl
                  ? `linear-gradient(180deg, rgba(2, 6, 23, 0.16) 0%, rgba(2, 6, 23, 0.48) 55%, rgba(2, 6, 23, 0.9) 100%), url(${wallet.imageUrl})`
                  : wallet.color
                    ? `linear-gradient(180deg, ${hexToRgba(wallet.color, 0.64)} 0%, ${hexToRgba(wallet.color, 0.88)} 52%, rgba(2, 6, 23, 0.94) 100%)`
                    : `linear-gradient(180deg, ${hexToRgba(themeColors.primary, 0.64)} 0%, ${hexToRgba(themeColors.secondary, 0.88)} 52%, rgba(2, 6, 23, 0.94) 100%)`;

                return (
                  <div
                    key={wallet._id}
                    className="overflow-hidden rounded-[var(--app-radius-xl)] border border-border/80 bg-card shadow-sm"
                  >
                    <div
                      className="flex w-[200%] transition-transform duration-300 ease-out"
                      style={{
                        transform: isExpanded
                          ? "translateX(-50%)"
                          : "translateX(0)",
                      }}
                    >
                      <div
                        className="relative min-h-[262px] w-1/2 shrink-0 p-4 text-white sm:min-h-[286px] sm:p-5"
                        style={{
                          backgroundImage: walletBackground,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }}
                      >
                        <div className="relative z-[1] flex h-full flex-col justify-between gap-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--app-radius-md)] bg-white/14 text-white backdrop-blur-sm">
                                <Icon className="h-[18px] w-[18px]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/68">
                                  {getWalletTypeLabel(wallet.type)}
                                </p>
                                <h3 className="mt-1 truncate text-lg font-semibold tracking-tight sm:text-xl">
                                  {wallet.name}
                                </h3>
                                {wallet.accountNumber ? (
                                  <p className="truncate text-xs text-white/70">
                                    {wallet.accountNumber}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Button
                                aria-label={copy.edit}
                                className="h-8 w-8 rounded-full border-white/15 bg-white/12 text-white backdrop-blur-sm hover:bg-white/18 hover:text-white"
                                onClick={() => openEdit(wallet)}
                                size="icon"
                                variant="ghost"
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                                <span className="sr-only">{copy.edit}</span>
                              </Button>
                              <Button
                                aria-label={copy.delete}
                                className="h-8 w-8 rounded-full border-white/15 bg-white/12 text-white backdrop-blur-sm hover:bg-white/18 hover:text-white"
                                onClick={() => setPendingDelete(wallet)}
                                size="icon"
                                variant="ghost"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="sr-only">{copy.delete}</span>
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-white/68">
                                {copy.balanceSeriesLabel}
                              </p>
                              <p className="mt-1 text-[1.85rem] font-semibold tracking-tight sm:text-[2.05rem]">
                                {formatCurrency(wallet.balance)}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-3 border-t border-white/18 pt-3">
                              <div className="flex flex-wrap gap-1.5">
                                {wallet.hasTransactions ? (
                                  <Badge
                                    className="border-white/18 bg-white/12 text-white"
                                    variant="outline"
                                  >
                                    {copy.hasHistory}
                                  </Badge>
                                ) : null}
                              </div>
                              <button
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/16 bg-white/14 px-2.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                                onClick={() => setExpandedWalletId(wallet._id)}
                                type="button"
                              >
                                <ChartPie className="h-3.5 w-3.5" />
                                {copy.walletAllocation}
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="min-h-[262px] w-1/2 shrink-0 p-4 sm:min-h-[286px] sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {copy.walletAllocationDetails}
                            </p>
                            <h3 className="mt-1 truncate text-base font-semibold text-foreground">
                              {wallet.name}
                            </h3>
                          </div>
                          <button
                            className="h-8 rounded-full border border-border bg-background px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => setExpandedWalletId(null)}
                            type="button"
                          >
                            {copy.backToCard}
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-[var(--app-radius-md)] bg-muted/35 p-3">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              {copy.freeToSpend}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {formatCurrency(freeAmount)}
                            </p>
                          </div>
                          <div className="rounded-[var(--app-radius-md)] bg-muted/35 p-3">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              {copy.budgetReserved}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {formatCurrency(reservedAmount)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
                          {allocationSegments.length > 0 ? (
                            allocationSegments.map((segment) => (
                              <div
                                key={segment.key}
                                style={{
                                  backgroundColor: segment.color,
                                  width: `${(segment.amount / allocationTotal) * 100}%`,
                                }}
                              />
                            ))
                          ) : (
                            <div className="h-full w-full bg-muted-foreground/20" />
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{
                              backgroundColor: hexToRgba(
                                appearance.primaryColor,
                                0.12,
                              ),
                              color: appearance.primaryColor,
                            }}
                          >
                            {copy.freeToSpend}: {formatCurrency(freeAmount)}
                          </span>
                          {reserveItems
                            .filter((item) => Number(item.remaining || 0) > 0)
                            .slice(0, 3)
                            .map((item, index) => (
                              <span
                                key={item._id}
                                className="inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-[11px] font-medium"
                                style={{
                                  backgroundColor: hexToRgba(
                                    getBudgetColor(item, index),
                                    0.14,
                                  ),
                                  color: getBudgetColor(item, index),
                                }}
                              >
                                {item.category}
                              </span>
                            ))}
                        </div>

                        <p
                          className={`mt-3 text-xs ${
                            oversubscribedAmount > 0
                              ? "text-rose-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {oversubscribedAmount > 0
                            ? copy.oversubscribedWallet
                            : reserveItems.length > 0
                              ? `${copy.budgetReserved}: ${formatCurrency(reservedAmount)}`
                              : copy.noBudgetReserve}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{copy.balanceTrend}</CardTitle>
                <CardDescription>{copy.balanceTrendDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[160px] lg:h-[320px]">
                  <LineChart
                    data={chartData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{copy.internalTransfer}</CardTitle>
              <CardDescription>{copy.internalTransferDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 sm:space-y-4">
              {wallets.length >= 2 ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      {copy.fromWallet}
                    </label>
                    <Select
                      onChange={handleFromWalletChange}
                      value={transferValues.fromWalletId}
                    >
                      <option value="">{copy.selectSource}</option>
                      {wallets.map((wallet) => (
                        <option key={wallet._id} value={wallet._id}>
                          {wallet.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      {copy.toWallet}
                    </label>
                    <Select
                      onChange={handleToWalletChange}
                      value={transferValues.toWalletId}
                    >
                      <option value="">{copy.selectDestination}</option>
                      {transferDestinationWallets.map((wallet) => (
                        <option key={wallet._id} value={wallet._id}>
                          {wallet.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <MoneyField
                    label={copy.amount}
                    onChange={handleTransferAmountChange}
                    placeholder={copy.startingBalancePlaceholder}
                    value={transferAmountInput}
                  />
                  <Button
                    className="w-full sm:w-auto"
                    disabled={submitting}
                    onClick={handleTransfer}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    {copy.transferNow}
                  </Button>
                </>
              ) : (
                <EmptyState
                  description={copy.notEnoughWalletsDesc}
                  icon={ArrowLeftRight}
                  title={copy.notEnoughWallets}
                />
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          actionLabel={copy.createWallet}
          description={copy.noWalletsDesc}
          icon={WalletCards}
          onAction={() => openCreate()}
          title={copy.noWallets}
        />
      )}

      <WalletFormModal
        copy={copy}
        editing={editing}
        formValues={formValues}
        imagePreview={imagePreview}
        initialBalanceInput={initialBalanceInput}
        isVietnamese={isVietnamese}
        language={language}
        onClose={handleCloseModal}
        onFormValuesChange={setFormValues}
        onImageChange={handleImageChange}
        onInitialBalanceChange={handleInitialBalanceChange}
        onSubmit={() => void submitWallet(false)}
        open={modalOpen}
        submitting={submitting}
      />

      <DeleteWalletModal
        copy={copy}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        submitting={submitting}
        wallet={pendingDelete}
      />

      <ConfirmWalletTypeChangeModal
        copy={copy}
        onClose={() => setConfirmTypeChangeOpen(false)}
        onConfirm={() => submitWallet(true)}
        open={confirmTypeChangeOpen}
        submitting={submitting}
      />
    </div>
  );
};

export default Wallets;
