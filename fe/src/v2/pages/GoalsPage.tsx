import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  Check,
  Info,
  Pencil,
  Plus,
  Target,
  Trash2,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { goalApi, transactionApi, walletApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { cn } from "lib/utils";
import { ConfirmDialog, Panel } from "../components/overlays";
import {
  Button,
  Chip,
  EmptyState,
  FieldLabel,
  HeroStrip,
  Money,
  Notice,
  PageHeader,
  Ring,
  Segmented,
  SkeletonRows,
  TextInput,
  TextLink,
} from "../components/primitives";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useLedger } from "../LedgerContext";
import {
  calendarDay,
  formatAmountInput,
  formatMoney,
  middayIso,
  parseAmountInput,
  todayKey,
} from "../lib/format";
import { useT } from "../lib/i18n";
import { extractWarnings, getIdToken } from "../lib/session";
import { toAmount, type Goal, type Wallet } from "../lib/types";

/** Category v1 stores on goal deposits and withdrawals; the API needs one. */
const GOAL_TRANSACTION_CATEGORY = "Goal";
/** What v1 files a goal under when the user leaves the group empty. */
const DEFAULT_GOAL_CATEGORY = "general";

const CATEGORY_SUGGESTIONS = {
  vi: ["Du lịch", "Khẩn cấp", "Mua sắm lớn", "Học tập", "Nhà cửa", "Phương tiện"],
  en: ["Travel", "Emergency", "Big purchase", "Education", "Home", "Vehicle"],
};

type GoalState = "active" | "expired" | "completed";
type ContributionMode = "deposit" | "withdraw";

interface GoalView {
  goal: Goal;
  saved: number;
  target: number;
  missing: number;
  percent: number;
  state: GoalState;
  /** yyyy-mm-dd in the user's timezone, empty when the goal has no deadline. */
  deadlineKey: string;
  daysLeft: number | null;
}

const dayNumber = (dayKey: string) => Date.parse(`${dayKey}T12:00:00Z`) / 86_400_000;

const shortDate = (dayKey: string) => `${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)}`;
const fullDate = (dayKey: string) => `${shortDate(dayKey)}/${dayKey.slice(0, 4)}`;

const percentLabel = (view: Pick<GoalView, "percent" | "state">) =>
  // Floored so a goal one đồng short never reads as 100%.
  `${view.state === "completed" ? 100 : Math.min(Math.floor(view.percent), 99)}%`;

/**
 * Status is worked out here from the amounts and the deadline rather than
 * read from the goal: the server only refreshes it on a write, so a deadline
 * that passed quietly overnight would still say "active".
 */
const toGoalView = (goal: Goal, today: string, timezoneOffsetMinutes: number): GoalView => {
  const saved = Math.max(toAmount(goal.currentAmount), 0);
  const target = Math.max(toAmount(goal.targetAmount), 0);
  const deadlineKey = goal.deadline ? calendarDay(goal.deadline, timezoneOffsetMinutes) : "";
  const state: GoalState =
    target > 0 && saved >= target
      ? "completed"
      : deadlineKey && deadlineKey < today
        ? "expired"
        : "active";

  return {
    goal,
    saved,
    target,
    missing: Math.max(target - saved, 0),
    percent: target > 0 ? (saved / target) * 100 : 0,
    state,
    deadlineKey,
    daysLeft: deadlineKey ? Math.round(dayNumber(deadlineKey) - dayNumber(today)) : null,
  };
};

const STATE_ORDER: Record<GoalState, number> = { active: 0, expired: 1, completed: 2 };

/* --------------------------------------------------------------- Goal row */

const Pill: React.FC<{ tone: "in" | "spend"; children: React.ReactNode }> = ({
  tone,
  children,
}) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold",
      tone === "in" ? "bg-ledger-in-wash text-ledger-in" : "bg-ledger-spend-wash text-ledger-spend",
    )}
  >
    {children}
  </span>
);

const DeadlineInfo: React.FC<{ view: GoalView }> = ({ view }) => {
  const t = useT();

  if (view.state === "completed") {
    return (
      <Pill tone="in">
        <Check className="h-3.5 w-3.5" />
        {t("Đã hoàn thành", "Completed")}
      </Pill>
    );
  }
  if (view.state === "expired") {
    return (
      <Pill tone="spend">
        <CalendarClock className="h-3.5 w-3.5" />
        {t(`Quá hạn ${shortDate(view.deadlineKey)}`, `Overdue since ${shortDate(view.deadlineKey)}`)}
      </Pill>
    );
  }
  if (!view.deadlineKey) {
    return <span className="text-[13px] text-ledger-muted">{t("Không đặt hạn", "No deadline")}</span>;
  }

  const left =
    view.daysLeft === 0
      ? t("hạn là hôm nay", "due today")
      : t(`còn ${view.daysLeft} ngày`, `${view.daysLeft} days left`);
  return (
    <span className="text-[13px] text-ledger-ink-2">
      <span className="ledger-num">{t(`Hạn ${fullDate(view.deadlineKey)}`, `Due ${fullDate(view.deadlineKey)}`)}</span>
      <span className="text-ledger-muted"> · {left}</span>
    </span>
  );
};

