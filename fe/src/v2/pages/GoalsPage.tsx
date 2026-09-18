import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  Check,
  CircleCheck,
  Hourglass,
  Info,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  Trash2,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { goalApi, transactionApi, walletApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { cn } from "lib/utils";
import { ConfirmDialog, Panel } from "../components/overlays";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  FieldLabel,
  HeroStrip,
  IconBadge,
  Money,
  Notice,
  PageHeader,
  Ring,
  Segmented,
  SkeletonRows,
  TextInput,
  TextLink,
  Track,
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

/* -------------------------------------------------------------- Goal card */

type PillTone = "in" | "spend" | "neutral";

const Pill: React.FC<{ tone: PillTone; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold",
      tone === "in" && "bg-ledger-in-wash text-ledger-in",
      tone === "spend" && "bg-ledger-spend-wash text-ledger-spend",
      tone === "neutral" && "bg-ledger-canvas text-ledger-ink-2",
    )}
  >
    {children}
  </span>
);

/** Where the goal stands against its deadline, always in the same pill. */
const DeadlinePill: React.FC<{ view: GoalView }> = ({ view }) => {
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
    return (
      <Pill tone="neutral">
        <CalendarOff className="h-3.5 w-3.5" />
        {t("Không đặt hạn", "No deadline")}
      </Pill>
    );
  }

  const left =
    view.daysLeft === 0
      ? t("hạn là hôm nay", "due today")
      : t(`còn ${view.daysLeft} ngày`, `${view.daysLeft} days left`);
  // The last week turns amber: close enough to plan around.
  return (
    <Pill tone={view.daysLeft !== null && view.daysLeft <= 7 ? "spend" : "neutral"}>
      <CalendarDays className="h-3.5 w-3.5" />
      <span className="ledger-num">
        {t(`Hạn ${fullDate(view.deadlineKey)}`, `Due ${fullDate(view.deadlineKey)}`)}
      </span>
      <span className="font-medium opacity-80">· {left}</span>
    </Pill>
  );
};

/**
 * What it takes to make the deadline, rounded up to the thousand so saving
 * that much really does get there: per month when the deadline is far, per
 * week when it is close, the whole remainder in the last fortnight.
 */
const savingPace = (view: GoalView) => {
  if (view.state !== "active" || view.daysLeft === null || view.missing <= 0) {
    return null;
  }
  const days = Math.max(view.daysLeft, 1);
  const roundUp = (value: number) => Math.ceil(value / 1000) * 1000;
  if (days > 62) {
    return { unit: "month" as const, amount: roundUp(view.missing / (days / 30.4)) };
  }
  if (days >= 14) {
    return { unit: "week" as const, amount: roundUp(view.missing / (days / 7)) };
  }
  return { unit: "total" as const, amount: view.missing, days: view.daysLeft };
};

/**
 * A heading for a group of cards laid out on the page itself. The count sits
 * on paper with a border: the card header's grey pill would disappear
 * against the grey page.
 */
const GroupHeading: React.FC<{
  icon: LucideIcon;
  tone: "accent" | "in";
  title: string;
  count?: number;
  subtitle?: string;
}> = ({ icon, tone, title, count, subtitle }) => (
  <div className="mb-4 flex items-center gap-3">
    <IconBadge icon={icon} size="md" tone={tone} />
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ledger-ink">{title}</h2>
        {count ? (
          <span className="ledger-num rounded-full border border-ledger-line bg-ledger-paper px-2 py-0.5 text-[12px] font-semibold text-ledger-ink-2">
            {count}
          </span>
        ) : null}
      </div>
      {subtitle ? <p className="text-[13px] leading-snug text-ledger-muted">{subtitle}</p> : null}
    </div>
  </div>
);

/**
 * One goal on its own card: how far (the ring), what is in it and what is
 * missing, the deadline, and the three things you can do with it, always in
 * view at the foot of the card.
 */
