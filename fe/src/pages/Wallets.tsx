/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
    ArrowLeftRight,
    Building2,
    Car,
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
import { auth } from "../firebase/config";
import { transactionApi, userApi, walletApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import { useTheme } from "../contexts/ThemeContext";
import { hexToRgba } from "../lib/utils";
import { PageHeader } from "../components/app/page-header";
import { MetricCard } from "../components/app/metric-card";
import { EmptyState } from "../components/app/empty-state";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Spinner } from "../components/ui/spinner";
import { SpotlightGuide } from "../components";
import LineChart from "../components/charts/LineChart";

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

type WalletGuideStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type GuideConfig = {
    targetRef: React.RefObject<HTMLElement | null>;
    title: string;
    description: string;
    placement: "top" | "bottom" | "left" | "right";
    actionLabel?: string;
    actionDisabled?: boolean;
    onAction?: () => void;
};

type GuideStepUpdate =
    | WalletGuideStep
    | null
    | ((current: WalletGuideStep | null) => WalletGuideStep | null);

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

const iconOptions = [
    { vi: "Ngân hàng", en: "Bank", value: "account_balance" },
    { vi: "Tiền mặt", en: "Cash", value: "payments" },
    { vi: "Thẻ", en: "Card", value: "credit_card" },
    { vi: "Điện thoại", en: "Phone", value: "phone_android" },
    { vi: "Ví", en: "Wallet", value: "wallet" },
    { vi: "Nhà", en: "Home", value: "home" },
    { vi: "Xe", en: "Car", value: "directions_car" },
    { vi: "Du lịch", en: "Travel", value: "flight" },
    { vi: "Mua sắm", en: "Shopping", value: "shopping_cart" },
    { vi: "Ăn uống", en: "Food", value: "restaurant" },
] as const;

const walletTypeText = {
    cash: { vi: "Tiền mặt", en: "Cash" },
    bank: { vi: "Ngân hàng", en: "Bank" },
    ewallet: { vi: "Ví điện tử", en: "E-wallet" },
} as const;

const colorOptions = [
    "#2563eb",
    "#0f766e",
    "#7c3aed",
    "#dc2626",
    "#ea580c",
    "#0891b2",
    "#475569",
];

const WALLET_GUIDE_STEP_COUNT = 9;

const formatWholeNumberInput = (value: number) =>
    value > 0 ? new Intl.NumberFormat("vi-VN").format(value) : "";

const parseWholeNumberInput = (value: string) => {
    const digits = value.replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
};