const GoalRow: React.FC<{
  view: GoalView;
  onContribute: (view: GoalView, mode: ContributionMode) => void;
  onEdit: (goal: Goal) => void;
}> = ({ view, onContribute, onEdit }) => {
  const t = useT();
  const isDesktop = useIsDesktop();
  const { goal, saved, target, missing, state } = view;
  const category = goal.category && goal.category !== DEFAULT_GOAL_CATEGORY ? goal.category : "";
  const nothingSaved = saved <= 0;

  const withdrawReason = nothingSaved ? (
    <p className="text-[12px] text-ledger-muted">
      {t("Chưa có tiền trong mục tiêu để rút.", "Nothing saved yet to withdraw.")}
    </p>
  ) : null;

  const actions = (
    <>
      <Button
        icon={ArrowDownToLine}
        onClick={() => onContribute(view, "deposit")}
        size="sm"
        variant="outline"
      >
        {t("Nạp thêm", "Add money")}
      </Button>
      <Button
        disabled={nothingSaved}
        icon={ArrowUpFromLine}
        onClick={() => onContribute(view, "withdraw")}
        size="sm"
        variant="ghost"
      >
        {t("Rút về ví", "Withdraw")}
      </Button>
      <button
        aria-label={t(`Sửa ${goal.title}`, `Edit ${goal.title}`)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ledger-muted hover:bg-ledger-canvas hover:text-ledger-ink"
        onClick={() => onEdit(goal)}
        type="button"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </>
  );

  return (
    <div className="border-b border-ledger-line py-5 last:border-b-0">
      <div className="flex items-center gap-3 lg:gap-4">
        <Ring
          complete={state === "completed"}
          label={state === "completed" ? <Check className="h-5 w-5 text-ledger-in" /> : percentLabel(view)}
          percent={view.percent}
          size={isDesktop ? 60 : 48}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[15.5px] font-semibold text-ledger-ink">{goal.title}</p>
            {category ? (
              <span className="hidden max-w-[140px] shrink-0 truncate rounded-full bg-ledger-canvas px-2 py-0.5 text-[11.5px] text-ledger-ink-2 sm:inline">
                {category}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[13px] text-ledger-muted">
            <span className="ledger-num">
              {formatMoney(saved)} / {formatMoney(target)}
            </span>
            {state !== "completed" ? (
              <>
                {" · "}
                <span className="whitespace-nowrap">
                  {t("còn thiếu ", "")}
                  <span className="ledger-num">{formatMoney(missing)}</span>
                  {t("", " to go")}
                </span>
              </>
            ) : null}
          </p>
          <div className="mt-1.5 lg:hidden">
            <DeadlineInfo view={view} />
          </div>
        </div>
        <div className="hidden w-[230px] shrink-0 lg:block">
          <DeadlineInfo view={view} />
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 lg:flex">
          <div className="flex items-center gap-1.5">{actions}</div>
          {withdrawReason}
        </div>
      </div>

      {state === "expired" ? (
        <Notice
          action={
            <TextLink onClick={() => onEdit(goal)}>{t("Dời hạn", "Move deadline")}</TextLink>
          }
          className="ml-[60px] mt-3 lg:ml-[76px]"
          tone="muted"
        >
          {saved > 0
            ? t(
                "Bạn có thể dời hạn hoặc rút phần đã để dành.",
                "You can move the deadline or withdraw what you saved.",
              )
            : t(
                "Hạn đã qua. Bạn có thể dời hạn để tiếp tục để dành.",
                "The deadline has passed. Move it to keep saving.",
              )}
        </Notice>
      ) : null}

      {/* On a phone the actions get their own row under the figures, with the
          thumb-sized deposit button first. */}
      <div className="ml-[60px] mt-3 lg:hidden">
        <div className="flex items-center gap-1.5">{actions}</div>
        {withdrawReason ? <div className="mt-1">{withdrawReason}</div> : null}
      </div>
    </div>
  );
};

/* ------------------------------------------------------ Contribution panel */

const QUICK_AMOUNTS = [
  { value: 500_000, vi: "500.000", en: "500,000" },
  { value: 1_000_000, vi: "1 triệu", en: "1 million" },
];

/**
 * Moving money between a wallet and a goal. Taking a wallet below zero is
 * allowed and only flagged; withdrawing more than the goal holds is the one
 * thing that cannot happen, so it is the only thing that disables saving.
 */
const ContributionPanel: React.FC<{
  view: GoalView | null;
  initialMode: ContributionMode;
  wallets: Wallet[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ view, initialMode, wallets, onClose, onSaved }) => {
  const t = useT();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { isVietnamese, timezoneOffsetMinutes } = useLocale();
  const { toast } = useToast();
  const amountRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ContributionMode>(initialMode);
  const [amount, setAmount] = useState(0);
  const [walletId, setWalletId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const goalId = view?.goal._id;

  // Fresh form per goal. The wallet holding the most is the likeliest source
  // of savings, so it is picked first instead of whichever wallet is listed
  // first (often cash, often near zero).
  useEffect(() => {
    if (!goalId) {
      return;
    }
    setMode(initialMode);
    setAmount(0);
    setNote("");
    const richest = [...wallets].sort(
      (left, right) => toAmount(right.balance) - toAmount(left.balance),
    )[0];
    setWalletId(richest?._id || "");
    if (isDesktop) {
      window.setTimeout(() => amountRef.current?.focus(), 60);
    }
    // Wallet list changes must not wipe what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId, initialMode]);

  if (!view) {
    return null;
  }

  const { goal, saved, target, missing } = view;
  const isDeposit = mode === "deposit";
  const wallet = wallets.find((item) => item._id === walletId);
  const balance = toAmount(wallet?.balance);
  const tooMuch = !isDeposit && amount > saved;
  const savedAfter = isDeposit ? saved + amount : saved - amount;
  const walletAfter = isDeposit ? balance - amount : balance + amount;
  const percentAfter =
    target > 0
      ? savedAfter >= target
        ? Math.round((savedAfter / target) * 100)
        : Math.floor((savedAfter / target) * 100)
      : 0;
  const canSave = amount > 0 && Boolean(wallet) && !tooMuch && !saving;

  const defaultNote = isDeposit
    ? t(`Nạp cho mục tiêu ${goal.title}`, `Deposit for goal ${goal.title}`)
    : t(`Rút từ mục tiêu ${goal.title}`, `Withdrawal from goal ${goal.title}`);

  const chips = [
    ...QUICK_AMOUNTS.map((item) => ({ value: item.value, label: isVietnamese ? item.vi : item.en })),
    ...(isDeposit && missing > 0
      ? [{ value: missing, label: t("Đủ mục tiêu", "Reach the target") }]
      : []),
    ...(!isDeposit && saved > 0 ? [{ value: saved, label: t("Rút hết", "All of it") }] : []),
  ];

  const save = async () => {
    if (!canSave || !wallet) {
      return;
    }
    setSaving(true);
    try {
      // Same record v1 writes, so both interfaces read each other's history.
      const response = await transactionApi.createTransaction(
        {
          type: isDeposit ? "GOAL_DEPOSIT" : "GOAL_WITHDRAW",
          status: "COMPLETED",
          amount,
          walletId: wallet._id,
          goalId: goal._id,
          category: GOAL_TRANSACTION_CATEGORY,
          note: note.trim() || defaultNote,
          date: new Date().toISOString(),
          timezoneOffset: timezoneOffsetMinutes,
        },
        await getIdToken(),
      );
      toast({
        title: isDeposit
          ? t("Đã nạp vào mục tiêu", "Added to the goal")
          : t("Đã rút về ví", "Returned to the wallet"),
        variant: "success",
      });
      extractWarnings(response).forEach((warning) =>
        toast({ title: warning.message, variant: "default" }),
      );
      onSaved();
      onClose();
    } catch (error: any) {
      toast({
        title: isDeposit
          ? t("Chưa nạp được", "Could not add the money")
          : t("Chưa rút được", "Could not withdraw"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const footer = wallets.length ? (
    <div className="flex items-center gap-2">
      {isDesktop ? (
        <Button className="mr-auto" onClick={onClose} variant="ghost">
          {t("Huỷ", "Cancel")}
        </Button>
      ) : null}
      <Button block={!isDesktop} disabled={!canSave} onClick={() => void save()} size={isDesktop ? "md" : "lg"}>
        {saving
          ? t("Đang lưu...", "Saving...")
          : isDeposit
            ? t("Nạp tiền", "Add money")
            : t("Rút về ví", "Withdraw")}
      </Button>
    </div>
  ) : undefined;

  return (
    <Panel
      footer={footer}
      onClose={onClose}
      open
      title={isDeposit ? t("Nạp tiền vào mục tiêu", "Add money to a goal") : t("Rút tiền về ví", "Withdraw to a wallet")}
    >
      {!wallets.length ? (
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
            "Tiền để dành được chuyển từ một ví sang mục tiêu, nên cần có ví trước.",
            "Savings move from a wallet into the goal, so you need a wallet first.",
          )}
          icon={WalletCards}
          title={t("Bạn chưa có ví nào", "You have no wallets yet")}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {/* The goal being funded, read-only: context, not another field. */}
          <div className="flex items-center gap-3 rounded-[14px] bg-ledger-canvas px-4 py-3">
            <Ring
              complete={view.state === "completed"}
              label={percentLabel(view)}
              percent={view.percent}
              size={42}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-semibold text-ledger-ink">{goal.title}</p>
              <p className="ledger-num text-[12.5px] text-ledger-muted">
                {isDeposit
                  ? missing > 0
                    ? t(`Còn thiếu ${formatMoney(missing)}`, `${formatMoney(missing)} to go`)
                    : t("Đã đủ mục tiêu", "Target reached")
                  : t(`Đang có ${formatMoney(saved)}`, `${formatMoney(saved)} saved`)}
              </p>
            </div>
          </div>

          <Segmented
            onChange={setMode}
            options={[
              { value: "deposit", label: t("Nạp vào", "Add") },
              { value: "withdraw", label: t("Rút về ví", "Withdraw") },
            ]}
            value={mode}
          />

          <div>
            <label className="flex items-baseline gap-3 border-b-2 border-ledger-line pb-1 focus-within:border-ledger-accent">
              <span className="shrink-0 text-[13.5px] text-ledger-ink-2">{t("Số tiền", "Amount")}</span>
              <input
                className="ledger-num min-w-0 flex-1 bg-transparent text-right text-[36px] font-semibold leading-tight tracking-[-0.03em] text-ledger-ink outline-none placeholder:text-ledger-line-strong lg:text-[44px]"
                id="goal-contribution-amount"
                inputMode="numeric"
                onChange={(event) => setAmount(parseAmountInput(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void save();
                  }
                }}
                placeholder="0"
                ref={amountRef}
                value={formatAmountInput(amount)}
              />
              <span className="text-[24px] font-semibold text-ledger-muted lg:text-[26px]">₫</span>
            </label>
            <div className="ledger-scroll-x -mx-1 mt-3 flex gap-2 px-1">
              {chips.map((chip) => (
                <button
                  aria-pressed={amount === chip.value}
                  className={cn(
                    "ledger-num h-8 shrink-0 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors",
                    amount === chip.value
                      ? "bg-ledger-accent-wash text-ledger-accent"
                      : "bg-ledger-canvas text-ledger-ink-2 hover:text-ledger-ink",
                  )}
                  key={chip.label}
                  onClick={() => setAmount(chip.value)}
                  type="button"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>{isDeposit ? t("Từ ví", "From wallet") : t("Về ví", "To wallet")}</FieldLabel>
            {/* The drawer has room to show every wallet at once; the phone
                sheet scrolls them sideways instead. */}
            <div className="ledger-scroll-x -mx-1 flex gap-2 px-1 pb-1 lg:flex-wrap">
              {wallets.map((item) => (
                <Chip
                  key={item._id}
                  onClick={() => setWalletId(item._id)}
                  selected={item._id === walletId}
                >
                  {item.name}
                  <span
                    className={cn(
                      "ledger-num font-normal",
                      toAmount(item.balance) < 0 ? "text-ledger-out" : "opacity-70",
                    )}
                  >
                    · {formatMoney(toAmount(item.balance), item.currency)}
                  </span>
                </Chip>
              ))}
            </div>
          </div>

          {tooMuch ? (
            <Notice
              action={
                saved > 0 ? (
                  <TextLink onClick={() => setAmount(saved)}>{t("Rút hết", "Withdraw all")}</TextLink>
                ) : undefined
              }
              icon={TriangleAlert}
              tone="rose"
            >
              {saved > 0
                ? t(
                    `Mục tiêu chỉ đang có ${formatMoney(saved)}, không rút được nhiều hơn.`,
                    `This goal only holds ${formatMoney(saved)}; you cannot withdraw more.`,
                  )
                : t(
                    "Mục tiêu chưa có tiền nên chưa có gì để rút.",
                    "This goal holds nothing yet, so there is nothing to withdraw.",
                  )}
            </Notice>
          ) : null}

          {amount > 0 && wallet && !tooMuch ? (
            <Notice icon={Info} tone="blue">
              {isDeposit
                ? t(
                    `Sau khi nạp, mục tiêu ${savedAfter >= target ? "hoàn thành" : "đạt"} ${percentAfter}% và ví ${wallet.name} ${walletAfter < 0 ? `âm ${formatMoney(Math.abs(walletAfter))}` : `còn ${formatMoney(walletAfter)}`}.`,
                    `After this the goal is ${savedAfter >= target ? "complete at" : "at"} ${percentAfter}% and ${wallet.name} ${walletAfter < 0 ? `is ${formatMoney(Math.abs(walletAfter))} below zero` : `holds ${formatMoney(walletAfter)}`}.`,
                  )
                : t(
                    `Sau khi rút, mục tiêu còn ${formatMoney(savedAfter)} (${percentAfter}%) và ví ${wallet.name} có ${formatMoney(walletAfter)}.`,
                    `After this the goal keeps ${formatMoney(savedAfter)} (${percentAfter}%) and ${wallet.name} holds ${formatMoney(walletAfter)}.`,
                  )}
            </Notice>
          ) : null}

          {isDeposit && amount > 0 && wallet && walletAfter < 0 ? (
            <Notice
              detail={t("Vẫn nạp được bình thường.", "It still goes through.")}
              icon={TriangleAlert}
              tone="amber"
            >
              {t(
                `Ví ${wallet.name} sẽ âm ${formatMoney(Math.abs(walletAfter))} sau khi nạp.`,
                `${wallet.name} will be ${formatMoney(Math.abs(walletAfter))} below zero after this.`,
              )}
            </Notice>
          ) : null}

          <div>
            <FieldLabel htmlFor="goal-contribution-note" hint={t("không bắt buộc", "optional")}>
              {t("Ghi chú", "Note")}
            </FieldLabel>
            <TextInput
              id="goal-contribution-note"
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              placeholder={defaultNote}
              value={note}
            />
          </div>
        </div>
      )}
    </Panel>
  );
};

/* --------------------------------------------------------------- Goal form */

interface GoalFormState {
  title: string;
  target: number;
  deadline: string;
  category: string;
  description: string;
}

const EMPTY_FORM: GoalFormState = {
  title: "",
  target: 0,
  deadline: "",
  category: "",
  description: "",
};

const GoalFormPanel: React.FC<{
  open: boolean;
  editing: Goal | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (goal: Goal) => void;
}> = ({ open, editing, onClose, onSaved, onDelete }) => {
  const t = useT();
  const isDesktop = useIsDesktop();
  const { isVietnamese, timezoneOffsetMinutes } = useLocale();
  const { toast } = useToast();
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const today = todayKey(timezoneOffsetMinutes);

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(
      editing
        ? {
            title: editing.title || "",
            target: toAmount(editing.targetAmount),
            deadline: editing.deadline ? calendarDay(editing.deadline, timezoneOffsetMinutes) : "",
            category:
              editing.category && editing.category !== DEFAULT_GOAL_CATEGORY ? editing.category : "",
            description: editing.description || "",
          }
        : EMPTY_FORM,
    );
  }, [editing, open, timezoneOffsetMinutes]);

  const saved = editing ? Math.max(toAmount(editing.currentAmount), 0) : 0;
  const canSave = Boolean(form.title.trim()) && form.target > 0 && !saving;
  const update = <K extends keyof GoalFormState>(key: K, value: GoalFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", form.title.trim());
      formData.append("targetAmount", String(form.target));
      formData.append("category", form.category.trim() || DEFAULT_GOAL_CATEGORY);
      // Midday in the user's timezone keeps the picked day intact wherever the
      // server runs. An empty value on edit is sent on purpose: it is how the
      // server clears a deadline, which v1 could never do.
      if (form.deadline) {
        formData.append("deadline", middayIso(form.deadline, timezoneOffsetMinutes));
      } else if (editing) {
        formData.append("deadline", "");
      }
      if (editing || form.description.trim()) {
        formData.append("description", form.description.trim());
      }

      const token = await getIdToken();
      if (editing) {
        await goalApi.updateGoal(editing._id, formData, token);
      } else {
        await goalApi.createGoal(formData, token);
      }
      toast({
        title: editing ? t("Đã lưu mục tiêu", "Goal saved") : t("Đã tạo mục tiêu", "Goal created"),
        variant: "success",
      });
      onSaved();
      onClose();
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

  const reachesTarget = Boolean(editing) && form.target > 0 && saved >= form.target;
  const pastDeadline = Boolean(form.deadline) && form.deadline < today && !reachesTarget;
  const suggestions = isVietnamese ? CATEGORY_SUGGESTIONS.vi : CATEGORY_SUGGESTIONS.en;

  const footer = (
    <div className="flex items-center gap-2">
      {editing ? (
        // Not a Button variant: rose text on a ghost button would fight the
        // variant's own colour classes.
        <button
          aria-label={t("Xoá mục tiêu", "Delete goal")}
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] text-sm font-medium text-ledger-out transition-colors hover:bg-ledger-out-wash",
            isDesktop ? "px-3" : "w-12 border border-ledger-line",
          )}
          onClick={() => onDelete(editing)}
          type="button"
        >
          <Trash2 className="h-4 w-4" />
          {isDesktop ? t("Xoá mục tiêu", "Delete goal") : null}
        </button>
      ) : null}
      {isDesktop ? (
        <Button className="ml-auto" onClick={onClose} variant="ghost">
          {t("Huỷ", "Cancel")}
        </Button>
      ) : null}
      <Button
        className={cn(!isDesktop && "flex-1")}
        disabled={!canSave}
        onClick={() => void save()}
        size={isDesktop ? "md" : "lg"}
      >
        {saving
          ? t("Đang lưu...", "Saving...")
          : editing
            ? t("Lưu thay đổi", "Save changes")
            : t("Tạo mục tiêu", "Create goal")}
      </Button>
    </div>
  );

  return (
    <Panel
      footer={footer}
      onClose={onClose}
      open={open}
      title={editing ? t("Sửa mục tiêu", "Edit goal") : t("Tạo mục tiêu", "New goal")}
    >
      <div className="flex flex-col gap-5">
        <div>
          <FieldLabel htmlFor="goal-title">{t("Tên mục tiêu", "Name")}</FieldLabel>
          <TextInput
            autoFocus={isDesktop}
            id="goal-title"
            maxLength={80}
            onChange={(event) => update("title", event.target.value)}
            placeholder={t("Ví dụ: Quỹ du lịch Đà Lạt", "e.g. Trip to Da Lat")}
            value={form.title}
          />
        </div>

        <div>
          <FieldLabel htmlFor="goal-target">{t("Số tiền cần có", "Target amount")}</FieldLabel>
          <label className="flex h-12 items-center gap-2 rounded-[10px] border border-ledger-line bg-ledger-paper px-3.5 transition-colors focus-within:border-ledger-accent">
            <input
              className="ledger-num min-w-0 flex-1 bg-transparent text-[20px] font-semibold text-ledger-ink outline-none placeholder:text-ledger-line-strong"
              id="goal-target"
              inputMode="numeric"
              onChange={(event) => update("target", parseAmountInput(event.target.value))}
              placeholder="0"
              value={formatAmountInput(form.target)}
            />
            <span className="text-[16px] font-semibold text-ledger-muted">₫</span>
          </label>
          {editing ? (
            <p className="mt-2 text-[12.5px] text-ledger-muted">
              {saved > 0
                ? t(
                    `Đã để dành ${formatMoney(saved)}. Số này chỉ đổi khi bạn nạp hoặc rút, để luôn khớp với ví.`,
                    `${formatMoney(saved)} saved so far. It only changes when you add or withdraw, so it always matches your wallets.`,
                  )
                : t(
                    "Chưa nạp tiền vào mục tiêu này. Số đã để dành chỉ đổi khi bạn nạp hoặc rút.",
                    "Nothing added yet. The saved amount only changes when you add or withdraw.",
                  )}
            </p>
          ) : (
            <p className="mt-2 text-[12.5px] text-ledger-muted">
              {t(
                "Mục tiêu bắt đầu từ 0 ₫. Bạn nạp tiền từ ví sau khi tạo.",
                "A goal starts at 0 ₫. Add money from a wallet once it exists.",
              )}
            </p>
          )}
        </div>

        {reachesTarget ? (
          <Notice icon={Info} tone="blue">
            {t(
              "Số đã để dành đủ cho mức mới, nên mục tiêu sẽ được tính là hoàn thành.",
              "What is saved already covers the new amount, so the goal will count as completed.",
            )}
          </Notice>
        ) : null}

        <div>
          <FieldLabel
            hint={
              form.deadline ? (
                <TextLink onClick={() => update("deadline", "")}>{t("Bỏ hạn", "Clear")}</TextLink>
              ) : (
                t("không bắt buộc", "optional")
              )
            }
            htmlFor="goal-deadline"
          >
            {t("Hạn", "Deadline")}
          </FieldLabel>
          <TextInput
            id="goal-deadline"
            onChange={(event) => update("deadline", event.target.value)}
            type="date"
            value={form.deadline}
          />
        </div>

        {pastDeadline ? (
          <Notice detail={t("Vẫn lưu được.", "It still saves.")} icon={CalendarClock} tone="amber">
            {t(
              "Ngày này đã qua nên mục tiêu sẽ hiện là quá hạn.",
              "This day has passed, so the goal will show as overdue.",
            )}
          </Notice>
        ) : null}

        <div>
          <FieldLabel hint={t("không bắt buộc", "optional")} htmlFor="goal-category">
            {t("Nhóm", "Group")}
          </FieldLabel>
          <TextInput
            id="goal-category"
            maxLength={40}
            onChange={(event) => update("category", event.target.value)}
            placeholder={t("Tổng quát", "General")}
            value={form.category}
          />
          <div className="ledger-scroll-x -mx-1 mt-2 flex gap-2 px-1 pb-1 lg:flex-wrap">
            {suggestions.map((item) => (
              <Chip
                key={item}
                onClick={() => update("category", form.category === item ? "" : item)}
                selected={form.category === item}
              >
                {item}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel hint={t("không bắt buộc", "optional")} htmlFor="goal-description">
            {t("Mô tả", "Description")}
          </FieldLabel>
          <textarea
            className="min-h-[84px] w-full rounded-[10px] border border-ledger-line bg-ledger-paper px-3.5 py-2.5 text-[14px] text-ledger-ink outline-none placeholder:text-ledger-muted focus:border-ledger-accent"
            id="goal-description"
            maxLength={300}
            onChange={(event) => update("description", event.target.value)}
            placeholder={t("Để dành cho việc gì, vì sao quan trọng", "What it is for and why it matters")}
            value={form.description}
          />
        </div>
      </div>
    </Panel>
  );
};

/* -------------------------------------------------------------------- Page */

const GoalsPage: React.FC = () => {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const { timezoneOffsetMinutes } = useLocale();
  const { toast } = useToast();
  const { dataVersion, notifyDataChanged } = useLedger();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const [contribution, setContribution] = useState<{ goalId: string; mode: ContributionMode } | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const token = await getIdToken();
        const [goalList, walletResponse] = await Promise.all([
          goalApi.getGoals(token),
          walletApi.getWallets(token),
        ]);
        if (!active) {
          return;
        }
        setGoals(Array.isArray(goalList) ? goalList : []);
        setWallets(walletResponse?.wallets || []);
        setLoaded(true);
      } catch (error: any) {
        if (active) {
          toast({
            title: t("Không tải được mục tiêu", "Could not load goals"),
            description: error.message,
            variant: "destructive",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [dataVersion, t, toast]);

  const today = todayKey(timezoneOffsetMinutes);
  const views = useMemo(
    () =>
      goals
        .map((goal) => toGoalView(goal, today, timezoneOffsetMinutes))
        // Running goals first, soonest deadline on top; the ones that need a
        // decision next; finished ones last.
        .sort((left, right) => {
          const byState = STATE_ORDER[left.state] - STATE_ORDER[right.state];
          if (byState !== 0) {
            return byState;
          }
          const leftDeadline = left.deadlineKey || "9999";
          const rightDeadline = right.deadlineKey || "9999";
          return leftDeadline.localeCompare(rightDeadline);
        }),
    [goals, timezoneOffsetMinutes, today],
  );

  // `/goals?contribute=<id>` from the dashboard and elsewhere: open the deposit
  // panel once the goal is known, then drop the param so a refresh does not.
  const contributeParam = searchParams.get("contribute");
  useEffect(() => {
    if (!contributeParam || !loaded) {
      return;
    }
    if (goals.some((goal) => goal._id === contributeParam)) {
      setContribution({ goalId: contributeParam, mode: "deposit" });
    } else {
      toast({ title: t("Không tìm thấy mục tiêu này", "That goal was not found"), variant: "default" });
    }
    setSearchParams({}, { replace: true });
  }, [contributeParam, goals, loaded, setSearchParams, t, toast]);

  const totals = useMemo(() => {
    const target = views.reduce((sum, view) => sum + view.target, 0);
    const saved = views.reduce((sum, view) => sum + view.saved, 0);
    return {
      saved,
      target,
      missing: views.reduce((sum, view) => sum + view.missing, 0),
      active: views.filter((view) => view.state === "active").length,
      expired: views.filter((view) => view.state === "expired").length,
      completed: views.filter((view) => view.state === "completed").length,
      percent: target > 0 ? Math.floor((saved / target) * 100) : 0,
    };
  }, [views]);

  const contributionView = contribution
    ? views.find((view) => view.goal._id === contribution.goalId) || null
    : null;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    try {
      const response = await goalApi.deleteGoal(pendingDelete._id, await getIdToken());
      // A funded goal hands its money back to a wallet; the server names the
      // wallet, and saying nothing would look like the savings vanished.
      const refunded = toAmount(response?.data?.refundedAmount);
      toast({
        title: t("Đã xoá mục tiêu", "Goal deleted"),
        description: refunded > 0 ? response?.message : undefined,
        variant: "success",
      });
      setPendingDelete(null);
      setFormOpen(false);
      setEditing(null);
      notifyDataChanged();
    } catch (error: any) {
      toast({
        title: t("Chưa xoá được", "Could not delete"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const subtitle = loading
    ? t("Đang tải...", "Loading...")
    : views.length
      ? [
          t(`${totals.active} mục tiêu đang chạy`, `${totals.active} in progress`),
          totals.expired ? t(`${totals.expired} quá hạn`, `${totals.expired} overdue`) : "",
          totals.completed
            ? t(`${totals.completed} đã hoàn thành`, `${totals.completed} completed`)
            : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : t("Chưa có mục tiêu nào", "No goals yet");

  const pendingSaved = pendingDelete ? Math.max(toAmount(pendingDelete.currentAmount), 0) : 0;

  return (
    <div>
      <PageHeader
        actions={
          <Button icon={Plus} onClick={openCreate}>
            {t("Tạo mục tiêu", "New goal")}
          </Button>
        }
        subtitle={subtitle}
        title={t("Mục tiêu", "Goals")}
      />

      {loading || views.length ? (
        <HeroStrip
          caption={
            loading
              ? null
              : totals.saved > 0
                ? t(
                    `Đã đạt ${totals.percent}% tổng số tiền của ${views.length} mục tiêu.`,
                    `${totals.percent}% of what your ${views.length} goals need.`,
                  )
                : t("Chưa nạp tiền vào mục tiêu nào.", "Nothing has been put into a goal yet.")
          }
          label={t("Đang để dành", "Saved in goals")}
          stats={[
            { label: t("Tổng mục tiêu", "Total target"), value: <Money amount={totals.target} /> },
            { label: t("Còn thiếu", "Still to go"), value: <Money amount={totals.missing} /> },
            {
              label: t("Hoàn thành", "Completed"),
              value: (
                <span className="ledger-num text-ledger-ink">
                  {totals.completed}/{views.length}
                </span>
              ),
            },
          ]}
          value={loading ? <span className="text-ledger-line-strong">—</span> : <Money amount={totals.saved} />}
        />
      ) : null}

      {loading ? (
        <SkeletonRows rows={4} />
      ) : views.length ? (
        <div>
          {views.map((view) => (
            <GoalRow
              key={view.goal._id}
              onContribute={(target, mode) => setContribution({ goalId: target.goal._id, mode })}
              onEdit={openEdit}
              view={view}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            <Button icon={Target} onClick={openCreate}>
              {t("Tạo mục tiêu đầu tiên", "Create your first goal")}
            </Button>
          }
          description={t(
            "Đặt một khoản cần để dành rồi nạp dần từ ví. Tiền trong mục tiêu vẫn là của bạn, rút về ví lúc nào cũng được.",
            "Set an amount to save and add to it from your wallets. The money stays yours and can go back to a wallet at any time.",
          )}
          icon={Target}
          title={t("Chưa có mục tiêu nào", "No goals yet")}
        />
      )}

      <ContributionPanel
        initialMode={contribution?.mode || "deposit"}
        onClose={() => setContribution(null)}
        onSaved={notifyDataChanged}
        view={contributionView}
        wallets={wallets}
      />

      <GoalFormPanel
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onDelete={setPendingDelete}
        onSaved={notifyDataChanged}
        open={formOpen}
      />

      <ConfirmDialog
        busy={deleting}
        cancelLabel={t("Giữ lại", "Keep")}
        confirmLabel={deleting ? t("Đang xoá...", "Deleting...") : t("Xoá mục tiêu", "Delete goal")}
        description={
          pendingSaved > 0
            ? t(
                `${formatMoney(pendingSaved)} đang để dành sẽ được hoàn về ví đã nạp gần nhất và ghi lại thành một giao dịch hoàn tiền.`,
                `The ${formatMoney(pendingSaved)} saved goes back to the wallet it was last added from, recorded as a refund transaction.`,
              )
            : t(
                "Mục tiêu này chưa có tiền nên không có gì cần hoàn lại.",
                "This goal holds no money, so nothing needs to be refunded.",
              )
        }
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        open={Boolean(pendingDelete)}
        title={
          pendingDelete
            ? t(`Xoá mục tiêu ${pendingDelete.title}?`, `Delete "${pendingDelete.title}"?`)
            : ""
        }
      />
    </div>
  );
};

export default GoalsPage;
