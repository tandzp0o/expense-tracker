import { STANDARD_EXPENSE_CATEGORY_OPTIONS } from "constants/categories";
import type { TransactionStatus } from "./components/TransactionList";

// Budgets, reports and the backend all store the accented category strings.
// This list used to hold unaccented copies of the same names, so the very same
// category existed twice and never matched; it now reuses the shared source.
export const categoryOptions = STANDARD_EXPENSE_CATEGORY_OPTIONS;

// An expense the user has not classified still needs a truthful category, and
// "Khác" already exists in the shared taxonomy.
export const DEFAULT_EXPENSE_CATEGORY = "Khác";

// Legacy value: expenses without a budget used to be filed here. Nothing writes
// it any more, but rows created before that still carry it.
export const FREE_SPENDING_CATEGORY = "Chi tieu tu do";

export const incomeCategoryOptions = [
  { value: "Salary", vi: "Lương", en: "Salary" },
  { value: "Bonus", vi: "Thưởng", en: "Bonus" },
  { value: "Side income", vi: "Thu nhập phụ", en: "Side income" },
  { value: "Other", vi: "Khác", en: "Other" },
] as const;

export const transactionStatusText: Record<
  TransactionStatus,
  { vi: string; en: string }
> = {
  COMPLETED: { vi: "Đã ghi nhận", en: "Completed" },
  SCHEDULED: { vi: "Đã lên lịch", en: "Scheduled" },
  PENDING: { vi: "Đang chờ", en: "Pending" },
  FAILED: { vi: "Thất bại", en: "Failed" },
  CANCELLED: { vi: "Đã hủy", en: "Cancelled" },
};
