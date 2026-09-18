// Shapes of what the API returns, as far as the Ledger screens rely on them.
// Fields the server may omit are optional so a missing one degrades instead of
// throwing at render time.

export type WalletType = "cash" | "bank" | "ewallet";

export interface Wallet {
  _id: string;
  name: string;
  type: WalletType;
  balance: number;
  initialBalance?: number;
  currency?: string;
  color?: string;
  icon?: string;
  imageUrl?: string;
  accountNumber?: string;
  isArchived?: boolean;
  hasTransactions?: boolean;
}

export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "GOAL_DEPOSIT"
  | "GOAL_WITHDRAW"
  | "ADJUSTMENT";

export type TransactionStatus =
  | "COMPLETED"
  | "SCHEDULED"
  | "PENDING"
  | "FAILED"
  | "CANCELLED";

export interface Transaction {
  _id: string;
  type: TransactionType;
  status?: TransactionStatus;
  amount: number | string;
  category: string;
  date: string;
  note?: string;
  createdAt?: string;
  budgetId?: string | null;
  goalId?: string | null;
  /** Populated as `{ _id, name }` by the list endpoint, a bare id elsewhere. */
  walletId: string | { _id: string; name?: string } | null;
  transferGroupId?: string | null;
  transferPeerWalletId?: string | null;
  isSystemGenerated?: boolean;
}

export interface BudgetItem {
  _id: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  overspent?: number;
  percent?: number;
  /** Empty when the budget applies to every wallet. */
  walletId?: string | null;
  walletName?: string;
  color?: string;
  note?: string;
  month: number;
  year: number;
}

export interface BudgetSummary {
  month: number;
  year: number;
  totalBudget: number;
  totalSpent: number;
  /** Budget minus spent; negative once the month is overspent. */
  totalRemaining: number;
  items: BudgetItem[];
}

export interface Goal {
  _id: string;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  category?: string;
  deadline?: string | null;
  status?: "active" | "completed" | "expired";
  imageUrl?: string;
}

export interface MonthHistoryPoint {
  month: string;
  income: number;
  expense: number;
}

export interface ProfileStats {
  totalBalance?: number;
  monthlyIncome?: number;
  monthlyExpense?: number;
  history?: MonthHistoryPoint[];
}

export const walletIdOf = (transaction: Transaction) =>
  typeof transaction.walletId === "object" && transaction.walletId
    ? transaction.walletId._id
    : String(transaction.walletId || "");

export const walletNameOf = (
  transaction: Transaction,
  wallets: Wallet[] = [],
) => {
  if (typeof transaction.walletId === "object" && transaction.walletId?.name) {
    return transaction.walletId.name;
  }

  const id = walletIdOf(transaction);
  return wallets.find((wallet) => wallet._id === id)?.name || "";
};

export const toAmount = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
