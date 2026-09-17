export const STANDARD_EXPENSE_CATEGORIES = [
    "Ăn uống",
    "Di chuyển",
    "Mua sắm",
    "Giải trí",
    "Sức khỏe",
    "Giáo dục",
    "Hóa đơn",
    "Khác",
] as const;

export type StandardExpenseCategory =
    (typeof STANDARD_EXPENSE_CATEGORIES)[number];

const CATEGORY_ALIAS_MAP: Record<string, StandardExpenseCategory> = {
    "ăn uống": "Ăn uống",
    "an uong": "Ăn uống",
    "di chuyển": "Di chuyển",
    "di chuyen": "Di chuyển",
    "mua sắm": "Mua sắm",
    "mua sam": "Mua sắm",
    "giải trí": "Giải trí",
    "giai tri": "Giải trí",
    "sức khỏe": "Sức khỏe",
    "suc khoe": "Sức khỏe",
    "giáo dục": "Giáo dục",
    "giao duc": "Giáo dục",
    "hóa đơn": "Hóa đơn",
    "hoa don": "Hóa đơn",
    "khác": "Khác",
    "khac": "Khác",
};

export const normalizeStandardCategory = (value: unknown) => {
    const normalized = String(value || "").trim();
    if (!normalized) {
        return "";
    }

    const directMatch = STANDARD_EXPENSE_CATEGORIES.find(
        (item) => item === normalized,
    );
    if (directMatch) {
        return directMatch;
    }

    const alias = CATEGORY_ALIAS_MAP[normalized.toLowerCase()];
    return alias || "";
};


/**
 * Category used when a wallet is reconciled to the cash the user actually has.
 * It is a real income or expense on purpose: the money genuinely arrived or
 * left, it just was not written down at the time.
 */
export const BALANCE_ADJUSTMENT_CATEGORY = "Điều chỉnh số dư";

/**
 * Category used when a deleted goal gives its savings back to a wallet. It is a
 * goal withdrawal rather than income, so it restores the balance without
 * inflating the month's income figures.
 */
export const GOAL_REFUND_CATEGORY = "Hoàn tiền mục tiêu";
