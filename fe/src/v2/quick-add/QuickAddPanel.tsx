import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Info, TriangleAlert, WalletCards } from "lucide-react";
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
  FieldLabel,
  Notice,
  Segmented,
  TextInput,
} from "../components/primitives";
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

  const footer = (
    <>
      {/* On a phone the keypad sits right above the save button, pinned, so the
          thumb never has to scroll between typing the amount and saving it. */}
      {!isDesktop && wallets.length ? (
        <div className="-mx-5 -mt-3 mb-3">
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
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
      {isDesktop ? (
        <Button className="sm:mr-auto" onClick={onClose} variant="ghost">
          {t("Huỷ", "Cancel")}
        </Button>
      ) : null}
      {!editing && isDesktop ? (
        <Button
          disabled={!canSave || saving}
          onClick={() => void save(true)}
          variant="outline"
        >
          {t("Lưu và thêm tiếp", "Save and add another")}
        </Button>
      ) : null}
      {/* On a phone the secondary save is a quiet text link, so the keypad
          keeps the room and the thumb lands on the main button. */}
      {!editing && !isDesktop ? (
        <button
          className="order-first h-8 text-[13px] font-medium text-ledger-accent disabled:opacity-40"
          disabled={!canSave || saving}
          onClick={() => void save(true)}
          type="button"
        >
          {t("Lưu và thêm khoản nữa", "Save and add another")}
        </button>
      ) : null}
      <Button
        block={!isDesktop}
        disabled={!canSave || saving}
        onClick={() => void save(false)}
        size={isDesktop ? "md" : "lg"}
      >
        {saving
          ? t("Đang lưu...", "Saving...")
          : editing
            ? t("Lưu thay đổi", "Save changes")
            : mode === "TRANSFER"
              ? t("Chuyển tiền", "Transfer")
              : t("Lưu giao dịch", "Save")}
      </Button>
    </div>
    </>
  );

  const walletChips = (
    selectedId: string,
    onSelect: (id: string) => void,
    list: Wallet[],
  ) => (
    <div className="ledger-scroll-x -mx-1 flex gap-2 px-1 pb-1">
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

  return (
    <Panel footer={footer} onClose={onClose} open={open} tall={!isDesktop} title={title}>
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
        <div className="flex flex-col gap-5">
          {!editing ? (
            <Segmented
              onChange={changeMode}
              options={[
                { value: "EXPENSE", label: t("Chi", "Expense") },
                { value: "INCOME", label: t("Thu", "Income") },
                { value: "TRANSFER", label: t("Chuyển ví", "Transfer") },
              ]}
              value={mode}
            />
          ) : null}

          {/* Amount: the thing the user came to type, so it is the biggest. */}
          <div>
            {isDesktop ? (
              <label className="block border-b-2 border-ledger-line pb-1 focus-within:border-ledger-accent">
                <span className="sr-only">{t("Số tiền", "Amount")}</span>
                <div className="flex items-baseline justify-end gap-2">
                  <input
                    className="ledger-num w-full bg-transparent text-right text-[44px] font-semibold leading-tight tracking-[-0.03em] text-ledger-ink outline-none placeholder:text-ledger-line-strong"
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
                  <span className="text-[26px] font-semibold text-ledger-muted">₫</span>
                </div>
              </label>
            ) : (
              <div className="text-center">
                <div className="ledger-num text-[42px] font-semibold leading-tight tracking-[-0.03em] text-ledger-ink">
                  {amount > 0 ? formatAmountInput(amount) : "0"}
                  <span className="ml-1.5 text-[24px] text-ledger-muted">₫</span>
                </div>
                {mode !== "TRANSFER" ? (
                  <p className="mt-0.5 text-[13px] text-ledger-muted">
                    {[
                      isVietnamese
                        ? getCategoryMeta(category).vi
                        : getCategoryMeta(category).en,
                      selectedWallet?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            )}
            {isDesktop ? (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {QUICK_AMOUNTS.map((step) => (
                  <button
                    className="ledger-num h-8 rounded-[8px] bg-ledger-canvas px-2.5 text-[12.5px] font-medium text-ledger-ink-2 hover:text-ledger-ink"
                    key={step}
                    onClick={() => setAmount((current) => current + step)}
                    type="button"
                  >
                    +{formatAmountInput(step)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {mode !== "TRANSFER" ? (
            <div>
              {isDesktop ? <FieldLabel>{t("Danh mục", "Category")}</FieldLabel> : null}
              {isDesktop ? (
                <div className="grid grid-cols-4 gap-2">
                  {categories.map((item) => (
                    <button
                      aria-pressed={item.key === category}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-[12px] border px-1 py-2.5 text-[12px] font-medium transition-colors",
                        item.key === category
                          ? "border-ledger-accent bg-ledger-accent-wash text-ledger-accent"
                          : "border-ledger-line text-ledger-ink-2 hover:border-ledger-line-strong hover:text-ledger-ink",
                      )}
                      key={item.key}
                      onClick={() => setCategory(item.key)}
                      type="button"
                    >
                      <CategoryIcon meta={item} size={30} />
                      <span className="truncate">{isVietnamese ? item.vi : item.en}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="ledger-scroll-x -mx-1 flex gap-2 px-1 pb-1">
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
          ) : null}

          <div>
            {isDesktop || mode === "TRANSFER" ? (
              <FieldLabel>
                {mode === "TRANSFER"
                  ? t("Từ ví", "From")
                  : mode === "INCOME"
                    ? t("Vào ví", "Into")
                    : t("Trả bằng ví", "Paid from")}
              </FieldLabel>
            ) : null}
            {walletChips(walletId, setWalletId, wallets)}
          </div>

          {mode === "TRANSFER" ? (
            <div>
              <FieldLabel>{t("Đến ví", "To")}</FieldLabel>
              {destinationWallets.length ? (
                walletChips(toWalletId, setToWalletId, destinationWallets)
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

          {/* Live consequences. None of these stop the save. */}
          {walletAfter !== null && walletAfter < 0 && amount > 0 ? (
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
              tone="amber"
            >
              {t(
                `Ví ${selectedWallet?.name} sẽ âm ${formatMoney(Math.abs(walletAfter))} sau khoản này.`,
                `${selectedWallet?.name} will be ${formatMoney(Math.abs(walletAfter))} below zero after this.`,
              )}
            </Notice>
          ) : null}

          {mode === "EXPENSE" && matchedBudget ? (
            budgetOverspend > 0 ? (
              <Notice
                detail={t("Vẫn lưu bình thường.", "It still saves as usual.")}
                icon={TriangleAlert}
                tone="rose"
              >
                {t(
                  `Ngân sách ${getCategoryMeta(matchedBudget.category).vi} sẽ vượt ${formatMoney(budgetOverspend)}.`,
                  `The ${getCategoryMeta(matchedBudget.category).en} budget will be ${formatMoney(budgetOverspend)} over.`,
                )}
              </Notice>
            ) : (
              <Notice tone="muted">
                {t(
                  `Tính vào ngân sách ${getCategoryMeta(matchedBudget.category).vi} · ${monthLabel(month, year, true).toLowerCase()} · còn ${formatMoney(Math.max(toAmount(matchedBudget.amount) - toAmount(matchedBudget.spent) - amount, 0))}`,
                  `Counts towards the ${getCategoryMeta(matchedBudget.category).en} budget · ${monthLabel(month, year, false)}`,
                )}
              </Notice>
            )
          ) : null}

          {isFuture ? (
            <Notice icon={CalendarDays} tone="blue">
              {t(
                "Ngày này ở tương lai nên khoản sẽ được lưu ở trạng thái Đã lên lịch và chưa trừ vào số dư.",
                "This date is in the future, so it is saved as Scheduled and does not touch balances yet.",
              )}
            </Notice>
          ) : null}

          {!isDesktop ? (
            // One compact row on a phone. The native date picker sits invisibly
            // over the chip, so tapping it still opens the OS calendar.
            <div className="flex items-center gap-2">
              <label className="relative flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-ledger-line px-3 text-[13px] text-ledger-ink">
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
                className="h-10 min-w-0 flex-1"
                maxLength={200}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("Thêm ghi chú", "Add a note")}
                value={note}
              />
            </div>
          ) : null}

          <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]", !isDesktop && "hidden")}>
            <div>
              <FieldLabel htmlFor="quick-add-date">{t("Ngày", "Date")}</FieldLabel>
              <TextInput
                id="quick-add-date"
                // Transfers are recorded as done straight away, so they stay
                // on today or earlier.
                max={mode === "TRANSFER" ? today : undefined}
                onChange={(event) => setDayKey(event.target.value || today)}
                type="date"
                value={dayKey}
              />
            </div>
            <div>
              <FieldLabel htmlFor="quick-add-note">
                {t("Ghi chú (không bắt buộc)", "Note (optional)")}
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
        </div>
      )}
    </Panel>
  );
};
