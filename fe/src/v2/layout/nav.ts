import type { LucideIcon } from "lucide-react";
import {
  ChartColumn,
  ChartPie,
  LayoutDashboard,
  ReceiptText,
  Soup,
  Target,
  WalletCards,
} from "lucide-react";

export interface LedgerNavItem {
  to: string;
  vi: string;
  en: string;
  icon: LucideIcon;
}

export interface LedgerNavGroup {
  vi: string;
  en: string;
  items: LedgerNavItem[];
}

/**
 * Grouped by what the user is doing rather than by data type: the daily loop
 * first, planning second, and the look-back screens last.
 */
export const LEDGER_NAV: LedgerNavGroup[] = [
  {
    vi: "Hằng ngày",
    en: "Daily",
    items: [
      { to: "/dashboard", vi: "Tổng quan", en: "Overview", icon: LayoutDashboard },
      { to: "/transactions", vi: "Giao dịch", en: "Transactions", icon: ReceiptText },
    ],
  },
  {
    vi: "Kế hoạch",
    en: "Plan",
    items: [
      { to: "/budgets", vi: "Ngân sách", en: "Budgets", icon: ChartPie },
      { to: "/goals", vi: "Mục tiêu", en: "Goals", icon: Target },
    ],
  },
  {
    vi: "Tài sản",
    en: "Assets",
    items: [{ to: "/wallets", vi: "Ví tiền", en: "Wallets", icon: WalletCards }],
  },
  {
    vi: "Xem lại",
    en: "Review",
    items: [
      { to: "/analytics", vi: "Phân tích", en: "Analytics", icon: ChartColumn },
      { to: "/dishes", vi: "Món ăn", en: "Dishes", icon: Soup },
    ],
  },
];
