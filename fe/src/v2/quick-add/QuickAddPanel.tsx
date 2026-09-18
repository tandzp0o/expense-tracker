import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  ChartPie,
  Check,
  Info,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { budgetApi, transactionApi, walletApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useQuests } from "contexts/QuestContext";
import { useToast } from "contexts/ToastContext";
import { cn } from "lib/utils";
import {
  Button,
  CategoryIcon,
  Chip,
  EmptyState,
  Eyebrow,
  FieldLabel,
  IconBadge,
  Notice,
  TextInput,
} from "../components/primitives";
import { WalletIcon } from "../components/finance";
import { Keypad, Panel } from "../components/overlays";
import { useIsDesktop } from "../hooks/useIsDesktop";
import {
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_INCOME_CATEGORY,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  getCategoryMeta,
} from "../lib/categories";
import {
  calendarDay,
  dayGroupLabel,
  formatAmountInput,
  formatMoney,
  middayIso,
  monthLabel,
  monthOfDay,
  parseAmountInput,
  todayKey,
} from "../lib/format";
import { useT } from "../lib/i18n";
import { extractWarnings, getIdToken } from "../lib/session";
import {
  toAmount,
  walletIdOf,
  type BudgetItem,
  type Wallet,
} from "../lib/types";
import type { QuickAddMode, QuickAddOptions } from "../LedgerContext";

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

// The three kinds of entry, each in the colour its amounts use everywhere
// else: money out is rose, money in is green, a move between wallets is
// neither.
const MODES: Array<{
  value: QuickAddMode;
  vi: string;
  en: string;
  icon: LucideIcon;
  tone: "out" | "in" | "accent";
}> = [
  { value: "EXPENSE", vi: "Chi", en: "Expense", icon: ArrowUpRight, tone: "out" },
  { value: "INCOME", vi: "Thu", en: "Income", icon: ArrowDownLeft, tone: "in" },
  { value: "TRANSFER", vi: "Chuyển ví", en: "Transfer", icon: ArrowLeftRight, tone: "accent" },
];

const MODE_TONE = {
  out: "text-ledger-out",
  in: "text-ledger-in",
  accent: "text-ledger-accent",
} as const;

/**
 * "Ghi nhanh" — the one form for recording money in, money out, and moving it
 * between wallets. It never blocks a save for being over a budget or taking a
 * wallet below zero: it says so in plain words while the user types, then lets
 * them record what actually happened.
 */