const GoalCard: React.FC<{
  view: GoalView;
  onContribute: (view: GoalView, mode: ContributionMode) => void;
  onEdit: (goal: Goal) => void;
}> = ({ view, onContribute, onEdit }) => {
  const t = useT();
  const { goal, saved, target, missing, state } = view;
  const category = goal.category && goal.category !== DEFAULT_GOAL_CATEGORY ? goal.category : "";
  const nothingSaved = saved <= 0;
  const complete = state === "completed";
  const pace = savingPace(view);

  const deposit = (
    <Button
      icon={ArrowDownToLine}
      key="deposit"
      onClick={() => onContribute(view, "deposit")}
      size="sm"
      variant={complete ? "outline" : "soft"}
    >
      {t("Nạp thêm", "Add money")}
    </Button>
  );
  const withdraw = (
    <Button
      disabled={nothingSaved}
      icon={ArrowUpFromLine}
      key="withdraw"
      onClick={() => onContribute(view, "withdraw")}
      size="sm"
      variant={complete ? "soft" : "outline"}
    >
      {t("Rút về ví", "Withdraw")}
    </Button>
  );

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-4">
        <Ring
          complete={complete}
          label={complete ? <Check className="h-5 w-5 text-ledger-in" /> : percentLabel(view)}
          percent={view.percent}
          size={56}
        />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-[16px] font-semibold leading-snug text-ledger-ink">{goal.title}</h3>
          {category ? (
            <p className="mt-0.5 break-words text-[13px] text-ledger-muted">{category}</p>
          ) : null}
          <div className="mt-2">
            <DeadlinePill view={view} />
          </div>
        </div>
      </div>

      {goal.description ? (
        <p className="mt-4 line-clamp-2 break-words text-[13.5px] leading-snug text-ledger-ink-2">
          {goal.description}
        </p>
      ) : null}

      <div className="mt-5">
        <p className="flex flex-wrap items-baseline gap-x-2 leading-tight">
          <Money amount={saved} className="whitespace-nowrap text-[22px] font-semibold tracking-[-0.01em]" />
          <span className="ledger-num whitespace-nowrap text-[14px] text-ledger-muted">
            / {formatMoney(target)}
          </span>
        </p>
        <p className="mt-1.5 text-[13.5px]">
          {complete ? (
            <span className="font-medium text-ledger-in">{t("Đã đủ số tiền cần có", "Target reached")}</span>
          ) : (
            <span className="text-ledger-ink-2">
              {t("Còn thiếu ", "")}
              <span className="ledger-num font-semibold text-ledger-ink">{formatMoney(missing)}</span>
              {t("", " to go")}
            </span>
          )}
        </p>
      </div>

      {pace ? (
        <p className="mt-4 flex items-start gap-2.5 rounded-[12px] bg-ledger-canvas px-3.5 py-2.5 text-[13px] leading-snug text-ledger-ink-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-ledger-muted" />
          <span>
            {t("Để kịp hạn: ", "To make the deadline: ")}
            {pace.unit === "total" ? (
              <>
                {t("cần ", "")}
                <span className="ledger-num font-semibold text-ledger-ink">{formatMoney(pace.amount)}</span>
                {pace.days
                  ? t(` trong ${pace.days} ngày`, ` in ${pace.days} days`)
                  : t(" ngay hôm nay", " today")}
              </>
            ) : (
              <>
                {t("khoảng ", "about ")}
                <span className="ledger-num font-semibold text-ledger-ink">{formatMoney(pace.amount)}</span>
                {pace.unit === "month" ? t(" mỗi tháng", " a month") : t(" mỗi tuần", " a week")}
              </>
            )}
          </span>
        </p>
      ) : null}

      {state === "expired" ? (
        // One paragraph with the link inline, so the card beside this one is
        // not stretched by a tall notice.
        <Notice className="mt-4" icon={CalendarClock} tone="muted">
          {saved > 0
            ? t(
                "Bạn có thể dời hạn hoặc rút phần đã để dành. ",
                "You can move the deadline or withdraw what you saved. ",
              )
            : t(
                "Hạn đã qua. Bạn có thể dời hạn để tiếp tục để dành. ",
                "The deadline has passed. Move it to keep saving. ",
              )}
          <TextLink className="whitespace-nowrap" onClick={() => onEdit(goal)}>
            {t("Dời hạn", "Move deadline")}
            <ArrowRight className="ml-1 inline h-3.5 w-3.5 align-[-2px]" />
          </TextLink>
        </Notice>
      ) : null}

      {/* The actions sit at the foot of every card, so they line up across a
          row whatever each card holds above them. */}
      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-center gap-2 border-t border-ledger-line pt-4">
          {/* A finished goal is more often spent than topped up. */}
          {complete ? [withdraw, deposit] : [deposit, withdraw]}
          <Button
            aria-label={t(`Sửa ${goal.title}`, `Edit ${goal.title}`)}
            className="ml-auto"
            icon={Pencil}
            onClick={() => onEdit(goal)}
            size="sm"
            variant="ghost"
          >
            {t("Sửa", "Edit")}
          </Button>
        </div>
        {nothingSaved ? (
          <p className="mt-2 text-[12.5px] text-ledger-muted">
            {t("Chưa có tiền trong mục tiêu để rút.", "Nothing saved yet to withdraw.")}
          </p>
        ) : null}
      </div>
    </Card>
  );
};

