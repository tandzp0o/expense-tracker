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

export const STANDARD_EXPENSE_CATEGORY_OPTIONS = [
  { value: "Ăn uống", vi: "Ăn uống", en: "Food" },
  { value: "Di chuyển", vi: "Di chuyển", en: "Transport" },
  { value: "Mua sắm", vi: "Mua sắm", en: "Shopping" },
  { value: "Giải trí", vi: "Giải trí", en: "Entertainment" },
  { value: "Sức khỏe", vi: "Sức khỏe", en: "Health" },
  { value: "Giáo dục", vi: "Giáo dục", en: "Education" },
  { value: "Hóa đơn", vi: "Hóa đơn", en: "Bills" },
  { value: "Khác", vi: "Khác", en: "Other" },
] as const;

