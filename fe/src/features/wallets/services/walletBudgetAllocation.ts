/**
 * The budget summary endpoint groups budgets by wallet, and a budget that is
 * not pinned to a wallet lands in a group whose walletId is empty. Looking that
 * data up by wallet id therefore drops every "applies to all wallets" budget,
 * which is why wallet cards used to report nothing reserved. These helpers put
 * those budgets back onto every card.
 */

export interface WalletReserveItem {
  _id: string;
  /** Empty when the budget is not pinned to a single wallet. */
  walletId?: string | null;
  walletName?: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  overspent?: number;
  color?: string;
  /** Set on the copies we spread across wallets, so the UI can label them. */
  appliesToAllWallets?: boolean;
}

interface WalletBudgetSummaryLike {
  walletId?: string | null;
  items?: WalletReserveItem[];
}

/**
 * Global budgets are shown on every wallet card, but each card only carries the
 * slice that matches its share of the money. Repeating the full amount on every
 * card would multiply the budget: read together the cards would claim several
 * times the real reserve, and small wallets would be flagged as over-allocated
 * by a budget the big wallet actually covers. Weighting by balance keeps the
 * slices adding back up to exactly one budget.
 */
const getGlobalBudgetShare = (
  walletBalance: number,
  totalWalletBalance: number,
  walletCount: number,
) => {
  if (totalWalletBalance > 0) {
    return Math.max(walletBalance, 0) / totalWalletBalance;
  }

  // No balances to weigh the split by, so fall back to an even share.
  return walletCount > 0 ? 1 / walletCount : 0;
};

/**
 * Budgets to show on one wallet card: the ones pinned to it, plus a share of
 * every budget that applies to all wallets.
 */
export const buildWalletReserveItems = ({
  walletId,
  walletBalance,
  walletCount,
  totalWalletBalance,
  walletSummaries,
}: {
  walletId: string;
  walletBalance: number;
  walletCount: number;
  totalWalletBalance: number;
  walletSummaries?: WalletBudgetSummaryLike[] | null;
}): WalletReserveItem[] => {
  const summaries = walletSummaries || [];
  const pinnedItems =
    summaries.find((summary) => summary.walletId === walletId)?.items || [];
  const share = getGlobalBudgetShare(
    walletBalance,
    totalWalletBalance,
    walletCount,
  );

  const globalItems = summaries
    .filter((summary) => !summary.walletId)
    .flatMap((summary) => summary.items || [])
    .map((item) => ({
      ...item,
      amount: Number(item.amount || 0) * share,
      spent: Number(item.spent || 0) * share,
      remaining: Number(item.remaining || 0) * share,
      overspent: Number(item.overspent || 0) * share,
      appliesToAllWallets: true,
    }));

  return [...pinnedItems, ...globalItems];
};