const Wallets: React.FC = () => {
    const { currentUser, updateUserStatus } = useAuth();
    const { language, isVietnamese } = useLocale();
    const { toast } = useToast();
    const { appearance } = useTheme();
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
              differentWalletsRequiredDesc: "Ví nguồn và ví đích không được trùng nhau.",
              invalidTransferAmount: "Số tiền chuyển không hợp lệ",
              invalidTransferAmountDesc: "Số tiền phải lớn hơn 0.",
              transferCompleted: "Đã chuyển tiền",
              transferFailed: "Chuyển tiền thất bại",
              transferFailedDesc: "Không thể hoàn tất chuyển tiền nội bộ.",
              firstWalletGuide: "Tạo ví đầu tiên",
              firstWalletGuideDesc:
                  "Mở form tạo ví trước. Hướng dẫn sẽ tiếp tục trên các trường trong hộp thoại.",
              imageGuide: "Thêm ảnh nếu bạn muốn",
              imageGuideDesc:
                  "Bạn có thể tải ảnh thêm cho ví này để dễ nhận ra hơn. Không bắt buộc, nên bạn có thể bước tiếp ngay.",
              clearNameGuide: "Đặt tên dễ nhận biết",
              clearNameGuideDesc:
                  "Ví dụ: Tiền mặt, Techcombank hoặc Momo. Nhập xong rồi bấm Tiếp tục để sang bước sau.",
              walletTypeGuide: "Chọn đúng loại ví",
              walletTypeGuideDesc:
                  "Loại ví ảnh hưởng tới cách hệ thống gom số dư trong báo cáo.",
              currencyGuide: "Chọn loại tiền tệ",
              currencyGuideDesc:
                  "Chọn đúng tiền tệ ngay từ đầu để các báo cáo và giao dịch không bị sai định dạng.",
              iconGuide: "Chọn biểu tượng",
              iconGuideDesc:
                  "Bạn có thể gõ tên biểu tượng, dán tên có sẵn hoặc chọn một giá trị gợi ý.",
              startingBalanceGuide: "Nhập số dư ban đầu",
              startingBalanceGuideDesc:
                  "Đây là số tiền hiện đang có trong ví tại thời điểm tạo.",
              saveGuide: "Lưu để tiếp tục",
              saveGuideDesc:
                  "Sau khi lưu ví đầu tiên, ứng dụng sẽ mở khóa giao dịch, ngân sách và mục tiêu.",
              continue: "Tiếp tục",
              stepLabel: (step: number) => `Bước ${step}/${WALLET_GUIDE_STEP_COUNT}`,
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
              walletSelectionRequiredDesc: "Choose both source and destination wallets.",
              differentWalletsRequired: "Different wallets required",
              differentWalletsRequiredDesc: "Source and destination wallets must be different.",
              invalidTransferAmount: "Invalid transfer amount",
              invalidTransferAmountDesc: "Amount must be greater than zero.",
              transferCompleted: "Transfer completed",
              transferFailed: "Transfer failed",
              transferFailedDesc: "Internal transfer could not be completed.",
              firstWalletGuide: "Create the first wallet",
              firstWalletGuideDesc:
                  "Open the wallet form first. The guide will continue on the fields inside the dialog.",
              imageGuide: "Add an image if you want",
              imageGuideDesc:
                  "You can upload an image to make this wallet easier to recognize. It is optional, so you can continue right away.",
              clearNameGuide: "Give it a clear name",
              clearNameGuideDesc:
                  "Examples: Cash, Techcombank or Momo. Once the name looks right, press Continue to move on.",
              walletTypeGuide: "Pick the right wallet type",
              walletTypeGuideDesc:
                  "This affects how reports group your balances later.",
              currencyGuide: "Choose the wallet currency",
              currencyGuideDesc:
                  "Pick the correct currency from the start so reports and transactions stay consistent.",
              iconGuide: "Choose an icon",
              iconGuideDesc:
                  "You can type an icon name, paste one from elsewhere, or use one of the suggested values.",
              startingBalanceGuide: "Enter the starting balance",
              startingBalanceGuideDesc:
                  "This should be the amount currently available in the wallet.",
              saveGuide: "Save and continue",
              saveGuideDesc:
                  "After saving your first wallet, the app unlocks transactions, budgets and goals.",
              continue: "Continue",
              stepLabel: (step: number) => `Step ${step}/${WALLET_GUIDE_STEP_COUNT}`,
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
              transferTo: (name?: string) => `Transfer to ${name || "destination wallet"}`,
              transferFrom: (name?: string) => `Received from ${name || "source wallet"}`,
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
    };
    const guideOpenFormLabel = isVietnamese
        ? "M\u1edf form \u2192"
        : "Open form ->";
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
    const accountNumberGuideTitle = isVietnamese
        ? "Thêm số tài khoản nếu cần"
        : "Add an account number if needed";
    const accountNumberGuideDescription = isVietnamese
        ? "Bước này không bắt buộc. Bạn có thể nhập số tài khoản, số thẻ hoặc 4 số cuối để dễ phân biệt ví."
        : "This step is optional. You can enter an account number, card number, or just the last four digits to identify the wallet faster.";
    const getWalletTypeLabel = (type: WalletItem["type"]) => walletTypeText[type][language];
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [wallets, setWallets] = useState<WalletItem[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<WalletItem | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState("");
    const [pendingDelete, setPendingDelete] = useState<WalletItem | null>(null);
    const [confirmTypeChangeOpen, setConfirmTypeChangeOpen] = useState(false);
    const [guideStep, setGuideStep] = useState<WalletGuideStep | null>(null);
    const [formValues, setFormValues] = useState({
        name: "",
        accountNumber: "",
        initialBalance: 0,
        type: "cash" as "cash" | "bank" | "ewallet",
        currency: "VND",
        icon: "",
        color: appearance.primaryColor,
    });
    const [initialBalanceInput, setInitialBalanceInput] = useState("");
    const [transferValues, setTransferValues] = useState({
        fromWalletId: "",
        toWalletId: "",
        amount: 0,
    });

    const addWalletButtonRef = useRef<HTMLButtonElement | null>(null);
    const imageFieldRef = useRef<HTMLElement | null>(null);
    const nameFieldRef = useRef<HTMLElement | null>(null);
    const accountNumberFieldRef = useRef<HTMLElement | null>(null);
    const typeFieldRef = useRef<HTMLElement | null>(null);
    const currencyFieldRef = useRef<HTMLElement | null>(null);
    const iconFieldRef = useRef<HTMLElement | null>(null);
    const balanceFieldRef = useRef<HTMLElement | null>(null);
    const submitButtonRef = useRef<HTMLButtonElement | null>(null);
    const pendingGuideStepRef = useRef<WalletGuideStep | null>(null);

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
    const logGuide = useCallback(
        (event: string, details?: Record<string, unknown>) => {
            console.info("[WalletGuide]", event, {
                currentUserId: currentUser?.uid || null,
                guideStep,
                hasWallets,
                isGuideEligible,
                modalOpen,
                ...details,
            });
        },
        [currentUser?.uid, guideStep, hasWallets, isGuideEligible, modalOpen],
    );
    const setGuideStepWithLog = useCallback(
        (next: GuideStepUpdate, reason: string) => {
            setGuideStep((current) => {
                const resolved =
                    typeof next === "function"
                        ? next(current)
                        : next;

                if (current !== resolved) {
                    logGuide("Guide step changed", {
                        from: current,
                        reason,
                        to: resolved,
                    });
                }

                return resolved;
            });
        },
        [logGuide],
    );
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
            const [walletResponse, statsResponse] = await Promise.all([
                walletApi.getWallets(token),
                userApi.getProfileStats(token),
            ]);

            const walletList = walletResponse?.wallets || [];
            setWallets(walletList);
            setStats(statsResponse?.data || statsResponse);

            if (walletList.length >= 2) {
                setTransferValues((current) =>
                    current.fromWalletId
                        ? current
                        : {
                              fromWalletId: walletList[0]._id,
                              toWalletId: walletList[1]._id,
                              amount: 0,
                          },
                );
            }
        } catch (error: any) {
            toast({
                title: isVietnamese ? "Không thể tải ví" : "Could not load wallets",
                description: error.message || (isVietnamese ? "Vui lòng thử lại." : "Please retry."),
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
        logGuide("Guide state snapshot", {
            onboardingStorageKey,
            persistedState: getGuideState(),
            sessionSkipState: getGuideSessionSkipState(),
        });
    }, [
        getGuideSessionSkipState,
        getGuideState,
        logGuide,
        onboardingSessionSkipKey,
        onboardingStorageKey,
    ]);

    useEffect(() => {
        if (!currentUser?.newUser || !hasWallets) {
            return;
        }
        logGuide("User now has wallet, marking onboarding done");
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
        logGuide,
        onboardingSessionSkipKey,
        onboardingStorageKey,
        updateUserStatus,
    ]);

    useEffect(() => {
        if (loading || modalOpen || !isGuideEligible || !onboardingStorageKey) {
            logGuide("Guide bootstrap skipped", {
                loading,
                modalOpen,
                onboardingStorageKey,
            });
            return;
        }

        const sessionSkipState = getGuideSessionSkipState();
        if (sessionSkipState === "skip") {
            logGuide("Guide bootstrap blocked for this session");
            return;
        }

        let guideState = getGuideState();
        if (guideState === "done") {
            logGuide("Detected stale persisted done state for eligible user, resetting it");
            window.localStorage.removeItem(onboardingStorageKey);
            guideState = null;
        }

        let frameId = 0;
        let attempts = 0;
        let cancelled = false;

        const ensureGuideStarts = () => {
            if (cancelled) {
                return;
            }

            if (addWalletButtonRef.current) {
                logGuide("Step 0 target ready, showing guide", {
                    attempts,
                });
                setGuideStepWithLog((current) => current ?? 0, "bootstrap step 0");
                return;
            }

            if (attempts >= 24) {
                logGuide("Step 0 target still missing after retries", {
                    attempts,
                });
                return;
            }

            attempts += 1;
            logGuide("Waiting for step 0 target ref", {
                attempts,
            });
            frameId = window.requestAnimationFrame(ensureGuideStarts);
        };

        logGuide("Starting guide bootstrap", {
            persistedState: guideState,
            sessionSkipState,
        });
        frameId = window.requestAnimationFrame(ensureGuideStarts);

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frameId);
        };
    }, [
        getGuideSessionSkipState,
        getGuideState,
        isGuideEligible,
        loading,
        logGuide,
        modalOpen,
        onboardingStorageKey,
        setGuideStepWithLog,
    ]);

    useEffect(() => {
        if (guideStep === null) {
            logGuide("Guide hidden");
            return;
        }

        logGuide("Guide visible", {
            step: guideStep,
        });
    }, [guideStep, logGuide]);

    useEffect(() => {
        if (!modalOpen || pendingGuideStepRef.current === null) {
            return;
        }

        logGuide("Dialog opened, preparing next guided step", {
            pendingStep: pendingGuideStepRef.current,
        });
        let frameId = 0;
        let attempts = 0;

        const getPendingTarget = (step: WalletGuideStep) => {
            if (step === 1) {
                return imageFieldRef.current;
            }

            if (step === 2) {
                return nameFieldRef.current;
            }

            if (step === 3) {
                return accountNumberFieldRef.current;
            }

            if (step === 4) {
                return typeFieldRef.current;
            }

            if (step === 5) {
                return currencyFieldRef.current;
            }

            if (step === 6) {
                return iconFieldRef.current;
            }

            if (step === 7) {
                return balanceFieldRef.current;
            }

            if (step === 8) {
                return submitButtonRef.current;
            }

            return addWalletButtonRef.current;
        };

        const continueGuideInsideDialog = () => {
            const pendingStep = pendingGuideStepRef.current;
            if (pendingStep === null) {
                return;
            }

            if (getPendingTarget(pendingStep)) {
                logGuide("Dialog target ready, continuing guide", {
                    pendingStep,
                });
                setGuideStepWithLog(pendingStep, "dialog target mounted");
                pendingGuideStepRef.current = null;
                return;
            }

            if (attempts >= 24) {
                logGuide("Dialog target missing after retries", {
                    attempts,
                    pendingStep,
                });
                pendingGuideStepRef.current = null;
                return;
            }

            attempts += 1;
            logGuide("Waiting for dialog target ref", {
                attempts,
                pendingStep,
            });
            frameId = window.requestAnimationFrame(continueGuideInsideDialog);
        };

        frameId = window.requestAnimationFrame(continueGuideInsideDialog);

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [
        accountNumberFieldRef,
        currencyFieldRef,
        iconFieldRef,
        imageFieldRef,
        logGuide,
        modalOpen,
        setGuideStepWithLog,
    ]);

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
        logGuide("Finishing onboarding", {
            status,
        });
        setGuideStepWithLog(null, `finish onboarding: ${status}`);
    };

    const bindTargetRef =
        (targetRef: React.MutableRefObject<HTMLElement | null>, selector?: string) =>
        (node: HTMLDivElement | null) => {
            if (!node) {
                targetRef.current = null;
                logGuide("Guide target cleared", {
                    selector: selector || "self",
                });
                return;
            }
            targetRef.current = selector
                ? (node.querySelector(selector) as HTMLElement | null) || node
                : node;
            logGuide("Guide target attached", {
                resolved: targetRef.current?.tagName || null,
                selector: selector || "self",
            });
        };

    const openCreate = (source: "empty-state" | "guide-cta" | "header" = "header") => {
        const persistedGuideState = getGuideState();
        const sessionSkipState = getGuideSessionSkipState();
        const shouldContinueGuide =
            isGuideEligible &&
            persistedGuideState !== "done" &&
            sessionSkipState !== "skip";
        logGuide("Open create wallet requested", {
            persistedGuideState,
            sessionSkipState,
            shouldContinueGuide,
            source,
        });

        setEditing(null);
        setFormValues({
            name: "",
            accountNumber: "",
            initialBalance: 0,
            type: "cash",
            currency: "VND",
            icon: "",
            color: appearance.primaryColor,
        });
        setInitialBalanceInput("");
        setImageFile(null);
        setImagePreview("");
        setModalOpen(true);

        if (shouldContinueGuide) {
            pendingGuideStepRef.current = 1;
            logGuide("Queued guide step 1 after opening dialog");
            setGuideStepWithLog(null, "opening create dialog");
        } else {
            pendingGuideStepRef.current = null;
        }
    };

    const openEdit = (wallet: WalletItem) => {
        setEditing(wallet);
        setFormValues({
            name: wallet.name,
            accountNumber: wallet.accountNumber || "",
            initialBalance: wallet.initialBalance ?? wallet.balance,
            type: wallet.type,
            currency: wallet.currency || "VND",
            icon: wallet.icon || "",
            color: wallet.color || appearance.primaryColor,
        });
        setInitialBalanceInput(
            formatWholeNumberInput(wallet.initialBalance ?? wallet.balance),
        );
        setImageFile(null);
        setImagePreview(wallet.imageUrl || "");
        pendingGuideStepRef.current = null;
        logGuide("Open edit wallet dialog", {
            walletId: wallet._id,
        });
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        pendingGuideStepRef.current = null;
        logGuide("Closing wallet dialog");
        setGuideStepWithLog(null, "dialog closed");
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
    const handleInitialBalanceChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const numericValue = parseWholeNumberInput(event.target.value);

        setInitialBalanceInput(
            numericValue > 0 ? formatWholeNumberInput(numericValue) : "",
        );
        setFormValues((current) => ({
            ...current,
            initialBalance: numericValue,
        }));
    };

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
            const response: any = await walletApi.deleteWallet(pendingDelete._id, token);
            toast({
                title: response?.data?.archived ? copy.walletArchived : copy.walletDeleted,
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

            await Promise.all([
                transactionApi.createTransaction(
                    {
                        type: "EXPENSE",
                        amount: transferValues.amount,
                        walletId: transferValues.fromWalletId,
                        category: copy.transferCategory,
                        note: copy.transferTo(
                            wallets.find((wallet) => wallet._id === transferValues.toWalletId)
                                ?.name,
                        ),
                        date: new Date().toISOString(),
                    },
                    token,
                ),
                transactionApi.createTransaction(
                    {
                        type: "INCOME",
                        amount: transferValues.amount,
                        walletId: transferValues.toWalletId,
                        category: copy.transferCategory,
                        note: copy.transferFrom(
                            wallets.find((wallet) => wallet._id === transferValues.fromWalletId)
                                ?.name,
                        ),
                        date: new Date().toISOString(),
                    },
                    token,
                ),
            ]);

            toast({
                title: copy.transferCompleted,
                variant: "success",
            });
            setTransferValues((current) => ({
                ...current,
                amount: 0,
            }));
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

    const guideConfigs: Record<WalletGuideStep, GuideConfig> = {
        0: {
            targetRef: addWalletButtonRef,
            title: copy.firstWalletGuide,
            description: copy.firstWalletGuideDesc,
            placement: "left",
            actionLabel: guideOpenFormLabel,
            onAction: () => openCreate("guide-cta"),
        },
        1: {
            targetRef: imageFieldRef,
            title: copy.imageGuide,
            description: copy.imageGuideDesc,
            placement: "top",
            actionLabel: copy.continue,
            onAction: () => setGuideStepWithLog(2, "step 1 CTA"),
        },
        2: {
            targetRef: nameFieldRef,
            title: copy.clearNameGuide,
            description: copy.clearNameGuideDesc,
            placement: "top",
            actionLabel: copy.continue,
            onAction: () => setGuideStepWithLog(3, "step 2 CTA"),
            actionDisabled: !formValues.name.trim(),
        },
        3: {
            targetRef: accountNumberFieldRef,
            title: accountNumberGuideTitle,
            description: accountNumberGuideDescription,
            placement: "top",
            actionLabel: copy.continue,
            onAction: () => setGuideStepWithLog(4, "step 3 CTA"),
        },
        4: {
            targetRef: typeFieldRef,
            title: copy.walletTypeGuide,
            description: copy.walletTypeGuideDesc,
            placement: "top",
            actionLabel: copy.continue,
            onAction: () => setGuideStepWithLog(5, "step 4 CTA"),
        },
        5: {
            targetRef: currencyFieldRef,
            title: copy.currencyGuide,
            description: copy.currencyGuideDesc,
            placement: "top",
            actionLabel: copy.continue,
            onAction: () => setGuideStepWithLog(6, "step 5 CTA"),
        },
        6: {
            targetRef: iconFieldRef,
            title: copy.iconGuide,
            description: copy.iconGuideDesc,
            placement: "top",
            actionLabel: copy.continue,
            onAction: () => setGuideStepWithLog(7, "step 6 CTA"),
        },
        7: {
            targetRef: balanceFieldRef,
            title: copy.startingBalanceGuide,
            description: copy.startingBalanceGuideDesc,
            placement: "top",
            actionLabel: copy.continue,
            onAction: () => setGuideStepWithLog(8, "step 7 CTA"),
        },
        8: {
            targetRef: submitButtonRef,
            title: copy.saveGuide,
            description: copy.saveGuideDesc,
            placement: "top",
        },
    };

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

    const currentGuide =
        guideStep !== null && isGuideEligible ? guideConfigs[guideStep] : null;

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <Spinner className="h-8 w-8" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {currentGuide ? (
                <SpotlightGuide
                    actionDisabled={currentGuide.actionDisabled}
                    actionLabel={currentGuide.actionLabel}
                    description={currentGuide.description}
                    onAction={currentGuide.onAction}
                    onSkip={() => finishOnboarding("skip")}
                    open
                    placement={currentGuide.placement}
                    stepLabel={copy.stepLabel((guideStep || 0) + 1)}
                    targetRef={currentGuide.targetRef}
                    title={currentGuide.title}
                />
            ) : null}

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
                                backgroundColor: hexToRgba(
                                    appearance.primaryColor,
                                    0.14,
                                ),
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
                        </div>
                    </div>
                </div>
            ) : null}

            <PageHeader
                actions={
                    <Button onClick={() => openCreate("header")} ref={addWalletButtonRef}>
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
                    value={formatCurrency(stats?.totalBalance || totalBalance)}
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
                <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
                    <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            {wallets.map((wallet) => {
                                const Icon =
                                    wallet.icon && wallet.icon in walletIconMap
                                        ? walletIconMap[wallet.icon as keyof typeof walletIconMap]
                                        : wallet.type === "bank"
                                          ? Building2
                                          : wallet.type === "ewallet"
                                            ? Smartphone
                                            : Wallet;

                                return (
                                    <Card
                                        key={wallet._id}
                                        className="group overflow-hidden border-border/80 bg-card/95"
                                    >
                                        <div
                                            className="relative min-h-[220px] overflow-hidden text-white sm:min-h-[236px]"
                                            style={{
                                                backgroundColor: wallet.color || appearance.primaryColor,
                                                backgroundImage: wallet.imageUrl
                                                    ? `linear-gradient(180deg, rgba(10, 16, 30, 0.12) 0%, rgba(10, 16, 30, 0.32) 38%, rgba(2, 6, 23, 0.82) 72%, rgba(2, 6, 23, 0.96) 100%), url(${wallet.imageUrl})`
                                                    : `linear-gradient(135deg, ${wallet.color || appearance.primaryColor} 0%, rgba(37, 99, 235, 0.78) 34%, rgba(15, 23, 42, 0.96) 100%)`,
                                                backgroundPosition: "center",
                                                backgroundSize: "cover",
                                            }}
                                        >
                                            <div className="pointer-events-none absolute inset-0">
                                                <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-white/10" />
                                                <div className="absolute bottom-0 left-0 h-24 w-24 -translate-x-8 translate-y-8 rounded-full bg-white/10" />
                                                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_34%,rgba(2,6,23,0.2)_100%)]" />
                                            </div>
                                            <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-4 sm:min-h-[236px] sm:p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/70">
                                                        {getWalletTypeLabel(wallet.type)}
                                                    </p>
                                                </div>
                                                <div className="rounded-[calc(var(--app-radius-md)-2px)] bg-white/12 p-2.5">
                                                    <Icon className="h-[18px] w-[18px]" />
                                                </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="flex items-end justify-between gap-3">
                                                <div className={`min-w-0 ${wallet.imageUrl ? "pr-20 sm:pr-24" : ""}`}>
                                                    <p className="mb-2 text-[1.55rem] font-semibold tracking-tight text-white sm:text-[1.75rem]">
                                                        {formatCurrency(wallet.balance)}
                                                    </p>
                                                    <p className="text-sm font-medium sm:text-[15px]">{wallet.name}</p>
                                                    <p className="truncate text-[11px] text-white/70">
                                                        {wallet.currency}
                                                        {wallet.accountNumber
                                                            ? ` • ${wallet.accountNumber}`
                                                            : ""}
                                                    </p>
                                                </div>
                                                {wallet.hasTransactions ? (
                                                    <Badge className="border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-white" variant="outline">
                                                        {copy.hasHistory}
                                                    </Badge>
                                                ) : null}
                                            </div>

                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    className="h-8 rounded-full border-white/15 bg-white/12 px-3 text-[11px] text-white backdrop-blur-sm hover:bg-white/18 hover:text-white"
                                                    onClick={() => openEdit(wallet)}
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    <PencilLine className="h-3 w-3" />
                                                    {copy.edit}
                                                </Button>
                                                <Button
                                                    className="h-8 w-8 rounded-full bg-white/12 text-white backdrop-blur-sm hover:bg-white/18 hover:text-white"
                                                    onClick={() => setPendingDelete(wallet)}
                                                    size="icon"
                                                    variant="ghost"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>{copy.balanceTrend}</CardTitle>
                                <CardDescription>
                                    {copy.balanceTrendDesc}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[320px]">
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
                            <CardDescription>
                                {copy.internalTransferDesc}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {wallets.length >= 2 ? (
                                <>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">{copy.fromWallet}</label>
                                        <Select
                                            onChange={(event) =>
                                                setTransferValues((current) => ({
                                                    ...current,
                                                    fromWalletId: event.target.value,
                                                }))
                                            }
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
                                        <label className="mb-2 block text-sm font-medium">{copy.toWallet}</label>
                                        <Select
                                            onChange={(event) =>
                                                setTransferValues((current) => ({
                                                    ...current,
                                                    toWalletId: event.target.value,
                                                }))
                                            }
                                            value={transferValues.toWalletId}
                                        >
                                            <option value="">{copy.selectDestination}</option>
                                            {wallets.map((wallet) => (
                                                <option key={wallet._id} value={wallet._id}>
                                                    {wallet.name}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">{copy.amount}</label>
                                        <Input
                                            min={0}
                                            onChange={(event) =>
                                                setTransferValues((current) => ({
                                                    ...current,
                                                    amount: Number(event.target.value) || 0,
                                                }))
                                            }
                                            type="number"
                                            value={transferValues.amount}
                                        />
                                    </div>
                                    <Button className="w-full sm:w-auto" disabled={submitting} onClick={handleTransfer}>
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
                    onAction={() => openCreate("empty-state")}
                    title={copy.noWallets}
                />
            )}

            <Dialog
                description={copy.formDescription}
                onClose={handleCloseModal}
                open={modalOpen}
                title={editing ? copy.editWallet : copy.createWalletTitle}
            >
                <div className="space-y-4">
                    <div ref={bindTargetRef(imageFieldRef, 'input[type="file"]')}>
                        <label className="mb-2 block text-sm font-medium">{copy.cardImage}</label>
                        <Input accept="image/*" onChange={handleImageChange} type="file" />
                        {imagePreview ? (
                            <img
                                alt={copy.walletPreview}
                                className="mt-3 h-36 w-full rounded-[var(--app-radius-lg)] object-cover"
                                src={imagePreview}
                            />
                        ) : null}
                    </div>

                    <div ref={bindTargetRef(nameFieldRef, "input")}>
                        <label className="mb-2 block text-sm font-medium">{copy.walletName}</label>
                        <Input
                            onChange={(event) =>
                                setFormValues((current) => ({
                                    ...current,
                                    name: event.target.value,
                                }))
                            }
                            placeholder={copy.walletNamePlaceholder}
                            value={formValues.name}
                        />
                    </div>

                    <div ref={bindTargetRef(accountNumberFieldRef, "input")}>
                        <label className="mb-2 block text-sm font-medium">{copy.accountNumber}</label>
                        <Input
                            onChange={(event) =>
                                setFormValues((current) => ({
                                    ...current,
                                    accountNumber: event.target.value,
                                }))
                            }
                            value={formValues.accountNumber}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div ref={bindTargetRef(typeFieldRef, "select")}>
                            <label className="mb-2 block text-sm font-medium">{copy.walletType}</label>
                            <Select
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        type: event.target.value as "cash" | "bank" | "ewallet",
                                    }))
                                }
                                value={formValues.type}
                            >
                                <option value="cash">{walletTypeText.cash[language]}</option>
                                <option value="bank">{walletTypeText.bank[language]}</option>
                                <option value="ewallet">{walletTypeText.ewallet[language]}</option>
                            </Select>
                        </div>
                        <div ref={bindTargetRef(currencyFieldRef, "select")}>
                            <label className="mb-2 block text-sm font-medium">{copy.currency}</label>
                            <Select
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        currency: event.target.value,
                                    }))
                                }
                                value={formValues.currency}
                            >
                                <option value="VND">VND</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div ref={bindTargetRef(iconFieldRef, "input")}>
                            <label className="mb-2 block text-sm font-medium">{copy.icon}</label>
                            <Input
                                list="wallet-icon-suggestions"
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        icon: event.target.value,
                                    }))
                                }
                                placeholder={copy.iconPlaceholder}
                                value={formValues.icon}
                            />
                            <datalist id="wallet-icon-suggestions">
                                <option value="">{copy.auto}</option>
                                {iconOptions.map((option) => (
                                    <option
                                        key={option.value}
                                        label={language === "vi" ? option.vi : option.en}
                                        value={option.value}
                                    />
                                ))}
                            </datalist>
                            <p className="mt-2 text-xs text-muted-foreground">
                                {copy.iconHint}
                            </p>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.accentColor}</label>
                            <div className="flex flex-wrap gap-2">
                                {colorOptions.map((color) => (
                                    <button
                                        key={color}
                                        className={`h-10 w-10 rounded-[var(--app-radius-md)] border ${
                                            formValues.color === color
                                                ? "border-foreground"
                                                : "border-border"
                                        }`}
                                        onClick={() =>
                                            setFormValues((current) => ({
                                                ...current,
                                                color,
                                            }))
                                        }
                                        style={{ backgroundColor: color }}
                                        type="button"
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div ref={bindTargetRef(balanceFieldRef, "input")}>
                        <label className="mb-2 block text-sm font-medium">{copy.startingBalance}</label>
                        <Input
                            inputMode="numeric"
                            onChange={handleInitialBalanceChange}
                            placeholder={copy.startingBalancePlaceholder}
                            value={initialBalanceInput}
                        />
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Button className="w-full sm:w-auto" onClick={handleCloseModal} variant="outline">
                            {copy.cancel}
                        </Button>
                        <Button
                            className="w-full sm:w-auto"
                            disabled={submitting}
                            onClick={() => void submitWallet(false)}
                            ref={submitButtonRef}
                        >
                            {submitting
                                ? copy.saving
                                : editing
                                  ? copy.updateWallet
                                  : copy.createWallet}
                        </Button>
                    </div>
                </div>
            </Dialog>

            <ConfirmDialog
                busy={submitting}
                cancelLabel={copy.keep}
                confirmLabel={pendingDelete?.hasTransactions ? copy.archive : copy.delete}
                description={
                    pendingDelete?.hasTransactions
                        ? copy.archiveWalletDesc
                        : pendingDelete
                          ? copy.deleteWalletDesc(pendingDelete.name)
                          : ""
                }
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDelete}
                open={!!pendingDelete}
                title={copy.removeWallet}
                variant="destructive"
            />

            <ConfirmDialog
                busy={submitting}
                cancelLabel={copy.cancel}
                confirmLabel={copy.changeType}
                description={copy.changeTypeDesc}
                onClose={() => setConfirmTypeChangeOpen(false)}
                onConfirm={() => submitWallet(true)}
                open={confirmTypeChangeOpen}
                title={copy.confirmTypeChange}
            />
        </div>
    );
};

export default Wallets;
