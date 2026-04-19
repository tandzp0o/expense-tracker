import {
    BarChart3,
    CreditCard,
    Goal,
    LayoutDashboard,
    PiggyBank,
    ReceiptText,
    Settings,
    UserRound,
    UtensilsCrossed,
    WalletCards,
} from "lucide-react";
import { Language } from "../contexts/LocaleContext";

const text = {
    vi: {
        dashboard: "Tổng quan",
        transactions: "Giao dịch",
        wallets: "Ví tiền",
        budgets: "Ngân sách",
        goals: "Mục tiêu",
        analytics: "Phân tích",
        dishes: "Món ăn",
        profile: "Hồ sơ",
        settings: "Cài đặt",
        add: "Thêm",
    },
    en: {
        dashboard: "Dashboard",
        transactions: "Transactions",
        wallets: "Wallets",
        budgets: "Budgets",
        goals: "Goals",
        analytics: "Analytics",
        dishes: "Dishes",
        profile: "Profile",
        settings: "Settings",
        add: "Add",
    },
} satisfies Record<Language, Record<string, string>>;

export const buildNavigationItems = (language: Language) => {
    const copy = text[language];
    return [
        {
            to: "/dashboard",
            label: copy.dashboard,
            icon: LayoutDashboard,
        },
        {
            to: "/transactions",
            label: copy.transactions,
            icon: ReceiptText,
        },
        {
            to: "/wallets",
            label: copy.wallets,
            icon: WalletCards,
        },
        {
            to: "/budgets",
            label: copy.budgets,
            icon: CreditCard,
        },
        {
            to: "/goals",
            label: copy.goals,
            icon: Goal,
        },
        {
            to: "/analytics",
            label: copy.analytics,
            icon: BarChart3,
        },
        {
            to: "/dishes",
            label: copy.dishes,
            icon: UtensilsCrossed,
        },
        {
            to: "/profile",
            label: copy.profile,
            icon: UserRound,
        },
        {
            to: "/settings",
            label: copy.settings,
            icon: Settings,
        },
    ] as const;
};

export const buildMobileNavigationItems = (language: Language) => {
    const items = buildNavigationItems(language);
    return [
        items[0],
        items[2],
        {
            to: "/transactions",
            label: text[language].add,
            icon: PiggyBank,
            isPrimary: true,
        },
        items[5],
        items[8],
    ] as const;
};
