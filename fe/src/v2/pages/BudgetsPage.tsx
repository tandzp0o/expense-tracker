import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ChartPie,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { budgetApi, walletApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { cn } from "lib/utils";
import { BudgetTrackRow } from "../components/finance";
import { ConfirmDialog, Panel } from "../components/overlays";
import {
  Button,
  CategoryIcon,
  Chip,
  EmptyState,
  FieldLabel,
  HeroStrip,
  Money,
  Notice,
  PageHeader,
  SkeletonRows,
  TextInput,
  TextLink,
  Track,
} from "../components/primitives";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useLedger } from "../LedgerContext";
import { EXPENSE_CATEGORIES, getCategoryMeta } from "../lib/categories";
import {
  currentMonth,
  daysLeftInMonth,
  formatAmountInput,
  formatMoney,
  monthLabel,
  parseAmountInput,
} from "../lib/format";
import { useT } from "../lib/i18n";
import { extractWarnings, getIdToken } from "../lib/session";
import {
  toAmount,
  type BudgetItem,
  type BudgetSummary,
  type Wallet,
} from "../lib/types";

interface Period {
  month: number;
  year: number;
}

const shiftMonth = ({ month, year }: Period, delta: number): Period => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

const comparePeriods = (left: Period, right: Period) =>
  left.year * 12 + left.month - (right.year * 12 + right.month);

const QUICK_LIMITS = [1000000, 2000000, 5000000];

// The label palette is the category palette, so a budget recoloured by hand
// still sits comfortably next to the icons around it.
const LABEL_COLORS = Array.from(new Set(EXPENSE_CATEGORIES.map((item) => item.color)));

/** "" when the budget applies to every wallet. */
const walletScopeOf = (budget: Pick<BudgetItem, "walletId">) => String(budget.walletId || "");

const overspendOf = (budget: BudgetItem) =>
  Math.max(toAmount(budget.spent) - toAmount(budget.amount), 0);

// Legacy spellings ("An uong") and the accented key are the same group.
const sameCategory = (left: string, right: string) =>
  getCategoryMeta(left).key === getCategoryMeta(right).key;

const categoryRank = (category: string) => {
  const index = EXPENSE_CATEGORIES.findIndex(
    (item) => item.key === getCategoryMeta(category).key,
  );
  return index < 0 ? EXPENSE_CATEGORIES.length : index;
};

/* ------------------------------------------------------------ Month stepper */

const MonthStepper: React.FC<{
  period: Period;
  onChange: (period: Period) => void;
  variant?: "pill" | "field";
  className?: string;
}> = ({ period, onChange, variant = "pill", className }) => {
  const t = useT();
  const { isVietnamese } = useLocale();
  const field = variant === "field";
  const arrow = cn(
    "flex shrink-0 items-center justify-center text-ledger-ink-2 transition-colors hover:bg-ledger-canvas hover:text-ledger-ink",
    field ? "h-10 w-10 rounded-[9px]" : "h-8 w-8 rounded-full",
  );

  return (
    <div
      className={cn(
        "flex items-center border border-ledger-line bg-ledger-paper px-1",
        field ? "h-12 rounded-[12px]" : "h-10 rounded-full",
        className,
      )}
    >
      <button
        aria-label={t("Tháng trước", "Previous month")}
        className={arrow}
        onClick={() => onChange(shiftMonth(period, -1))}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className="ledger-num min-w-[104px] flex-1 px-1 text-center text-[14px] font-medium text-ledger-ink"
      >
        {monthLabel(period.month, period.year, isVietnamese)}
      </span>
      <button
        aria-label={t("Tháng sau", "Next month")}
        className={arrow}
        onClick={() => onChange(shiftMonth(period, 1))}
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

/* ------------------------------------------------------------ Scope option */

const ScopeOption: React.FC<{
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}> = ({ checked, disabled, onSelect, title, hint }) => (
  <label
    className={cn(
      "flex items-start gap-3 rounded-[12px] border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ledger-accent",
      checked
        ? "border-ledger-accent bg-ledger-accent-wash"
        : "border-ledger-line hover:border-ledger-line-strong",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
    )}
  >
    <input
      checked={checked}
      className="sr-only"
      disabled={disabled}
      name="budget-scope"
      onChange={onSelect}
      type="radio"
    />
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
        checked ? "border-ledger-accent" : "border-ledger-line-strong",
      )}
    >
      {checked ? <span className="h-2 w-2 rounded-full bg-ledger-accent" /> : null}
    </span>
    <span className="min-w-0">
      <span className="block text-[14px] font-medium text-ledger-ink">{title}</span>
      <span className="mt-0.5 block text-[12.5px] leading-snug text-ledger-ink-2">{hint}</span>
    </span>
  </label>
);

