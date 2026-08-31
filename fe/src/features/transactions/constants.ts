import type { TransactionStatus } from "./components/TransactionList";

export const categoryOptions = [
  { value: "An uong", vi: "Ăn uống", en: "Food" },
  { value: "Di chuyen", vi: "Di chuyển", en: "Transport" },
  { value: "Mua sam", vi: "Mua sắm", en: "Shopping" },
  { value: "Giai tri", vi: "Giải trí", en: "Entertainment" },
  { value: "Suc khoe", vi: "Sức khỏe", en: "Health" },
  { value: "Giao duc", vi: "Giáo dục", en: "Education" },
  { value: "Hoa don", vi: "Hóa đơn", en: "Bills" },
  { value: "Khac", vi: "Khác", en: "Other" },
  { value: "Chi tieu tu do", vi: "Chi tiêu tự do", en: "Free spending" },
] as const;

// Expenses do not require a budget. When none is picked the transaction is
// still categorised so reports and the backend category rule stay satisfied.
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