export const QuickAddPanel: React.FC<{
  options: QuickAddOptions | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ options, onClose, onSaved }) => {
  const open = options !== null;
  const t = useT();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { isVietnamese, timezoneOffsetMinutes } = useLocale();
  const { toast } = useToast();
  const { refresh: refreshQuests } = useQuests();
  const amountRef = useRef<HTMLInputElement>(null);

  const editing = options?.editing;
  const [mode, setMode] = useState<QuickAddMode>("EXPENSE");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState(DEFAULT_EXPENSE_CATEGORY);
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [dayKey, setDayKey] = useState(() => todayKey(timezoneOffsetMinutes));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);

  const today = todayKey(timezoneOffsetMinutes);
  const { month, year } = monthOfDay(dayKey || today);

  // Reset the form from whatever opened it.
  useEffect(() => {
    if (!options) {
      return;
    }

    const source = options.editing;
    const nextMode: QuickAddMode = source
      ? source.type === "INCOME"
        ? "INCOME"
        : "EXPENSE"
      : options.mode || "EXPENSE";

    setMode(nextMode);
    setAmount(source ? toAmount(source.amount) : options.amount || 0);
    setCategory(
      source?.category ||
        options.category ||
        (nextMode === "INCOME" ? DEFAULT_INCOME_CATEGORY : DEFAULT_EXPENSE_CATEGORY),
    );
    setWalletId(source ? walletIdOf(source) : options.walletId || "");
    setToWalletId(options.toWalletId || "");
    setDayKey(
      source ? calendarDay(source.date, timezoneOffsetMinutes) : todayKey(timezoneOffsetMinutes),
    );
    setNote(source?.note || options.note || "");
  }, [options, timezoneOffsetMinutes]);

  // Wallets, once per opening.
  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setWalletsLoading(true);

    (async () => {
      try {
        const response = await walletApi.getWallets(await getIdToken());
        if (!active) {
          return;
        }
        const list: Wallet[] = response?.wallets || [];
        setWallets(list);
        setWalletId((current) => current || list[0]?._id || "");
        setToWalletId(
          (current) => current || list.find((wallet) => wallet._id !== list[0]?._id)?._id || "",
        );
      } catch (error: any) {
        if (active) {
          toast({
            title: t("Không tải được danh sách ví", "Could not load wallets"),
            description: error.message,
            variant: "destructive",
          });
        }
      } finally {
        if (active) {
          setWalletsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [open, t, toast]);

  // Budgets of the month the entry falls in, for the live budget notice.
  useEffect(() => {
    if (!open || mode !== "EXPENSE") {
      return;
    }

    let active = true;
    (async () => {
      try {
        const summary = await budgetApi.getBudgetSummary(
          { month, year },
          await getIdToken(),
        );
        if (active) {
          setBudgets(summary?.items || []);
        }
      } catch {
        // The notice is a courtesy; without budgets the form still saves.
        if (active) {
          setBudgets([]);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [open, mode, month, year]);

  useEffect(() => {
    if (open && isDesktop) {
      window.setTimeout(() => amountRef.current?.focus(), 60);
    }
  }, [open, isDesktop, mode]);

  const selectedWallet = wallets.find((wallet) => wallet._id === walletId);
  const originalAmount = editing ? toAmount(editing.amount) : 0;
  const originalWalletId = editing ? walletIdOf(editing) : "";
  const isFuture = dayKey > today;

  // What the wallet will hold afterwards. When editing, the old amount is
  // already inside the balance, so it is added back before taking the new one.
  const walletAfter = useMemo(() => {
    if (!selectedWallet || mode === "INCOME" || isFuture) {
      return null;
    }
    const restored =
      editing && originalWalletId === selectedWallet._id && editing.type === "EXPENSE"
        ? originalAmount
        : 0;
    return toAmount(selectedWallet.balance) + restored - amount;
  }, [amount, editing, isFuture, mode, originalAmount, originalWalletId, selectedWallet]);

  // The budget this expense will count against: same category, and either
  // pinned to this wallet or open to every wallet. Pinned wins, mirroring the
  // server's own choice.
  const matchedBudget = useMemo(() => {
    if (mode !== "EXPENSE") {
      return null;
    }
    const candidates = budgets.filter(
      (budget) =>
        budget.category === category &&
        (!budget.walletId || String(budget.walletId) === walletId),
    );
    return candidates.find((budget) => budget.walletId) || candidates[0] || null;
  }, [budgets, category, mode, walletId]);

  const budgetOverspend = useMemo(() => {
    if (!matchedBudget || isFuture || amount <= 0) {
      return 0;
    }
    const alreadyCounted =
      editing && editing.type === "EXPENSE" && editing.category === matchedBudget.category
        ? originalAmount
        : 0;
    const spentAfter = toAmount(matchedBudget.spent) - alreadyCounted + amount;
    return spentAfter - toAmount(matchedBudget.amount);
  }, [amount, editing, isFuture, matchedBudget, originalAmount]);

  const categories = mode === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const destinationWallets = wallets.filter((wallet) => wallet._id !== walletId);
  const canSave =
    amount > 0 &&
    Boolean(walletId) &&
    (mode !== "TRANSFER" || (Boolean(toWalletId) && toWalletId !== walletId));

  const changeMode = (next: QuickAddMode) => {
    setMode(next);
    if (next === "INCOME" && !INCOME_CATEGORIES.some((item) => item.key === category)) {
      setCategory(DEFAULT_INCOME_CATEGORY);
    }
    if (next === "EXPENSE" && !EXPENSE_CATEGORIES.some((item) => item.key === category)) {
      setCategory(DEFAULT_EXPENSE_CATEGORY);
    }
  };

  const goReconcile = () => {
    onClose();
    navigate(`/wallets?reconcile=${walletId}`);
  };

  const save = async (addAnother: boolean) => {
    if (!canSave || saving) {
      return;
    }

    setSaving(true);
    try {
      const token = await getIdToken();
      let response: unknown;

      if (mode === "TRANSFER") {
        response = await transactionApi.createTransfer(
          {
            fromWalletId: walletId,
            toWalletId,
            amount,
            date: middayIso(dayKey, timezoneOffsetMinutes),
            sourceNote: note || undefined,
            destinationNote: note || undefined,
            timezoneOffset: timezoneOffsetMinutes,
          },
          token,
        );
      } else {
        const payload = {
          type: mode,
          // A future date is a plan; the server would reschedule it anyway,
          // saying so here keeps the form and the result consistent.
          // FAILED and CANCELLED are reserved for the server, so an edit only
          // ever keeps PENDING and otherwise marks the entry as done.
          status: isFuture
            ? "SCHEDULED"
            : editing?.status === "PENDING"
              ? "PENDING"
              : "COMPLETED",
          amount,
          category,
          walletId,
          note: note.trim(),
          // Cleared on purpose: the server picks the budget from the category,
          // and a stale link would drag an edited category back to the old one.
          budgetId: null,
          date: middayIso(dayKey, timezoneOffsetMinutes),
          timezoneOffset: timezoneOffsetMinutes,
        };

        response = editing
          ? await transactionApi.updateTransaction(editing._id, payload, token)
          : await transactionApi.createTransaction(payload, token);
      }

      toast({
        title: editing
          ? t("Đã lưu thay đổi", "Changes saved")
          : mode === "TRANSFER"
            ? t("Đã chuyển tiền", "Transfer recorded")
            : t("Đã ghi giao dịch", "Transaction recorded"),
        variant: "success",
      });
      extractWarnings(response).forEach((warning) =>
        toast({ title: warning.message, variant: "default" }),
      );

      onSaved();
      void refreshQuests();

      if (addAnother && !editing) {
        setAmount(0);
        setNote("");
        window.setTimeout(() => amountRef.current?.focus(), 30);
      } else {
        onClose();
      }
    } catch (error: any) {
      toast({
        title: t("Chưa lưu được", "Could not save"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const title = editing
    ? t("Sửa giao dịch", "Edit transaction")
    : t("Ghi nhanh", "Quick add");

  const saveLabel = saving
    ? t("Đang lưu...", "Saving...")
    : editing
      ? t("Lưu thay đổi", "Save changes")
      : mode === "TRANSFER"
        ? t("Chuyển tiền", "Transfer")
        : t("Lưu giao dịch", "Save");

  // Built with the live warnings, which sit in the pinned footer right above
  // the save button, so they are in view whatever the form is scrolled to.
  const footerWith = (warnings: React.ReactNode[]) =>
    isDesktop ? (
      <>
        {wallets.length && warnings.length ? (
          <div className="mb-3 flex flex-col gap-2">{warnings}</div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button onClick={onClose} variant="ghost">
            {t("Huỷ", "Cancel")}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {!editing ? (
              <Button
                disabled={!canSave || saving}
                onClick={() => void save(true)}
                variant="outline"
              >
                {t("Lưu và thêm tiếp", "Save and add another")}
              </Button>
            ) : null}
            <Button
              className="min-w-[148px]"
              disabled={!canSave || saving}
              onClick={() => void save(false)}
            >
              {saveLabel}
            </Button>
          </div>
        </div>
      </>
    ) : (
      <>
        {/* The warnings sit right above the keypad on a phone: that is where
            the eye is while typing the amount that causes them, and the form
            above has no room left to show them without scrolling. */}
        {wallets.length && warnings.length ? (
          <div className="mb-3 flex flex-col gap-2">{warnings}</div>
        ) : null}
        {/* On a phone the keypad sits right above the save button, pinned, so
            the thumb never has to scroll between typing the amount and saving. */}
        {wallets.length ? (
          <div className="mb-3">
            <Keypad
              onBackspace={() => setAmount((current) => Math.floor(current / 10))}
              onDigits={(digits) =>
                setAmount((current) =>
                  parseAmountInput(`${current > 0 ? current : ""}${digits}`),
                )
              }
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          {/* The secondary save is a quiet text link, so the keypad keeps the
              room and the thumb lands on the main button. */}
          {!editing ? (
            <button
              className="h-8 text-[13.5px] font-medium text-ledger-accent disabled:opacity-40"
              disabled={!canSave || saving}
              onClick={() => void save(true)}
              type="button"
            >
              {t("Lưu và thêm khoản nữa", "Save and add another")}
            </button>
          ) : null}
          <Button block disabled={!canSave || saving} onClick={() => void save(false)} size="lg">
            {saveLabel}
          </Button>
        </div>
      </>
    );

  const walletLabel =
    mode === "TRANSFER"
      ? t("Từ ví", "From")
      : mode === "INCOME"
        ? t("Vào ví", "Into")
        : t("Trả bằng ví", "Paid from");

  // Desktop: every wallet as a tile with its balance, so nothing hides past
  // the drawer's edge. Phone: one row of chips that scrolls, to leave the
  // height to the keypad.
  const walletPicker = (
    selectedId: string,
    onSelect: (id: string) => void,
    list: Wallet[],
  ) =>
    isDesktop ? (
      <div className="grid grid-cols-2 gap-2">
        {list.map((wallet) => {
          const selected = wallet._id === selectedId;
          const balance = toAmount(wallet.balance);
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors",
                selected
                  ? "border-ledger-accent bg-ledger-accent-wash ring-1 ring-ledger-accent"
                  : "border-ledger-line bg-ledger-paper hover:border-ledger-line-strong hover:bg-ledger-hover",
              )}
              key={wallet._id}
              onClick={() => onSelect(wallet._id)}
              title={wallet.name}
              type="button"
            >
              <WalletIcon size={34} wallet={wallet} />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[14px] font-medium",
                    selected ? "text-ledger-accent" : "text-ledger-ink",
                  )}
                >
                  {wallet.name}
                </span>
                <span
                  className={cn(
                    "ledger-num block truncate text-[12.5px]",
                    balance < 0 ? "text-ledger-out" : "text-ledger-muted",
                  )}
                >
                  {formatMoney(balance, wallet.currency)}
                </span>
              </span>
              {selected ? <Check className="h-4 w-4 shrink-0 text-ledger-accent" /> : null}
            </button>
          );
        })}
      </div>
    ) : (
      <div className="ledger-scroll-x -mx-5 flex gap-2 px-5 pb-0.5">
        {list.map((wallet) => (
          <Chip
            key={wallet._id}
            onClick={() => onSelect(wallet._id)}
            selected={wallet._id === selectedId}
          >
            {wallet.name}
            <span
              className={cn(
                "ledger-num font-normal",
                toAmount(wallet.balance) < 0 ? "text-ledger-out" : "opacity-70",
              )}
            >
              · {formatMoney(toAmount(wallet.balance), wallet.currency)}
            </span>
          </Chip>
        ))}
      </div>
    );

  const categoryLabelOf = (key: string) =>
    isVietnamese ? getCategoryMeta(key).vi : getCategoryMeta(key).en;

  // What this entry will do, in one line under the phone's amount, since the
  // chips that chose it may have scrolled out of sight.
  // An edit keeps its kind, so the phone names it here instead of spending a
  // row on it.
  const recap =
    mode === "TRANSFER"
      ? [selectedWallet?.name, wallets.find((wallet) => wallet._id === toWalletId)?.name]
          .filter(Boolean)
          .join(" → ")
      : [
          editing ? (mode === "INCOME" ? t("Khoản thu", "Income") : t("Khoản chi", "Expense")) : "",
          categoryLabelOf(category),
          selectedWallet?.name,
        ]
          .filter(Boolean)
          .join(" · ");

  /* ---------------------------------------------------------- Sections */

  const modeSection = editing ? (
    // An edit keeps its kind; say which one instead of offering a switch.
    // (A phone says it in the line under the amount.)
    isDesktop ? (
      <div className="flex items-center gap-3 rounded-[14px] bg-ledger-canvas px-3.5 py-2.5">
        <IconBadge
          icon={mode === "INCOME" ? ArrowDownLeft : ArrowUpRight}
          tone={mode === "INCOME" ? "in" : "out"}
        />
        <p className="text-[13.5px] text-ledger-ink-2">
          {mode === "INCOME"
            ? t("Đang sửa một khoản thu", "Editing an income")
            : t("Đang sửa một khoản chi", "Editing an expense")}
        </p>
      </div>
    ) : null
  ) : (
    <div className="grid grid-cols-3 gap-1 rounded-[14px] bg-ledger-canvas p-1" role="tablist">
      {MODES.map((option) => {
        const Icon = option.icon;
        const selected = option.value === mode;
        return (
          <button
            aria-selected={selected}
            className={cn(
              "flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[14px] font-semibold transition-colors",
              selected
                ? cn("bg-ledger-paper shadow-sm", MODE_TONE[option.tone])
                : "text-ledger-ink-2 hover:text-ledger-ink",
            )}
            key={option.value}
            onClick={() => changeMode(option.value)}
            role="tab"
            type="button"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{isVietnamese ? option.vi : option.en}</span>
          </button>
        );
      })}
    </div>
  );

  const amountLabel =
    mode === "TRANSFER"
      ? t("Số tiền chuyển", "Amount to move")
      : mode === "INCOME"
        ? t("Số tiền thu", "Amount received")
        : t("Số tiền chi", "Amount spent");

  const amountSection = isDesktop ? (
    // Amount: the thing the user came to type, so it is the biggest thing
    // here, on a sunken field of its own with the shortcuts under it.
    <div className="rounded-[16px] border border-ledger-line bg-ledger-canvas px-4 pb-4 pt-3.5 transition-colors focus-within:border-ledger-accent">
      <label className="block" htmlFor="quick-add-amount">
        <Eyebrow>{amountLabel}</Eyebrow>
      </label>
      <div className="mt-1 flex items-baseline gap-2">
        <input
          className="ledger-num w-full min-w-0 bg-transparent text-right text-[44px] font-semibold leading-tight tracking-[-0.03em] text-ledger-ink outline-none placeholder:text-ledger-line-strong"
          id="quick-add-amount"
          inputMode="numeric"
          onChange={(event) => setAmount(parseAmountInput(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void save(false);
            }
          }}
          placeholder="0"
          ref={amountRef}
          value={formatAmountInput(amount)}
        />
        <span className="text-[24px] font-semibold text-ledger-muted">₫</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {QUICK_AMOUNTS.map((step) => (
          <button
            className="ledger-num h-9 rounded-[10px] border border-ledger-line bg-ledger-paper text-[13px] font-medium text-ledger-ink-2 transition-colors hover:border-ledger-line-strong hover:text-ledger-ink"
            key={step}
            onClick={() => setAmount((current) => current + step)}
            type="button"
          >
            +{formatAmountInput(step)}
          </button>
        ))}
      </div>
    </div>
  ) : (
    <div className="py-1 text-center">
      <p className="sr-only">{amountLabel}</p>
      <div
        className={cn(
          "ledger-num text-[44px] font-semibold leading-tight tracking-[-0.03em]",
          amount > 0 ? "text-ledger-ink" : "text-ledger-line-strong",
        )}
      >
        {amount > 0 ? formatAmountInput(amount) : "0"}
        <span className="ml-1.5 text-[24px] text-ledger-muted">₫</span>
      </div>
      {recap ? <p className="mt-0.5 truncate text-[13px] text-ledger-ink-2">{recap}</p> : null}
    </div>
  );

  const categorySection =
    mode !== "TRANSFER" ? (
      <div>
        <FieldLabel>{t("Danh mục", "Category")}</FieldLabel>
        {isDesktop ? (
          <div className="grid grid-cols-4 gap-2">
            {categories.map((item) => {
              const selected = item.key === category;
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    "flex min-w-0 flex-col items-center gap-1.5 rounded-[12px] border px-1.5 pb-2 pt-2.5 text-[12.5px] font-medium transition-colors",
                    selected
                      ? "border-ledger-accent bg-ledger-accent-wash text-ledger-accent ring-1 ring-ledger-accent"
                      : "border-ledger-line bg-ledger-paper text-ledger-ink-2 hover:border-ledger-line-strong hover:bg-ledger-hover hover:text-ledger-ink",
                  )}
                  key={item.key}
                  onClick={() => setCategory(item.key)}
                  type="button"
                >
                  <CategoryIcon meta={item} size={34} />
                  <span className="max-w-full truncate">{isVietnamese ? item.vi : item.en}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="ledger-scroll-x -mx-5 flex gap-2 px-5 pb-0.5">
            {categories.map((item) => (
              <Chip
                icon={item.icon}
                key={item.key}
                onClick={() => setCategory(item.key)}
                selected={item.key === category}
              >
                {isVietnamese ? item.vi : item.en}
              </Chip>
            ))}
          </div>
        )}
      </div>
    ) : null;

  const walletSection = (
    <>
      <div>
        <FieldLabel>{walletLabel}</FieldLabel>
        {walletPicker(walletId, setWalletId, wallets)}
      </div>
      {mode === "TRANSFER" ? (
        <div>
          <FieldLabel>{t("Đến ví", "To")}</FieldLabel>
          {destinationWallets.length ? (
            walletPicker(toWalletId, setToWalletId, destinationWallets)
          ) : (
            <Notice icon={Info} tone="muted">
              {t(
                "Cần ít nhất hai ví để chuyển tiền qua lại.",
                "You need at least two wallets to move money between them.",
              )}
            </Notice>
          )}
        </div>
      ) : null}
    </>
  );

  const detailsSection = isDesktop ? (
    <div className="grid grid-cols-[168px_1fr] gap-3">
      <div>
        <FieldLabel htmlFor="quick-add-date">{t("Ngày", "Date")}</FieldLabel>
        <TextInput
          className="dark:[color-scheme:dark]"
          id="quick-add-date"
          // Transfers are recorded as done straight away, so they stay
          // on today or earlier.
          max={mode === "TRANSFER" ? today : undefined}
          onChange={(event) => setDayKey(event.target.value || today)}
          type="date"
          value={dayKey}
        />
      </div>
      <div className="min-w-0">
        <FieldLabel hint={t("Không bắt buộc", "Optional")} htmlFor="quick-add-note">
          {t("Ghi chú", "Note")}
        </FieldLabel>
        <TextInput
          id="quick-add-note"
          maxLength={200}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            mode === "TRANSFER"
              ? t("Ví dụ: rút tiền mặt", "e.g. cash withdrawal")
              : t("Ví dụ: cà phê với khách", "e.g. coffee with a client")
          }
          value={note}
        />
      </div>
    </div>
  ) : (
    // One compact row on a phone. The native date picker sits invisibly over
    // the chip, so tapping it still opens the OS calendar.
    <div className="flex items-center gap-2">
      <label className="relative flex h-11 shrink-0 items-center gap-2 rounded-[10px] border border-ledger-line-strong bg-ledger-paper px-3 text-[13.5px] font-medium text-ledger-ink">
        <CalendarDays className="h-4 w-4 text-ledger-muted" />
        <span className="ledger-num">
          {dayGroupLabel(dayKey, timezoneOffsetMinutes, isVietnamese)}
        </span>
        <input
          aria-label={t("Ngày", "Date")}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          max={mode === "TRANSFER" ? today : undefined}
          onChange={(event) => setDayKey(event.target.value || today)}
          type="date"
          value={dayKey}
        />
      </label>
      <TextInput
        aria-label={t("Ghi chú", "Note")}
        className="min-w-0 flex-1 border-ledger-line-strong"
        maxLength={200}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("Thêm ghi chú", "Add a note")}
        value={note}
      />
    </div>
  );

  // Live consequences. None of these stop the save.
  const futureNotice = isFuture ? (
    <Notice icon={CalendarDays} key="future" tone="blue">
      {t(
        "Ngày này ở tương lai nên khoản sẽ được lưu ở trạng thái Đã lên lịch và chưa trừ vào số dư.",
        "This date is in the future, so it is saved as Scheduled and does not touch balances yet.",
      )}
    </Notice>
  ) : null;
  const [walletNotice, budgetNotice] = [
    walletAfter !== null && walletAfter < 0 && amount > 0 ? (
      <Notice
        action={
          <button
            className="text-[13px] font-semibold text-ledger-accent hover:underline"
            onClick={goReconcile}
            type="button"
          >
            {t("Cân đối ví", "Reconcile")}
          </button>
        }
        icon={Info}
        key="wallet"
        tone="amber"
      >
        {t(
          `Ví ${selectedWallet?.name} sẽ âm ${formatMoney(Math.abs(walletAfter))} sau khoản này.`,
          `${selectedWallet?.name} will be ${formatMoney(Math.abs(walletAfter))} below zero after this.`,
        )}
      </Notice>
    ) : null,
    mode === "EXPENSE" && matchedBudget ? (
      budgetOverspend > 0 ? (
        <Notice
          detail={t("Vẫn lưu bình thường.", "It still saves as usual.")}
          icon={TriangleAlert}
          key="budget"
          tone="rose"
        >
          {t(
            `Ngân sách ${getCategoryMeta(matchedBudget.category).vi} sẽ vượt ${formatMoney(budgetOverspend)}.`,
            `The ${getCategoryMeta(matchedBudget.category).en} budget will be ${formatMoney(budgetOverspend)} over.`,
          )}
        </Notice>
      ) : (
        <Notice icon={ChartPie} key="budget" tone="muted">
          {t(
            `Tính vào ngân sách ${getCategoryMeta(matchedBudget.category).vi} · ${monthLabel(month, year, true).toLowerCase()} · còn ${formatMoney(Math.max(toAmount(matchedBudget.amount) - toAmount(matchedBudget.spent) - amount, 0))}`,
            `Counts towards the ${getCategoryMeta(matchedBudget.category).en} budget · ${monthLabel(month, year, false)}`,
          )}
        </Notice>
      )
    ) : null,
  ];
  const budgetWarns = mode === "EXPENSE" && Boolean(matchedBudget) && budgetOverspend > 0;
  // The warnings the amount causes go in the pinned footer, above the save
  // button (and on a phone the keypad); what only informs (a scheduled date,
  // which budget it counts towards) stays in the form, under the date.
  const footerWarnings = [walletNotice, budgetWarns ? budgetNotice : null].filter(Boolean);
  const formInfos = [futureNotice, budgetWarns ? null : budgetNotice].filter(Boolean);

  return (
    <Panel
      footer={footerWith(footerWarnings)}
      onClose={onClose}
      open={open}
      tall={!isDesktop}
      title={title}
    >
      {walletsLoading && !wallets.length ? (
        <div className="py-16 text-center text-[13px] text-ledger-muted">
          {t("Đang tải ví...", "Loading wallets...")}
        </div>
      ) : !wallets.length ? (
        <EmptyState
          action={
            <Button
              onClick={() => {
                onClose();
                navigate("/wallets");
              }}
            >
              {t("Tạo ví đầu tiên", "Create your first wallet")}
            </Button>
          }
          description={t(
            "Mỗi khoản thu chi cần biết tiền đi ra hoặc vào ví nào.",
            "Every entry needs a wallet the money moved through.",
          )}
          icon={WalletCards}
          title={t("Bạn chưa có ví nào", "You have no wallets yet")}
        />
      ) : (
        <div className={cn("flex flex-col", isDesktop ? "gap-5" : "gap-4")}>
          {modeSection}
          {amountSection}
          {categorySection}
          {walletSection}
          {detailsSection}
          {formInfos.length ? <div className="flex flex-col gap-2">{formInfos}</div> : null}
        </div>
      )}
    </Panel>
  );
};