/* -------------------------------------------------------------- Form panel */

interface FormSession {
  editing: BudgetItem | null;
  period: Period;
  category: string;
}

type Scope = "all" | "wallet";

/**
 * Create or edit one budget. Nothing here stops spending; the only things it
 * refuses are the ones the server cannot store (no amount, no wallet picked
 * for a wallet budget). A second budget for the same group, wallet and month
 * is flagged while the form is filled in, and if it still reaches the server
 * the refusal is shown next to the fields instead of in a vanishing toast.
 */
const BudgetFormPanel: React.FC<{
  session: FormSession | null;
  wallets: Wallet[];
  onClose: () => void;
  onEditExisting: (budget: BudgetItem) => void;
}> = ({ session, wallets, onClose, onEditExisting }) => {
  const open = session !== null;
  const editing = session?.editing || null;
  const t = useT();
  const isDesktop = useIsDesktop();
  const { isVietnamese } = useLocale();
  const { toast } = useToast();
  const { notifyDataChanged } = useLedger();
  const chipRowRef = useRef<HTMLDivElement>(null);

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].key);
  const [amount, setAmount] = useState(0);
  const [scope, setScope] = useState<Scope>("all");
  const [walletId, setWalletId] = useState("");
  const [period, setPeriod] = useState<Period>({ month: 1, year: 2000 });
  const [color, setColor] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [monthItems, setMonthItems] = useState<BudgetItem[]>([]);

  // Reset from whatever opened the panel. The session object only changes
  // identity when the panel is (re)opened, so a refresh of the page behind it
  // never wipes what the user is typing.
  useEffect(() => {
    if (!session) {
      return;
    }
    const source = session.editing;
    const pinned = source ? walletScopeOf(source) : "";
    setCategory(source ? source.category : session.category);
    setAmount(source ? toAmount(source.amount) : 0);
    setScope(pinned ? "wallet" : "all");
    setWalletId(pinned);
    setPeriod(source ? { month: source.month, year: source.year } : session.period);
    setColor(source?.color || "");
    setNote(source?.note || "");
    setError(null);
    setConfirmDelete(false);
  }, [session]);

  // A refusal is about the values that were sent; once they change it no
  // longer describes the form.
  useEffect(() => {
    setError(null);
  }, [amount, category, period.month, period.year, scope, walletId]);

  // Budgets of the month being planned, to spot a duplicate before the
  // server refuses it.
  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    (async () => {
      try {
        const summary: BudgetSummary = await budgetApi.getBudgetSummary(
          { month: period.month, year: period.year },
          await getIdToken(),
        );
        if (active) {
          setMonthItems(summary?.items || []);
        }
      } catch {
        // Only a courtesy check; the server still guards against duplicates.
        if (active) {
          setMonthItems([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [open, period.month, period.year]);

  // On a phone the categories are one scrolling row; bring the chosen one
  // into view so editing "Hóa đơn" does not open on an apparently empty pick.
  useEffect(() => {
    if (!session || isDesktop) {
      return;
    }
    const timer = window.setTimeout(() => {
      const row = chipRowRef.current;
      const chosen = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (row && chosen) {
        row.scrollLeft = chosen.offsetLeft - row.clientWidth / 2 + chosen.offsetWidth / 2;
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [session, isDesktop]);

  // A budget pinned to a wallet that has since been archived still has to
  // show which wallet it is on, or saving would silently move it.
  const walletOptions = useMemo(() => {
    const pinned = editing ? walletScopeOf(editing) : "";
    if (!pinned || wallets.some((wallet) => wallet._id === pinned)) {
      return wallets.map((wallet) => ({ id: wallet._id, name: wallet.name }));
    }
    return [
      ...wallets.map((wallet) => ({ id: wallet._id, name: wallet.name })),
      {
        id: pinned,
        name: `${editing?.walletName || t("Ví cũ", "Old wallet")} (${t("đã lưu trữ", "archived")})`,
      },
    ];
  }, [editing, t, wallets]);

  const scopeId = scope === "wallet" ? walletId : "";
  const meta = getCategoryMeta(category);
  const categoryName = isVietnamese ? meta.vi : meta.en;
  const periodName = monthLabel(period.month, period.year, isVietnamese);

  const duplicate = useMemo(
    () =>
      monthItems.find(
        (budget) =>
          budget._id !== editing?._id &&
          sameCategory(budget.category, category) &&
          walletScopeOf(budget) === scopeId,
      ) || null,
    [category, editing, monthItems, scopeId],
  );

  // An every-wallet budget and a pinned one for the same group both count
  // the pinned wallet's spending. Worth saying, not worth refusing.
  const overlap = useMemo(
    () =>
      duplicate
        ? null
        : monthItems.find(
            (budget) =>
              budget._id !== editing?._id &&
              sameCategory(budget.category, category) &&
              walletScopeOf(budget) !== scopeId &&
              (!scopeId || !walletScopeOf(budget)),
          ) || null,
    [category, duplicate, editing, monthItems, scopeId],
  );

  // What has already gone out is only known for the budget as it was saved;
  // a different group, wallet or month would count different spending.
  const spentSoFar =
    editing &&
    sameCategory(editing.category, category) &&
    walletScopeOf(editing) === scopeId &&
    editing.month === period.month &&
    editing.year === period.year
      ? toAmount(editing.spent)
      : null;

  const palette =
    color && !LABEL_COLORS.some((swatch) => swatch.toLowerCase() === color.toLowerCase())
      ? [...LABEL_COLORS, color]
      : LABEL_COLORS;

  const canSave =
    amount > 0 && Boolean(category) && (scope === "all" || Boolean(walletId)) && !saving;

  const chooseWalletScope = () => {
    setScope("wallet");
    setWalletId((current) => current || walletOptions[0]?.id || "");
  };

  const save = async () => {
    if (!canSave || !session) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      const payload = {
        category,
        amount,
        month: period.month,
        year: period.year,
        // null, not "": the server reads an empty scope as "every wallet".
        walletId: scope === "wallet" ? walletId : null,
        color: editing ? color : color || undefined,
        note: editing ? note.trim() : note.trim() || undefined,
      };

      const response = editing
        ? await budgetApi.updateBudget(editing._id, payload, token)
        : await budgetApi.createBudget(payload, token);

      const unlinked = editing ? toAmount(response?.unlinkedTransactions) : 0;
      toast({
        title: editing
          ? t("Đã lưu thay đổi", "Changes saved")
          : t(`Đã tạo ngân sách ${categoryName}`, `${categoryName} budget created`),
        description:
          unlinked > 0
            ? t(
                `${unlinked} giao dịch cũ nằm ngoài tháng hoặc ví mới nên không còn gắn với ngân sách này. Chúng vẫn được giữ nguyên.`,
                `${unlinked} earlier transactions fall outside the new month or wallet, so they are no longer tied to this budget. They are kept as they were.`,
              )
            : undefined,
        variant: "success",
      });
      extractWarnings(response).forEach((warning) =>
        toast({ title: warning.message, variant: "default" }),
      );

      notifyDataChanged();
      onClose();
    } catch (saveError: any) {
      // Most often the 409 for a second budget on the same group, wallet and
      // month: something to fix in this form, so it stays in this form.
      setError(saveError?.message || t("Chưa lưu được ngân sách.", "The budget could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) {
      return;
    }

    setDeleting(true);
    try {
      const response = await budgetApi.deleteBudget(editing._id, await getIdToken());
      toast({ title: t("Đã xoá ngân sách", "Budget deleted"), variant: "success" });
      extractWarnings(response).forEach((warning) =>
        toast({ title: warning.message, variant: "default" }),
      );
      notifyDataChanged();
      setConfirmDelete(false);
      onClose();
    } catch (deleteError: any) {
      setConfirmDelete(false);
      toast({
        title: t("Chưa xoá được ngân sách", "Could not delete the budget"),
        description: deleteError?.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const footer = (
    <div className="flex flex-col gap-3">
      {error ? (
        <Notice icon={TriangleAlert} tone="rose">
          {error}
        </Notice>
      ) : null}
      <div className="flex items-center gap-2">
        {editing ? (
          <button
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-ledger-out transition-colors hover:bg-ledger-out-wash disabled:opacity-50 lg:h-10"
            disabled={saving || deleting}
            onClick={() => setConfirmDelete(true)}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            {t("Xoá", "Delete")}
          </button>
        ) : null}
        {isDesktop ? (
          <Button className="ml-auto" onClick={onClose} variant="ghost">
            {t("Huỷ", "Cancel")}
          </Button>
        ) : null}
        <Button
          className={isDesktop ? undefined : "flex-1"}
          disabled={!canSave}
          onClick={() => void save()}
          size={isDesktop ? "md" : "lg"}
        >
          {saving
            ? t("Đang lưu...", "Saving...")
            : editing
              ? t("Lưu thay đổi", "Save changes")
              : t("Tạo ngân sách", "Create budget")}
        </Button>
      </div>
    </div>
  );

  const extraCategory = EXPENSE_CATEGORIES.some((item) => item.key === meta.key) ? null : meta;
  const categoryChoices = extraCategory ? [...EXPENSE_CATEGORIES, extraCategory] : EXPENSE_CATEGORIES;

  return (
    <>
      <Panel
        footer={footer}
        // With the delete confirmation on top, Escape belongs to it alone.
        onClose={() => {
          if (!confirmDelete) {
            onClose();
          }
        }}
        open={open}
        title={editing ? t("Sửa ngân sách", "Edit budget") : t("Ngân sách mới", "New budget")}
      >
        <div className="flex flex-col gap-6 pb-2">
          <div>
            <FieldLabel>{t("Nhóm chi tiêu", "Spending group")}</FieldLabel>
            {isDesktop ? (
              <div className="grid grid-cols-4 gap-2">
                {categoryChoices.map((item) => (
                  <button
                    aria-pressed={item.key === meta.key}
                    className={cn(
                      "flex min-w-0 flex-col items-center gap-1.5 rounded-[12px] border px-1 py-2.5 text-[12.5px] font-medium transition-colors",
                      item.key === meta.key
                        ? "border-ledger-accent bg-ledger-accent-wash text-ledger-accent"
                        : "border-ledger-line text-ledger-ink-2 hover:border-ledger-line-strong hover:text-ledger-ink",
                    )}
                    key={item.key}
                    onClick={() => setCategory(item.key)}
                    type="button"
                  >
                    <CategoryIcon meta={item} size={32} />
                    <span className="max-w-full truncate">{isVietnamese ? item.vi : item.en}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="ledger-scroll-x -mx-1 flex gap-2 px-1 pb-1" ref={chipRowRef}>
                {categoryChoices.map((item) => (
                  <Chip
                    icon={item.icon}
                    key={item.key}
                    onClick={() => setCategory(item.key)}
                    selected={item.key === meta.key}
                  >
                    {isVietnamese ? item.vi : item.en}
                  </Chip>
                ))}
              </div>
            )}
            {duplicate ? (
              <Notice
                action={
                  <TextLink onClick={() => onEditExisting(duplicate)}>
                    {t("Sửa ngân sách đó", "Edit that one")}
                  </TextLink>
                }
                className="mt-3"
                icon={Info}
                tone="amber"
              >
                {scopeId
                  ? t(
                      `${periodName} đã có ngân sách ${categoryName} cho ví này.`,
                      `${periodName} already has a ${categoryName} budget for this wallet.`,
                    )
                  : t(
                      `${periodName} đã có ngân sách ${categoryName} cho mọi ví.`,
                      `${periodName} already has a ${categoryName} budget for all wallets.`,
                    )}
              </Notice>
            ) : null}
          </div>

          <div>
            <FieldLabel htmlFor="budget-amount">{t("Hạn mức tháng", "Monthly limit")}</FieldLabel>
            <label className="block border-b-2 border-ledger-line pb-1 focus-within:border-ledger-accent">
              <div className="flex items-baseline justify-end gap-2">
                <input
                  className="ledger-num w-full min-w-0 bg-transparent text-right text-[36px] font-semibold leading-tight tracking-[-0.03em] text-ledger-ink outline-none placeholder:text-ledger-line-strong lg:text-[44px]"
                  id="budget-amount"
                  inputMode="numeric"
                  onChange={(event) => setAmount(parseAmountInput(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void save();
                    }
                  }}
                  placeholder="0"
                  value={formatAmountInput(amount)}
                />
                <span className="text-[22px] font-semibold text-ledger-muted lg:text-[26px]">₫</span>
              </div>
            </label>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <span className="text-[12.5px] text-ledger-muted">{t("Gợi ý nhanh:", "Quick picks:")}</span>
              {QUICK_LIMITS.map((value) => (
                <button
                  aria-pressed={amount === value}
                  className={cn(
                    "ledger-num h-8 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors",
                    amount === value
                      ? "bg-ledger-accent-wash text-ledger-accent"
                      : "bg-ledger-canvas text-ledger-ink-2 hover:text-ledger-ink",
                  )}
                  key={value}
                  onClick={() => setAmount(value)}
                  type="button"
                >
                  {t(`${value / 1000000} triệu`, `${value / 1000000}M`)}
                </button>
              ))}
            </div>
            {spentSoFar !== null && amount > 0 ? (
              spentSoFar > amount ? (
                <Notice
                  className="mt-3"
                  detail={t(
                    "Ngân sách chỉ để theo dõi, các khoản vẫn được ghi nhận bình thường.",
                    "A budget only tracks; every entry is still recorded.",
                  )}
                  icon={TriangleAlert}
                  tone="amber"
                >
                  {t(
                    `Đã chi ${formatMoney(spentSoFar)} trong ${periodName.toLowerCase()}, vượt hạn mức này ${formatMoney(spentSoFar - amount)}.`,
                    `${formatMoney(spentSoFar)} already spent in ${periodName}, ${formatMoney(spentSoFar - amount)} over this limit.`,
                  )}
                </Notice>
              ) : (
                <Notice className="mt-3" tone="muted">
                  {t(
                    `Đã chi ${formatMoney(spentSoFar)} trong ${periodName.toLowerCase()} · còn ${formatMoney(amount - spentSoFar)} với hạn mức này.`,
                    `${formatMoney(spentSoFar)} spent in ${periodName} · ${formatMoney(amount - spentSoFar)} left at this limit.`,
                  )}
                </Notice>
              )
            ) : null}
          </div>

          <div>
            <FieldLabel>{t("Áp dụng cho", "Applies to")}</FieldLabel>
            <div className="flex flex-col gap-2" role="radiogroup">
              <ScopeOption
                checked={scope === "all"}
                hint={t(
                  "Khoản chi thuộc nhóm này đều được tính, trả bằng ví nào cũng vậy",
                  "Every expense in this group counts, whichever wallet paid",
                )}
                onSelect={() => setScope("all")}
                title={t("Tất cả ví", "All wallets")}
              />
              <ScopeOption
                checked={scope === "wallet"}
                disabled={!walletOptions.length}
                hint={
                  walletOptions.length
                    ? t(
                        "Chỉ khoản chi trả từ ví đó mới được tính",
                        "Only spending paid from that wallet counts",
                      )
                    : t("Bạn chưa có ví nào", "You have no wallets yet")
                }
                onSelect={chooseWalletScope}
                title={t("Một ví cụ thể", "One wallet")}
              />
              {scope === "wallet" ? (
                <select
                  aria-label={t("Ví áp dụng", "Wallet")}
                  className="h-11 w-full rounded-[10px] border border-ledger-line bg-ledger-paper px-3 text-[14px] text-ledger-ink outline-none transition-colors focus:border-ledger-accent"
                  onChange={(event) => setWalletId(event.target.value)}
                  value={walletId}
                >
                  {walletOptions.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            {overlap ? (
              <Notice className="mt-3" icon={Info} tone="blue">
                {walletScopeOf(overlap)
                  ? t(
                      `${periodName} đã có ngân sách ${categoryName} riêng cho ví ${overlap.walletName || ""}. Khoản chi từ ví đó sẽ được tính ở cả hai.`,
                      `${periodName} already has a ${categoryName} budget for ${overlap.walletName || "one wallet"}. Spending from it will count in both.`,
                    )
                  : t(
                      `${periodName} đã có ngân sách ${categoryName} cho mọi ví. Khoản chi từ ví này sẽ được tính ở cả hai.`,
                      `${periodName} already has an all-wallet ${categoryName} budget. Spending from this wallet will count in both.`,
                    )}
              </Notice>
            ) : null}
          </div>

          <div>
            <FieldLabel>{t("Tháng", "Month")}</FieldLabel>
            <MonthStepper onChange={setPeriod} period={period} variant="field" />
            <p className="mt-2 text-[12.5px] text-ledger-muted">
              {t("Có thể đặt trước cho các tháng sau", "You can plan ahead for later months")}
            </p>
          </div>

          <div>
            <FieldLabel hint={color ? undefined : t("Đang theo màu của nhóm", "Using the group colour")}>
              {t("Màu nhãn", "Label colour")}
            </FieldLabel>
            <div className="flex flex-wrap gap-3">
              {palette.map((swatch, index) => {
                const selected = swatch.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    aria-label={t(`Màu ${index + 1}`, `Colour ${index + 1}`)}
                    aria-pressed={selected}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110"
                    key={swatch}
                    // Tapping the chosen colour again goes back to the group's own.
                    onClick={() => setColor(selected ? "" : swatch)}
                    style={{
                      backgroundColor: swatch,
                      boxShadow: selected ? `0 0 0 2px var(--l-paper), 0 0 0 4px ${swatch}` : undefined,
                    }}
                    type="button"
                  >
                    {selected ? <Check className="h-4 w-4 text-white" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="budget-note">{t("Ghi chú (không bắt buộc)", "Note (optional)")}</FieldLabel>
            <TextInput
              id="budget-note"
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("Ví dụ: gồm cả tiền gửi xe", "e.g. parking included")}
              value={note}
            />
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        busy={deleting}
        cancelLabel={t("Giữ lại", "Keep it")}
        confirmLabel={deleting ? t("Đang xoá...", "Deleting...") : t("Xoá ngân sách", "Delete budget")}
        description={t(
          `Hạn mức ${categoryName} của ${periodName.toLowerCase()} sẽ bị xoá. Các khoản chi đã ghi vẫn giữ nguyên, chỉ không còn được so với hạn mức nào.`,
          `The ${categoryName} limit for ${periodName} will be removed. Recorded expenses stay exactly as they are; they are just no longer measured against a limit.`,
        )}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        open={confirmDelete}
        title={t(`Xoá ngân sách ${categoryName}?`, `Delete the ${categoryName} budget?`)}
      />
    </>
  );
};

/* -------------------------------------------------------------------- Page */

interface LoadedMonth {
  key: string;
  summary: BudgetSummary | null;
  /** Last month's budgets, fetched only when this month has none. */
  previous: BudgetItem[];
  failed?: boolean;
}

const BudgetsPage: React.FC = () => {
  const t = useT();
  const { isVietnamese, timezoneOffsetMinutes } = useLocale();
  const { toast } = useToast();
  const { dataVersion, notifyDataChanged } = useLedger();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useIsDesktop();

  const today = currentMonth(timezoneOffsetMinutes);
  const [period, setPeriod] = useState<Period>(today);
  const { month, year } = period;
  const periodKey = `${year}-${month}`;

  const [loaded, setLoaded] = useState<LoadedMonth | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [session, setSession] = useState<FormSession | null>(null);
  const [copying, setCopying] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const token = await getIdToken();
        const [summaryResult, walletResult] = await Promise.allSettled([
          budgetApi.getBudgetSummary({ month, year }, token),
          walletApi.getWallets(token),
        ]);
        if (!active) {
          return;
        }
        if (walletResult.status === "fulfilled") {
          setWallets(walletResult.value?.wallets || []);
        }
        if (summaryResult.status === "rejected") {
          throw summaryResult.reason;
        }

        const summary: BudgetSummary = summaryResult.value;
        let previous: BudgetItem[] = [];
        // An empty month is where "copy last month" earns its place, so the
        // previous month is only asked for then.
        if (!summary?.items?.length) {
          const before = shiftMonth({ month, year }, -1);
          const previousSummary: BudgetSummary | null = await budgetApi
            .getBudgetSummary(before, token)
            .catch(() => null);
          previous = previousSummary?.items || [];
        }
        if (active) {
          setLoaded({ key: `${year}-${month}`, summary, previous });
        }
      } catch (error: any) {
        if (active) {
          setLoaded({ key: `${year}-${month}`, summary: null, previous: [], failed: true });
          toast({
            title: t("Không tải được ngân sách", "Could not load budgets"),
            description: error?.message,
            variant: "destructive",
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [dataVersion, month, retry, t, toast, year]);

  const openCreate = () => {
    const taken = new Set(
      (loaded?.key === periodKey ? loaded.summary?.items || [] : []).map(
        (budget) => getCategoryMeta(budget.category).key,
      ),
    );
    setSession({
      editing: null,
      period: { month, year },
      // Start on the first group that has no budget yet, so the most common
      // next step is not a duplicate.
      category: (EXPENSE_CATEGORIES.find((item) => !taken.has(item.key)) || EXPENSE_CATEGORIES[0]).key,
    });
  };

  const openEdit = (budget: BudgetItem) =>
    setSession({ editing: budget, period: { month: budget.month, year: budget.year }, category: budget.category });

  const ready = loaded?.key === periodKey;

  // `/budgets?create=1` from the dashboard and elsewhere. It waits for the
  // month to load so the form can start on a group that is still free.
  const wantsCreate = searchParams.get("create") === "1";
  useEffect(() => {
    if (wantsCreate && ready) {
      openCreate();
      setSearchParams({}, { replace: true });
    }
    // Only the query parameter (once data is in) should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsCreate, ready, setSearchParams]);
  const summary = ready ? loaded?.summary || null : null;
  const previous = ready ? loaded?.previous || [] : [];

  // A fixed order, by group: rows do not jump around after an edit.
  const items = useMemo(
    () =>
      [...(summary?.items || [])].sort(
        (left, right) =>
          categoryRank(left.category) - categoryRank(right.category) ||
          walletScopeOf(left).localeCompare(walletScopeOf(right)),
      ),
    [summary],
  );

  const totalBudget = toAmount(summary?.totalBudget);
  const totalSpent = toAmount(summary?.totalSpent);
  const totalRemaining =
    summary?.totalRemaining !== undefined ? toAmount(summary.totalRemaining) : totalBudget - totalSpent;
  const totalOverspent = items.reduce((sum, budget) => sum + overspendOf(budget), 0);
  const usedPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const relation = comparePeriods(period, today);
  const hasPinned = items.some((budget) => walletScopeOf(budget));
  const periodName = monthLabel(month, year, isVietnamese);
  const previousPeriod = shiftMonth(period, -1);

  const copyPrevious = async () => {
    if (copying || !previous.length) {
      return;
    }

    setCopying(true);
    let created = 0;
    const failures: string[] = [];
    try {
      const token = await getIdToken();
      // One at a time: each create is checked for duplicates on its own, and
      // a failure part-way can be reported for exactly what it was.
      for (const budget of previous) {
        try {
          await budgetApi.createBudget(
            {
              category: budget.category,
              amount: toAmount(budget.amount),
              walletId: walletScopeOf(budget) || null,
              color: budget.color || undefined,
              note: budget.note || undefined,
              month,
              year,
            },
            token,
          );
          created += 1;
        } catch (error: any) {
          failures.push(error?.message || "");
        }
      }
    } catch (error: any) {
      failures.push(error?.message || "");
    } finally {
      setCopying(false);
    }

    const target = periodName.toLowerCase();
    if (created > 0) {
      toast({
        title: t(`Đã chép ${created} ngân sách sang ${target}`, `Copied ${created} budgets to ${periodName}`),
        description: failures.length
          ? t(
              `${failures.length} ngân sách không chép được. ${failures[0]}`,
              `${failures.length} could not be copied. ${failures[0]}`,
            )
          : undefined,
        variant: "success",
      });
      notifyDataChanged();
    } else {
      toast({
        title: t("Chưa chép được ngân sách nào", "No budgets were copied"),
        description: failures[0] || undefined,
        variant: "destructive",
      });
    }
  };

  const periodNote =
    relation === 0
      ? t(
          `Còn ${daysLeftInMonth(timezoneOffsetMinutes)} ngày trong tháng`,
          `${daysLeftInMonth(timezoneOffsetMinutes)} days left this month`,
        )
      : relation > 0
        ? t("Tháng này chưa bắt đầu", "This month has not started")
        : t("Tháng đã kết thúc", "This month is over");

  const createButton = (
    <Button icon={Plus} onClick={openCreate}>
      {t("Tạo ngân sách", "New budget")}
    </Button>
  );

  let body: React.ReactNode;
  if (!ready) {
    body = (
      <div className="py-6">
        <SkeletonRows rows={4} />
      </div>
    );
  } else if (loaded?.failed) {
    body = (
      <EmptyState
        action={
          <Button onClick={() => setRetry((value) => value + 1)} variant="outline">
            {t("Thử lại", "Try again")}
          </Button>
        }
        description={t(
          "Có thể mạng đang chập chờn. Dữ liệu của bạn vẫn an toàn.",
          "The connection may be unstable. Your data is safe.",
        )}
        icon={ChartPie}
        title={t("Không tải được ngân sách", "Budgets could not be loaded")}
      />
    );
  } else if (!items.length) {
    const previousTotal = previous.reduce((sum, budget) => sum + toAmount(budget.amount), 0);
    body = (
      <EmptyState
        action={
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-2">
              {createButton}
              {previous.length ? (
                <Button disabled={copying} icon={Copy} onClick={() => void copyPrevious()} variant="outline">
                  {copying ? t("Đang chép...", "Copying...") : t("Chép từ tháng trước", "Copy last month")}
                </Button>
              ) : null}
            </div>
            {previous.length ? (
              <p className="ledger-num text-[12.5px] text-ledger-muted">
                {t(
                  `${monthLabel(previousPeriod.month, previousPeriod.year, true)} có ${previous.length} ngân sách, tổng ${formatMoney(previousTotal)}`,
                  `${monthLabel(previousPeriod.month, previousPeriod.year, false)} had ${previous.length} budgets, ${formatMoney(previousTotal)} in total`,
                )}
              </p>
            ) : null}
          </div>
        }
        description={t(
          "Ngân sách chỉ để theo dõi: bạn đặt hạn mức cho từng nhóm và thấy mình đã chi bao nhiêu. Nó không bao giờ chặn một khoản chi, vượt hạn mức thì khoản đó vẫn được ghi nhận.",
          "A budget only tracks: you set a limit per group and see how much has gone out. It never stops a payment; going over still records it.",
        )}
        icon={ChartPie}
        title={t(`Chưa có ngân sách cho ${periodName.toLowerCase()}`, `No budgets for ${periodName} yet`)}
      />
    );
  } else {
    body = (
      <>
        <HeroStrip
          label={t("Đã chi trong tháng", "Spent this month")}
          stats={[
            {
              label: t("Còn lại", "Left"),
              value:
                totalRemaining < 0 ? (
                  <span className="ledger-num text-ledger-out">
                    {t(`Vượt ${formatMoney(-totalRemaining)}`, `${formatMoney(-totalRemaining)} over`)}
                  </span>
                ) : (
                  <Money amount={totalRemaining} />
                ),
            },
            {
              // Three columns share a 390px screen; the long label would be
              // cut to "VƯỢT HẠN M…" there.
              label: isDesktop ? t("Vượt hạn mức", "Over limit") : t("Vượt mức", "Over"),
              value: <Money amount={totalOverspent} tone={totalOverspent > 0 ? "out" : "muted"} />,
            },
            {
              label: t("Số nhóm", "Groups"),
              value: <span className="ledger-num text-ledger-ink">{items.length}</span>,
            },
          ]}
          value={
            <>
              <Money amount={totalSpent} tone={totalSpent > totalBudget ? "out" : "neutral"} />
              <span className="ledger-num mt-2 block text-[17px] font-medium tracking-[-0.01em] text-ledger-muted sm:ml-3 sm:mt-0 sm:inline sm:text-[22px]">
                / {formatMoney(totalBudget)}
              </span>
            </>
          }
        >
          <div className="mt-5 w-full lg:min-w-[340px]">
            <Track percent={usedPercent} />
            <div className="mt-2 flex items-center justify-between gap-3 text-[12.5px] text-ledger-muted">
              <span className={cn("ledger-num", usedPercent > 100 && "text-ledger-out")}>
                {t(
                  `Đã dùng ${Math.round(usedPercent)}% tổng hạn mức`,
                  `${Math.round(usedPercent)}% of the total limit used`,
                )}
              </span>
              <span className="text-right">{periodNote}</span>
            </div>
          </div>
        </HeroStrip>

        <div className="border-b border-ledger-line py-2">
          {items.map((budget) => {
            const name = isVietnamese
              ? getCategoryMeta(budget.category).vi
              : getCategoryMeta(budget.category).en;
            return (
              <BudgetTrackRow
                budget={budget}
                footnote={
                  overspendOf(budget) > 0 ? (
                    <Notice
                      action={
                        <TextLink to={`/transactions?category=${encodeURIComponent(budget.category)}`}>
                          <span className="inline-flex items-center gap-1">
                            {t("Xem giao dịch", "See transactions")}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </TextLink>
                      }
                      className="mt-3"
                      icon={TriangleAlert}
                      tone="rose"
                    >
                      {t(
                        "Bạn đã tiêu quá hạn mức nhóm này. Các khoản vẫn được ghi nhận bình thường.",
                        "You have spent past this group's limit. Every entry is still recorded as usual.",
                      )}
                    </Notice>
                  ) : null
                }
                key={budget._id}
                trailing={
                  <button
                    aria-label={t(`Sửa ngân sách ${name}`, `Edit the ${name} budget`)}
                    className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ledger-muted transition-colors hover:bg-ledger-canvas hover:text-ledger-ink"
                    onClick={() => openEdit(budget)}
                    type="button"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                }
              />
            );
          })}
        </div>

        <p className="flex items-start gap-2 py-5 text-[13px] leading-relaxed text-ledger-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {hasPinned
              ? t(
                  "Mọi khoản chi thuộc nhóm đều được tính vào ngân sách, bất kể bạn trả bằng ví nào, trừ ngân sách đã gắn với một ví cụ thể.",
                  "Every expense in a group counts towards its budget, whichever wallet paid, except for budgets tied to one wallet.",
                )
              : t(
                  "Mọi khoản chi thuộc nhóm đều được tính vào ngân sách, bất kể bạn trả bằng ví nào.",
                  "Every expense in a group counts towards its budget, whichever wallet paid.",
                )}
          </span>
        </p>

        {/* On a phone the header keeps only the month; creating sits after
            the list, where the thumb already is once it has been read. */}
        <div className="pb-4 lg:hidden">
          <Button block icon={Plus} onClick={openCreate} size="lg" variant="outline">
            {t("Tạo ngân sách", "New budget")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <div>
      <PageHeader
        actions={
          <>
            {relation !== 0 ? (
              <TextLink className="order-last sm:order-none" onClick={() => setPeriod(today)}>
                {t("Về tháng này", "Back to this month")}
              </TextLink>
            ) : null}
            <MonthStepper className="w-full sm:w-auto" onChange={setPeriod} period={period} />
            <div className="hidden lg:block">{createButton}</div>
          </>
        }
        subtitle={t(
          "Hạn mức bạn tự đặt cho từng nhóm chi tiêu",
          "Limits you set yourself for each spending group",
        )}
        title={t("Ngân sách", "Budgets")}
      />

      {body}

      <BudgetFormPanel
        onClose={() => setSession(null)}
        onEditExisting={openEdit}
        session={session}
        wallets={wallets}
      />
    </div>
  );
};

export default BudgetsPage;