/** The grid every group of goals is laid out in. */
const GoalGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:gap-5 2xl:grid-cols-3">{children}</div>
);

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

  // Same arrangement as every other form: cancel beside the main action.
  const footer = wallets.length ? (
    <div className="flex items-center justify-end gap-2">
      {isDesktop ? (
        <Button onClick={onClose} variant="ghost">
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
          {/* The goal being funded, read-only: context, not another field.
              Outlined rather than filled, so the ring's own grey track stays
              visible against it. */}
          <div className="flex items-center gap-3.5 rounded-[14px] border border-ledger-line px-4 py-3.5">
            <Ring
              complete={view.state === "completed"}
              label={percentLabel(view)}
              percent={view.percent}
              size={48}
            />
            <div className="min-w-0 flex-1">
              <p className="break-words text-[15px] font-semibold leading-snug text-ledger-ink">{goal.title}</p>
              {/* What is in the goal comes first either way; adding money
                  also wants to know what is still missing, on its own line
                  so a narrow sheet never breaks a figure in two. */}
              <p className="ledger-num mt-0.5 text-[13px] text-ledger-muted">
                {t(
                  `Đang có ${formatMoney(saved)} / ${formatMoney(target)}`,
                  `${formatMoney(saved)} of ${formatMoney(target)} saved`,
                )}
              </p>
              {isDeposit ? (
                <p className="ledger-num text-[13px] font-medium text-ledger-ink-2">
                  {missing > 0
                    ? t(`Còn thiếu ${formatMoney(missing)}`, `${formatMoney(missing)} to go`)
                    : t("Đã đủ mục tiêu", "Target reached")}
                </p>
              ) : null}
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
            <FieldLabel htmlFor="goal-contribution-amount">{t("Số tiền", "Amount")}</FieldLabel>
            <label className="flex items-baseline justify-end gap-2 border-b-2 border-ledger-line pb-1 focus-within:border-ledger-accent">
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

  // Finished goals get their own group: they need a different decision
  // (spend it or keep it) from the ones still being filled.
  const running = views.filter((view) => view.state !== "completed");
  const completed = views.filter((view) => view.state === "completed");
  const contribute = (target: GoalView, mode: ContributionMode) =>
    setContribution({ goalId: target.goal._id, mode });

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
          icon={PiggyBank}
          label={t("Đang để dành", "Saved in goals")}
          stats={[
            {
              label: t("Tổng mục tiêu", "Total target"),
              icon: Target,
              tone: "accent",
              value: <Money amount={totals.target} />,
              hint: loading ? undefined : t(`${views.length} mục tiêu`, `${views.length} goals`),
            },
            {
              label: t("Còn thiếu", "Still to go"),
              icon: Hourglass,
              tone: "spend",
              value: <Money amount={totals.missing} />,
              hint: loading
                ? undefined
                : running.length
                  ? t(`${running.length} mục tiêu chưa đủ`, `${running.length} not reached yet`)
                  : t("Mọi mục tiêu đã đủ", "Every goal is reached"),
            },
            {
              label: t("Hoàn thành", "Completed"),
              icon: CircleCheck,
              tone: "in",
              value: (
                <span className="ledger-num text-ledger-ink">
                  {totals.completed}/{views.length}
                </span>
              ),
              hint: loading
                ? undefined
                : totals.expired
                  ? t(`${totals.expired} mục tiêu quá hạn`, `${totals.expired} overdue`)
                  : t(`${totals.active} đang thực hiện`, `${totals.active} in progress`),
            },
          ]}
          value={loading ? <span className="text-ledger-line-strong">—</span> : <Money amount={totals.saved} />}
        >
          {!loading && totals.target > 0 ? (
            <Track percent={(totals.saved / totals.target) * 100} tone="accent" />
          ) : null}
        </HeroStrip>
      ) : null}

      {loading ? (
        <Card className="mt-3 sm:mt-4 xl:mt-5">
          <SkeletonRows rows={4} />
        </Card>
      ) : views.length ? (
        <div className="mt-6 space-y-8 xl:mt-8 xl:space-y-10">
          <section>
            <GroupHeading
              count={running.length}
              icon={Target}
              subtitle={
                running.length
                  ? t(
                      "Hạn gần nhất lên trước, mục tiêu quá hạn ở cuối",
                      "Nearest deadline first, overdue goals last",
                    )
                  : undefined
              }
              title={t("Đang thực hiện", "In progress")}
              tone="accent"
            />
            {running.length ? (
              <GoalGrid>
                {running.map((view) => (
                  <GoalCard
                    key={view.goal._id}
                    onContribute={contribute}
                    onEdit={openEdit}
                    view={view}
                  />
                ))}
              </GoalGrid>
            ) : (
              <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] text-ledger-ink-2">
                  {t(
                    "Mọi mục tiêu đều đã hoàn thành. Đặt mục tiêu tiếp theo?",
                    "Every goal is reached. Set the next one?",
                  )}
                </p>
                <Button icon={Plus} onClick={openCreate} size="sm" variant="outline">
                  {t("Tạo mục tiêu", "New goal")}
                </Button>
              </Card>
            )}
          </section>

          {completed.length ? (
            <section>
              <GroupHeading
                count={completed.length}
                icon={CircleCheck}
                subtitle={t(
                  "Tiền vẫn nằm trong mục tiêu cho đến khi bạn rút về ví",
                  "The money stays in the goal until you withdraw it",
                )}
                title={t("Đã hoàn thành", "Completed")}
                tone="in"
              />
              <GoalGrid>
                {completed.map((view) => (
                  <GoalCard
                    key={view.goal._id}
                    onContribute={contribute}
                    onEdit={openEdit}
                    view={view}
                  />
                ))}
              </GoalGrid>
            </section>
          ) : null}
        </div>
      ) : (
        <Card>
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
        </Card>
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
