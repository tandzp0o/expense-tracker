import { getCategoryMeta, type CategoryMeta } from "./categories";
import { calendarDay, dayGroupLabel } from "./format";
import {
  toAmount,
  walletNameOf,
  type Transaction,
  type TransactionStatus,
  type Wallet,
} from "./types";

export type EntryKind = "income" | "expense" | "transfer" | "goal";

export interface TimelineEntry {
  id: string;
  kind: EntryKind;
  title: string;
  subtitle: string;
  /** Signed for income/expense; positive for transfers and goal moves. */
  amount: number;
  status: TransactionStatus;
  meta: CategoryMeta;
  /** The row to edit or delete. For a transfer, its outgoing leg. */
  source: Transaction;
  editable: boolean;
}

export interface TimelineDay {
  dayKey: string;
  label: string;
  /** Completed income minus expense that day; transfers and goals excluded. */
  net: number;
  entries: TimelineEntry[];
}

const isTransfer = (transaction: Transaction) =>
  Boolean(transaction.transferGroupId) ||
  String(transaction.category || "").toLowerCase() === "transfer";

/**
 * Turns raw rows into day groups the way a person reads their spending. A
 * transfer is stored as two legs; showing both made moving 500.000 ₫ between
 * wallets look like spending it and earning it back, so the legs become one
 * "Vietcombank → Tiền mặt" entry.
 */
export const buildTimeline = (
  transactions: Transaction[],
  wallets: Wallet[],
  timezoneOffsetMinutes: number,
  isVietnamese: boolean,
): TimelineDay[] => {
  const seenTransferGroups = new Set<string>();
  const days = new Map<string, TimelineDay>();

  for (const transaction of transactions) {
    const status = (transaction.status || "COMPLETED") as TransactionStatus;
    const amount = toAmount(transaction.amount);
    const dayKey = calendarDay(transaction.date, timezoneOffsetMinutes);
    const meta = getCategoryMeta(transaction.category, transaction.type);
    const categoryLabel = isVietnamese ? meta.vi : meta.en;
    const walletName = walletNameOf(transaction, wallets);

    let entry: TimelineEntry | null = null;

    if (isTransfer(transaction)) {
      const groupKey = transaction.transferGroupId || transaction._id;
      if (seenTransferGroups.has(groupKey)) {
        continue;
      }
      seenTransferGroups.add(groupKey);

      // With a wallet filter, or across a page boundary, only one leg may be
      // loaded; the missing end is named from the loaded leg's peer wallet.
      const legs = transaction.transferGroupId
        ? transactions.filter(
            (item) => item.transferGroupId === transaction.transferGroupId,
          )
        : [transaction];
      const expenseLeg = legs.find((item) => item.type === "EXPENSE");
      const incomeLeg = legs.find((item) => item.type === "INCOME");
      const outgoing = expenseLeg || transaction;
      const peerName = wallets.find(
        (wallet) => wallet._id === String(transaction.transferPeerWalletId || ""),
      )?.name;
      const otherWallet = isVietnamese ? "Ví khác" : "Another wallet";
      const fromName = expenseLeg
        ? walletNameOf(expenseLeg, wallets)
        : peerName || otherWallet;
      const toName = incomeLeg
        ? walletNameOf(incomeLeg, wallets)
        : peerName || otherWallet;

      entry = {
        id: groupKey,
        kind: "transfer",
        title:
          outgoing.note ||
          (isVietnamese ? `Chuyển sang ${toName || "ví khác"}` : `Transfer to ${toName || "another wallet"}`),
        subtitle: [fromName, toName].filter(Boolean).join(" → "),
        amount,
        status,
        meta: getCategoryMeta("Transfer"),
        source: outgoing,
        editable: false,
      };
    } else if (transaction.type === "GOAL_DEPOSIT" || transaction.type === "GOAL_WITHDRAW") {
      entry = {
        id: transaction._id,
        kind: "goal",
        title:
          transaction.note ||
          (transaction.type === "GOAL_DEPOSIT"
            ? isVietnamese
              ? "Nạp vào mục tiêu"
              : "Moved to a goal"
            : isVietnamese
              ? "Rút từ mục tiêu"
              : "Taken from a goal"),
        subtitle: [categoryLabel, walletName].filter(Boolean).join(" · "),
        amount,
        status,
        meta,
        source: transaction,
        editable: false,
      };
    } else {
      const isIncome = transaction.type === "INCOME";
      entry = {
        id: transaction._id,
        kind: isIncome ? "income" : "expense",
        title: transaction.note || categoryLabel,
        subtitle: [categoryLabel, walletName].filter(Boolean).join(" · "),
        amount: isIncome ? amount : -amount,
        status,
        meta,
        source: transaction,
        // The server refuses to edit system rows such as balance adjustments.
        editable: !transaction.isSystemGenerated,
      };
    }

    if (!days.has(dayKey)) {
      days.set(dayKey, {
        dayKey,
        label: dayGroupLabel(dayKey, timezoneOffsetMinutes, isVietnamese),
        net: 0,
        entries: [],
      });
    }

    const day = days.get(dayKey)!;
    day.entries.push(entry);

    if (
      status === "COMPLETED" &&
      (entry.kind === "income" || entry.kind === "expense")
    ) {
      day.net += entry.amount;
    }
  }

  return Array.from(days.values()).sort((left, right) =>
    right.dayKey.localeCompare(left.dayKey),
  );
};

