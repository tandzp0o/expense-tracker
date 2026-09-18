import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Banknote,
  BriefcaseBusiness,
  CarFront,
  Ellipsis,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  PiggyBank,
  ReceiptText,
  Scale,
  ShoppingBag,
  Target,
  UtensilsCrossed,
} from "lucide-react";
import { STANDARD_EXPENSE_CATEGORY_OPTIONS } from "constants/categories";
import { incomeCategoryOptions } from "features/transactions/constants";

export interface CategoryMeta {
  /** The exact string stored on transactions and budgets. */
  key: string;
  vi: string;
  en: string;
  icon: LucideIcon;
  color: string;
}

// Visuals only. Keys and labels come from the shared taxonomy below so v1 and
// v2 can never drift apart the way the unaccented copy once did.
const EXPENSE_VISUALS: Record<string, { icon: LucideIcon; color: string }> = {
  "Ăn uống": { icon: UtensilsCrossed, color: "#f59e0b" },
  "Di chuyển": { icon: CarFront, color: "#3b82f6" },
  "Mua sắm": { icon: ShoppingBag, color: "#8b5cf6" },
  "Giải trí": { icon: Gamepad2, color: "#ec4899" },
  "Sức khỏe": { icon: HeartPulse, color: "#ef4444" },
  "Giáo dục": { icon: GraduationCap, color: "#6366f1" },
  "Hóa đơn": { icon: ReceiptText, color: "#14b8a6" },
  Khác: { icon: Ellipsis, color: "#64748b" },
};

const INCOME_VISUALS: Record<string, { icon: LucideIcon; color: string }> = {
  Salary: { icon: Banknote, color: "#16a34a" },
  Bonus: { icon: Gift, color: "#0ea5e9" },
  "Side income": { icon: BriefcaseBusiness, color: "#10b981" },
  Other: { icon: PiggyBank, color: "#64748b" },
};

export const EXPENSE_CATEGORIES: CategoryMeta[] =
  STANDARD_EXPENSE_CATEGORY_OPTIONS.map((option) => ({
    key: option.value,
    vi: option.vi,
    en: option.en,
    ...(EXPENSE_VISUALS[option.value] || EXPENSE_VISUALS["Khác"]),
  }));

export const INCOME_CATEGORIES: CategoryMeta[] = incomeCategoryOptions.map(
  (option) => ({
    key: option.value,
    vi: option.vi,
    en: option.en,
    ...(INCOME_VISUALS[option.value] || INCOME_VISUALS.Other),
  }),
);

export const DEFAULT_EXPENSE_CATEGORY = "Khác";
export const DEFAULT_INCOME_CATEGORY = INCOME_CATEGORIES[0]?.key || "Salary";

const SPECIAL: Record<string, CategoryMeta> = {
  transfer: {
    key: "Transfer",
    vi: "Chuyển ví",
    en: "Transfer",
    icon: ArrowLeftRight,
    color: "#64748b",
  },
  adjustment: {
    key: "Điều chỉnh số dư",
    vi: "Cân đối số dư",
    en: "Balance adjustment",
    icon: Scale,
    color: "#64748b",
  },
  goal: {
    key: "Mục tiêu",
    vi: "Mục tiêu",
    en: "Goal",
    icon: Target,
    color: "#2563eb",
  },
};

const stripAccents = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

// Rows saved before the taxonomy was unified still carry unaccented names, and
// expenses without a budget were once filed under a placeholder.
const LEGACY_ALIASES: Record<string, string> = {
  "chi tieu tu do": "Khác",
};

/**
 * Icon, colour and label for whatever category string a row carries,
 * including legacy spellings. Unknown categories keep their own text rather
 * than being silently relabelled.
 */
export const getCategoryMeta = (
  category?: string | null,
  type?: string,
): CategoryMeta => {
  const raw = String(category || "").trim();

  if (type === "GOAL_DEPOSIT" || type === "GOAL_WITHDRAW") {
    // v1 and v2 store "Goal"; the server stores refunds under its own name.
    const goalKey = stripAccents(raw);
    if (!raw || goalKey === "goal" || goalKey === "muc tieu") {
      return SPECIAL.goal;
    }
    if (goalKey === "hoan tien muc tieu") {
      return { ...SPECIAL.goal, key: raw, vi: "Hoàn tiền mục tiêu", en: "Goal refund" };
    }
    return { ...SPECIAL.goal, vi: raw, en: raw };
  }

  const exact =
    EXPENSE_CATEGORIES.find((item) => item.key === raw) ||
    INCOME_CATEGORIES.find((item) => item.key === raw);
  if (exact) {
    return exact;
  }

  const normalized = stripAccents(raw);
  if (normalized === "transfer") {
    return SPECIAL.transfer;
  }
  if (normalized === stripAccents(SPECIAL.adjustment.key)) {
    return SPECIAL.adjustment;
  }

  const aliasTarget = LEGACY_ALIASES[normalized];
  const byAccentFree =
    (aliasTarget &&
      EXPENSE_CATEGORIES.find((item) => item.key === aliasTarget)) ||
    EXPENSE_CATEGORIES.find((item) => stripAccents(item.key) === normalized);
  if (byAccentFree) {
    return byAccentFree;
  }

  return {
    key: raw,
    vi: raw || "Khác",
    en: raw || "Other",
    icon: Ellipsis,
    color: "#64748b",
  };
};
