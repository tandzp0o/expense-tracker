import React from "react";
import { Banknote, Landmark, Smartphone, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale } from "contexts/LocaleContext";
import { cn } from "lib/utils";
import { getCategoryMeta } from "../lib/categories";
import { formatMoney } from "../lib/format";
import { useT } from "../lib/i18n";
import { toAmount, type BudgetItem, type Wallet, type WalletType } from "../lib/types";
import { CategoryIcon, Money, Notice, Track } from "./primitives";

export const WALLET_TYPE_META: Record<
  WalletType,
  { vi: string; en: string; icon: LucideIcon; color: string }
> = {
  cash: { vi: "Tiền mặt", en: "Cash", icon: Banknote, color: "#16a34a" },
  bank: { vi: "Ngân hàng", en: "Bank", icon: Landmark, color: "#2563eb" },
  ewallet: { vi: "Ví điện tử", en: "E-wallet", icon: Smartphone, color: "#db2777" },
};

export const walletTypeMeta = (type?: string) =>
  WALLET_TYPE_META[(type as WalletType) || "cash"] || WALLET_TYPE_META.cash;

export const WalletIcon: React.FC<{ wallet: Wallet; size?: number }> = ({
  wallet,
  size = 40,
}) => {
  const meta = walletTypeMeta(wallet.type);
  const Icon = meta.icon;
  const color = wallet.color && /^#[0-9a-f]{6}$/i.test(wallet.color) ? wallet.color : meta.color;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[11px]"
      style={{ backgroundColor: `${color}1c`, color, height: size, width: size }}
    >
      <Icon className="h-[46%] w-[46%]" />
    </span>
  );
};

/**
 * One wallet. A negative balance is shown for what it is, with a way to fix it
 * right there instead of an error somewhere else.
 */
export const WalletRow: React.FC<{
  wallet: Wallet;
  onReconcile?: (wallet: Wallet) => void;
  /** Offered beside "Cân đối ví" when the wallet is negative. */
  onAddIncome?: (wallet: Wallet) => void;
  trailing?: React.ReactNode;
  compact?: boolean;
  /** Fades the wallet itself; the trailing actions stay fully usable. */
  dimmed?: boolean;
}> = ({ wallet, onReconcile, onAddIncome, trailing, compact, dimmed }) => {
  const t = useT();
  const { isVietnamese } = useLocale();
  const balance = toAmount(wallet.balance);
  const meta = walletTypeMeta(wallet.type);
  const typeLabel = isVietnamese ? meta.vi : meta.en;
  // "Tiền mặt · Tiền mặt" says nothing twice.
  const subtitle = [
    typeLabel.toLowerCase() === String(wallet.name || "").trim().toLowerCase()
      ? ""
      : typeLabel,
    wallet.accountNumber,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="border-b border-ledger-line last:border-b-0">
      <div className={cn("flex items-center gap-3", compact ? "py-3" : "py-4")}>
        <div className={cn("flex min-w-0 flex-1 items-center gap-3", dimmed && "opacity-55")}>
          <WalletIcon size={compact ? 36 : 44} wallet={wallet} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-medium text-ledger-ink">{wallet.name}</p>
            {subtitle ? (
              <p className="truncate text-[12.5px] text-ledger-muted">{subtitle}</p>
            ) : null}
          </div>
          <Money
            amount={balance}
            className={cn("shrink-0 font-semibold", compact ? "text-[14.5px]" : "text-[17px]")}
            currency={wallet.currency}
            tone={balance < 0 ? "out" : "neutral"}
          />
        </div>
        {trailing}
      </div>
      {balance < 0 && onReconcile ? (
        <Notice
          action={
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-[8px] border border-current px-2.5 py-1 text-[12.5px] font-semibold text-ledger-out hover:bg-ledger-paper"
                onClick={() => onReconcile(wallet)}
                type="button"
              >
                {t("Cân đối ví", "Reconcile")}
              </button>
              {onAddIncome ? (
                <button
                  className="rounded-[8px] px-2.5 py-1 text-[12.5px] font-semibold text-ledger-out underline-offset-2 hover:underline"
                  onClick={() => onAddIncome(wallet)}
                  type="button"
                >
                  {t("Ghi khoản thu", "Log income")}
                </button>
              ) : null}
            </div>
          }
          className="mb-3"
          icon={TriangleAlert}
          tone="rose"
        >
          {t(
            `Ví đang âm ${formatMoney(Math.abs(balance), wallet.currency)}. Có thể bạn quên ghi một khoản thu.`,
            `This wallet is ${formatMoney(Math.abs(balance), wallet.currency)} below zero. An income may be missing.`,
          )}
        </Notice>
      ) : null}
    </div>
  );
};

/**
 * One budget as a track. Past its limit the track fills rose and the label
 * says by how much — the budget informs, it never refused the spending.
 */
export const BudgetTrackRow: React.FC<{
  budget: BudgetItem;
  showIcon?: boolean;
  trailing?: React.ReactNode;
  footnote?: React.ReactNode;
}> = ({ budget, showIcon = true, trailing, footnote }) => {
  const t = useT();
  const { isVietnamese } = useLocale();
  const categoryMeta = getCategoryMeta(budget.category);
  // The colour the user picked for this budget, when there is one; the
  // category's own colour otherwise.
  const meta =
    budget.color && /^#[0-9a-f]{6}$/i.test(budget.color)
      ? { ...categoryMeta, color: budget.color }
      : categoryMeta;
  const limit = toAmount(budget.amount);
  const spent = toAmount(budget.spent);
  const percent = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 101 : 0;
  const over = spent - limit;

  return (
    <div className="border-b border-ledger-line py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        {showIcon ? <CategoryIcon meta={meta} size={38} /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-[14.5px] font-medium text-ledger-ink">
              {isVietnamese ? meta.vi : meta.en}
            </p>
            <span className="rounded-full bg-ledger-canvas px-2 py-0.5 text-[11.5px] text-ledger-ink-2">
              {budget.walletId
                ? budget.walletName || t("Một ví", "One wallet")
                : t("Mọi ví", "All wallets")}
            </span>
          </div>
          <p className="ledger-num mt-0.5 text-[12.5px] text-ledger-muted">
            {formatMoney(spent)} / {formatMoney(limit)}
          </p>
        </div>
        <span
          className={cn(
            "ledger-num shrink-0 text-right text-[13px] font-semibold",
            over > 0 ? "text-ledger-out" : "text-ledger-ink-2",
          )}
        >
          {over > 0
            ? t(`Vượt ${formatMoney(over)}`, `${formatMoney(over)} over`)
            : t(`Còn ${formatMoney(-over)}`, `${formatMoney(-over)} left`)}
        </span>
        {trailing}
      </div>
      <Track className="mt-3" percent={percent} />
      {footnote}
    </div>
  );
};
