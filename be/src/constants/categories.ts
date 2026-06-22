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

