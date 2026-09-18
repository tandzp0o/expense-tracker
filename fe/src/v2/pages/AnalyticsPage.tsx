import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChartColumn,
  ChartPie,
  Gauge,
  History,
  Info,
  Lightbulb,
  PiggyBank,
  ReceiptText,
  Scale,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { budgetApi, isCashflowTransaction, transactionApi, userApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { cn } from "lib/utils";
import { ChartLegend, IncomeExpenseBars } from "../components/BarChart";
import {
  CategoryIcon,
  Eyebrow,
  HeroStrip,
  Money,
  Notice,
  PageHeader,
  Section,
  Segmented,
  SkeletonRows,
  Track,
} from "../components/primitives";
import { useLedger } from "../LedgerContext";
import { getCategoryMeta, type CategoryMeta } from "../lib/categories";
import {
  calendarDay,
  currentMonth,
  dayGroupLabel,
  daysInMonth,
  formatAmountInput,
  formatMoney,
  monthLabel,
  monthOfDay,
  todayKey,
} from "../lib/format";
import { useT } from "../lib/i18n";
import { getIdToken } from "../lib/session";
import {
  toAmount,
  type BudgetItem,
  type MonthHistoryPoint,
  type Transaction,
} from "../lib/types";

/** Same ceiling v1 fetched with; past it the page says the figures are partial. */
const FETCH_LIMIT = 2000;

type PeriodKey = "month" | "last" | "3m" | "6m";

interface DayRange {
  start: string;
  end: string;
}

interface PeriodRange {
  current: DayRange;
  previous: DayRange;
}

interface Row {
  dayKey: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  /** Canonical category key, so legacy spellings add up with current ones. */
  category: string;
  note: string;
}

/* ----------------------------------------------------------- Date helpers */

const pad = (value: number) => String(value).padStart(2, "0");
const keyOf = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

const shiftMonth = (year: number, month: number, delta: number) => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

const dayNumber = (dayKey: string) => Math.round(Date.parse(`${dayKey}T12:00:00Z`) / 86_400_000);
const weekdayOf = (dayKey: string) => new Date(`${dayKey}T12:00:00Z`).getUTCDay();
const spanDays = (range: DayRange) => dayNumber(range.end) - dayNumber(range.start) + 1;

const fullDate = (dayKey: string) => `${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)}/${dayKey.slice(0, 4)}`;
const shortDate = (dayKey: string) => `${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)}`;

const rangeLabel = (range: DayRange, currentYear: number) =>
  Number(range.start.slice(0, 4)) === currentYear && Number(range.end.slice(0, 4)) === currentYear
    ? `${shortDate(range.start)} – ${shortDate(range.end)}`
    : `${fullDate(range.start)} – ${fullDate(range.end)}`;

/**
 * The period on screen and the one it is compared with. Periods run in whole
 * calendar months; one still in progress ends today, and the previous period
 * is cut to the same number of days, so eighteen days of September are held
 * against eighteen days of August rather than all thirty-one.
 */
const periodRange = (period: PeriodKey, today: string): PeriodRange => {
  const { year, month } = monthOfDay(today);
  const months = period === "3m" ? 3 : period === "6m" ? 6 : 1;
  const inProgress = period !== "last";
  const endMonth = inProgress ? { year, month } : shiftMonth(year, month, -1);
  const startMonth = shiftMonth(endMonth.year, endMonth.month, -(months - 1));
  const endDay = inProgress ? Number(today.slice(8, 10)) : daysInMonth(endMonth.month, endMonth.year);
  const previousStart = shiftMonth(startMonth.year, startMonth.month, -months);
  const previousEnd = shiftMonth(endMonth.year, endMonth.month, -months);
  const previousEndDays = daysInMonth(previousEnd.month, previousEnd.year);

  return {
    current: {
      start: keyOf(startMonth.year, startMonth.month, 1),
      end: keyOf(endMonth.year, endMonth.month, endDay),
    },
    previous: {
      start: keyOf(previousStart.year, previousStart.month, 1),
      end: keyOf(
        previousEnd.year,
        previousEnd.month,
        inProgress ? Math.min(endDay, previousEndDays) : previousEndDays,
      ),
    },
  };
};

/** First and last instant of a day in the user's timezone. */
const dayStartIso = (dayKey: string, timezoneOffsetMinutes: number) =>
  new Date(
    Date.UTC(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)) - 1, Number(dayKey.slice(8, 10))) +
      timezoneOffsetMinutes * 60_000,
  ).toISOString();

const dayEndIso = (dayKey: string, timezoneOffsetMinutes: number) =>
  new Date(
    Date.UTC(
      Number(dayKey.slice(0, 4)),
      Number(dayKey.slice(5, 7)) - 1,
      Number(dayKey.slice(8, 10)),
      23,
      59,
      59,
      999,
    ) +
      timezoneOffsetMinutes * 60_000,
  ).toISOString();

/* ------------------------------------------------------------ Local parts */

/** Column template shared by the header and rows of "Chi theo nhóm". */
const SHARE_COLUMNS =
  "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_8.5rem_3.25rem] 2xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_9rem_3.5rem]";

const ShareRow: React.FC<{
  meta: CategoryMeta;
  total: number;
  count: number;
  share: number;
  relative: number;
  overBudget: boolean;
}> = ({ meta, total, count, share, relative, overBudget }) => {
  const t = useT();
  const { isVietnamese } = useLocale();
  const name = isVietnamese ? meta.vi : meta.en;
  const shareLabel = share > 0 && share < 1 ? "<1%" : `${Math.round(share)}%`;

  // A phone gets name and figure on one line and the bar under them; from
  // `sm` up it is a ranked table: name, bar, amount, share.
  return (
    <div
      className={cn(
        "grid items-center gap-x-4 gap-y-2.5 py-3.5 first:pt-0 last:pb-0",
        SHARE_COLUMNS,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon meta={meta} size={36} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-medium leading-snug text-ledger-ink">{name}</span>
            {overBudget ? (
              <span className="whitespace-nowrap rounded-full bg-ledger-out-wash px-2 py-0.5 text-[12px] font-semibold text-ledger-out">
                {t("Vượt hạn mức", "Over budget")}
              </span>
            ) : null}
          </div>
          <p className="text-[13px] leading-snug text-ledger-muted">
            {t(`${count} khoản chi`, `${count} ${count === 1 ? "expense" : "expenses"}`)}
          </p>
        </div>
      </div>
      <div
        className="col-span-2 row-start-2 ml-12 h-2 overflow-hidden rounded-full bg-ledger-canvas sm:col-span-1 sm:row-start-auto sm:ml-0"
        title={`${name}: ${formatMoney(total)} · ${shareLabel}`}
      >
        <div
          className={cn("h-full rounded-full", overBudget ? "bg-ledger-out" : "bg-ledger-spend")}
          style={{ width: `${Math.max(relative, 1.5)}%` }}
        />
      </div>
      <div className="text-right">
        <Money amount={total} className="text-[15px] font-semibold" />
        <p className="ledger-num text-[13px] text-ledger-muted sm:hidden">{shareLabel}</p>
      </div>
      <span className="ledger-num hidden text-right text-[14px] font-medium text-ledger-ink-2 sm:block">
        {shareLabel}
      </span>
    </div>
  );
};

/** ▲ 20% in rose, ▼ 12% in green, "Mới" for a group that did not exist before. */
const ChangePill: React.FC<{ current: number; previous: number }> = ({ current, previous }) => {
  const t = useT();
  const change = previous > 0 ? ((current - previous) / previous) * 100 : null;
  const rounded = change === null ? 0 : Math.round(change);

  return (
    <span
      className={cn(
        "ledger-num inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[12.5px] font-semibold",
        change === null || rounded === 0
          ? "bg-ledger-canvas text-ledger-ink-2"
          : rounded > 0
            ? "bg-ledger-out-wash text-ledger-out"
            : "bg-ledger-in-wash text-ledger-in",
      )}
    >
      {change === null
        ? t("Mới", "New")
        : rounded === 0
          ? "0%"
          : `${rounded > 0 ? "▲" : "▼"} ${Math.abs(rounded)}%`}
    </span>
  );
};

/** Column template shared by the header and rows of "So với kỳ trước". */
const COMPARE_COLUMNS =
  "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_6rem] 2xl:grid-cols-[minmax(0,1fr)_10rem_10rem_6.5rem]";

const CompareRow: React.FC<{
  label: React.ReactNode;
  icon?: React.ReactNode;
  previous: number;
  current: number;
  total?: boolean;
}> = ({ label, icon, previous, current, total }) => (
  <div
    className={cn(
      "grid items-center gap-x-4 gap-y-1",
      COMPARE_COLUMNS,
      total ? "mt-1 rounded-[12px] bg-ledger-canvas px-3 py-3" : "py-3",
    )}
  >
    <div className="flex min-w-0 items-center gap-3">
      {icon}
      <span
        className={cn(
          "min-w-0 leading-snug text-ledger-ink",
          total ? "text-[14.5px] font-semibold" : "text-[15px] font-medium",
        )}
      >
        {label}
      </span>
    </div>
    <Money
      amount={previous}
      className="hidden text-right text-[14px] sm:block"
      tone="muted"
    />
    <Money
      amount={current}
      className="hidden text-right text-[14.5px] font-semibold sm:block"
    />
    <div className="text-right">
      <ChangePill current={current} previous={previous} />
    </div>
    {/* The two figures on their own line on a phone, before → now. */}
    <p className={cn("col-span-2 text-[13px] text-ledger-muted sm:hidden", icon ? "pl-11" : null)}>
      <Money amount={previous} tone="muted" /> →{" "}
      <Money amount={current} className="font-semibold" />
    </p>
  </div>
);

type ObservationTone = "rose" | "amber" | "green" | "neutral";

interface Observation {
  key: string;
  tone: ObservationTone;
  icon: LucideIcon;
  /** Drawn with the category's own icon instead of `icon` when set. */
  category?: CategoryMeta;
  headline: string;
  detail: string;
}

/**
 * One observation as its own tile, so four of them read as four separate
 * facts. The tile takes the tone's wash; the icon sits on paper inside it.
 */
const ObservationTile: React.FC<{ item: Observation }> = ({ item }) => {
  const Icon = item.icon;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-[14px] p-3.5 sm:p-4",
        item.tone === "rose" && "bg-ledger-out-wash",
        item.tone === "amber" && "bg-ledger-spend-wash",
        item.tone === "green" && "bg-ledger-in-wash",
        item.tone === "neutral" && "bg-ledger-canvas",
      )}
    >
      {item.category ? (
        <span className="shrink-0 rounded-full bg-ledger-paper">
          <CategoryIcon meta={item.category} size={36} />
        </span>
      ) : (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ledger-paper",
            item.tone === "rose" && "text-ledger-out",
            item.tone === "amber" && "text-ledger-spend",
            item.tone === "green" && "text-ledger-in",
            item.tone === "neutral" && "text-ledger-ink-2",
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug text-ledger-ink">{item.headline}</p>
        <p className="mt-1 text-[13px] leading-snug text-ledger-ink-2">{item.detail}</p>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------- Page */

const AnalyticsPage: React.FC = () => {
  const t = useT();
  const { isVietnamese, timezoneOffsetMinutes } = useLocale();
  const { toast } = useToast();
  const { dataVersion } = useLedger();

  const [period, setPeriod] = useState<PeriodKey>("month");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<MonthHistoryPoint[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);

  const today = todayKey(timezoneOffsetMinutes);
  const { month, year } = currentMonth(timezoneOffsetMinutes);
  const range = useMemo(() => periodRange(period, today), [period, today]);

  // One request covers both the period and the one it is compared with.
  useEffect(() => {
    let active = true;
    setLoading(true);

    (async () => {
      try {
        const response = await transactionApi.getTransactions(
          {
            startDate: dayStartIso(range.previous.start, timezoneOffsetMinutes),
            endDate: dayEndIso(range.current.end, timezoneOffsetMinutes),
            limit: FETCH_LIMIT,
            page: 1,
          },
          await getIdToken(),
        );
        if (!active) {
          return;
        }
        const list: Transaction[] = response?.data?.transactions || [];
        const total = toAmount(response?.data?.pagination?.total ?? response?.data?.total);
        setTransactions(list);
        setTruncated(total > list.length && list.length >= FETCH_LIMIT);
      } catch (error: any) {
        if (active) {
          setTransactions([]);
          toast({
            title: t("Không tải được số liệu", "Could not load the figures"),
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
  }, [dataVersion, range, t, timezoneOffsetMinutes, toast]);

  // The six-month chart and this month's budgets do not depend on the period.
  useEffect(() => {
    let active = true;

    (async () => {
      const token = await getIdToken().catch(() => "");
      if (!token) {
        return;
      }
      const [stats, summary] = await Promise.allSettled([
        userApi.getProfileStats(token),
        budgetApi.getBudgetSummary({ month, year }, token),
      ]);
      if (!active) {
        return;
      }
      setHistory(stats.status === "fulfilled" ? stats.value?.history || [] : []);
      setBudgets(summary.status === "fulfilled" ? summary.value?.items || [] : []);
    })();

    return () => {
      active = false;
    };
  }, [dataVersion, month, year]);

  // Transfers and anything scheduled or unfinished are not income or spending;
  // the shared predicate keeps this page agreeing with every other total.
  const rows = useMemo<Row[]>(
    () =>
      transactions.filter(isCashflowTransaction).map((transaction) => ({
        dayKey: calendarDay(transaction.date, timezoneOffsetMinutes),
        type: transaction.type as Row["type"],
        amount: toAmount(transaction.amount),
        category: getCategoryMeta(transaction.category).key || transaction.category,
        note: (transaction.note || "").trim(),
      })),
    [timezoneOffsetMinutes, transactions],
  );

  // Categories with a budget already past its limit this month. Only
  // meaningful when the page is looking at this month.
  const overBudget = useMemo(() => {
    const over = new Map<string, { spent: number; limit: number; wallet: string }>();
    budgets.forEach((budget) => {
      const spent = toAmount(budget.spent);
      const limit = toAmount(budget.amount);
      if (spent > limit) {
        over.set(getCategoryMeta(budget.category).key, {
          spent,
          limit,
          wallet: budget.walletId && budget.walletName ? budget.walletName : "",
        });
      }
    });
    return over;
  }, [budgets]);
  const showBudgets = period === "month";

  const analysis = useMemo(() => {
    const within = (range_: DayRange) =>
      rows.filter((row) => row.dayKey >= range_.start && row.dayKey <= range_.end);
    const current = within(range.current);
    const previous = within(range.previous);
    const total = (list: Row[], type: Row["type"]) =>
      list.filter((row) => row.type === type).reduce((sum, row) => sum + row.amount, 0);

    const byCategory = (list: Row[]) => {
      const map = new Map<string, { total: number; count: number }>();
      list
        .filter((row) => row.type === "EXPENSE")
        .forEach((row) => {
          const entry = map.get(row.category) || { total: 0, count: 0 };
          entry.total += row.amount;
          entry.count += 1;
          map.set(row.category, entry);
        });
      return map;
    };

    const income = total(current, "INCOME");
    const expense = total(current, "EXPENSE");
    const previousIncome = total(previous, "INCOME");
    const previousExpense = total(previous, "EXPENSE");
    const currentCategories = byCategory(current);
    const previousCategories = byCategory(previous);

    const categories = Array.from(currentCategories.entries())
      .map(([key, value]) => ({
        key,
        total: value.total,
        count: value.count,
        share: expense > 0 ? (value.total / expense) * 100 : 0,
        previous: previousCategories.get(key)?.total || 0,
      }))
      .sort((left, right) => right.total - left.total);

    const comparison = Array.from(
      new Set([...Array.from(currentCategories.keys()), ...Array.from(previousCategories.keys())]),
    )
      .map((key) => ({
        key,
        current: currentCategories.get(key)?.total || 0,
        previous: previousCategories.get(key)?.total || 0,
      }))
      .sort((left, right) => right.current - left.current || right.previous - left.previous)
      .slice(0, 8);

    const expenses = current.filter((row) => row.type === "EXPENSE");
    const byDay = new Map<string, { total: number; count: number }>();
    expenses.forEach((row) => {
      const entry = byDay.get(row.dayKey) || { total: 0, count: 0 };
      entry.total += row.amount;
      entry.count += 1;
      byDay.set(row.dayKey, entry);
    });
    const topDays = Array.from(byDay.entries())
      .map(([dayKey, value]) => ({ dayKey, ...value }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 3);

    const days = Math.max(spanDays(range.current), 1);
    const previousDays = Math.max(spanDays(range.previous), 1);

    let weekendDays = 0;
    for (let index = 0; index < days; index += 1) {
      const weekday = (weekdayOf(range.current.start) + index) % 7;
      if (weekday === 0 || weekday === 6) {
        weekendDays += 1;
      }
    }
    const weekendSpend = expenses
      .filter((row) => [0, 6].includes(weekdayOf(row.dayKey)))
      .reduce((sum, row) => sum + row.amount, 0);

    const largest = expenses.reduce<Row | null>(
      (best, row) => (!best || row.amount > best.amount ? row : best),
      null,
    );

    return {
      income,
      expense,
      net: income - expense,
      previousIncome,
      previousExpense,
      // Any row at all in the previous period, for the hero's "Kỳ trước" hints.
      hasPreviousRows: previous.length > 0,
      hasPrevious: previous.some((row) => row.type === "EXPENSE"),
      categories,
      comparison,
      expenseCount: expenses.length,
      topDays,
      days,
      perDay: expense / days,
      previousPerDay: previousExpense / previousDays,
      weekendDays,
      weekendSpend,
      largest,
    };
  }, [range, rows]);

  /**
   * "Đáng chú ý": each item is a plain fact read off the rows above, and only
   * appears when the data is there to back it. Nothing is estimated.
   */
  const observations = useMemo<Observation[]>(() => {
    const list: Observation[] = [];
    const label = (key: string) => {
      const meta = getCategoryMeta(key);
      return isVietnamese ? meta.vi : meta.en;
    };
    const decimal = (value: number) =>
      value.toFixed(1).replace(/\.0$/, "").replace(".", isVietnamese ? "," : ".");

    if (showBudgets && overBudget.size) {
      const entries = Array.from(overBudget.entries());
      const [firstKey, first] = entries[0];
      list.push({
        key: "budget",
        tone: "rose",
        icon: TriangleAlert,
        headline:
          entries.length === 1
            ? t(
                `${label(firstKey)} đã vượt hạn mức ${formatMoney(first.spent - first.limit)}`,
                `${label(firstKey)} is ${formatMoney(first.spent - first.limit)} over budget`,
              )
            : t(`${entries.length} ngân sách đã vượt hạn mức`, `${entries.length} budgets are over their limit`),
        detail:
          entries.length === 1
            ? t(
                `Đã chi ${formatMoney(first.spent)} trên hạn mức ${formatMoney(first.limit)}${first.wallet ? ` (ví ${first.wallet})` : ""}. Các khoản vẫn được ghi bình thường.`,
                `${formatMoney(first.spent)} spent against ${formatMoney(first.limit)}${first.wallet ? ` (${first.wallet})` : ""}. Everything is still recorded.`,
              )
            : entries
                .map(([key, value]) =>
                  t(
                    `${label(key)} vượt ${formatMoney(value.spent - value.limit)}`,
                    `${label(key)} ${formatMoney(value.spent - value.limit)} over`,
                  ),
                )
                .join(" · "),
      });
    }

    if (analysis.hasPrevious) {
      // The category that grew the most in money, among those that already
      // existed last period: a brand new category has no "growth" to speak of.
      const grown = analysis.categories
        .filter((item) => item.previous > 0 && item.total > item.previous * 1.15)
        .sort((left, right) => right.total - right.previous - (left.total - left.previous))[0];
      if (grown) {
        const growth = Math.round(((grown.total - grown.previous) / grown.previous) * 100);
        list.push({
          key: "growth",
          tone: "amber",
          icon: TrendingUp,
          headline: t(
            `${label(grown.key)} tăng ${growth}% so với kỳ trước`,
            `${label(grown.key)} is up ${growth}% on the previous period`,
          ),
          detail: t(
            `${formatMoney(grown.previous)} → ${formatMoney(grown.total)}, nhiều hơn ${formatMoney(grown.total - grown.previous)}.`,
            `${formatMoney(grown.previous)} → ${formatMoney(grown.total)}, ${formatMoney(grown.total - grown.previous)} more.`,
          ),
        });
      } else if (analysis.previousExpense > 0) {
        const change = ((analysis.expense - analysis.previousExpense) / analysis.previousExpense) * 100;
        if (Math.abs(change) >= 10) {
          list.push({
            key: "total-change",
            tone: change < 0 ? "green" : "amber",
            icon: change < 0 ? TrendingDown : TrendingUp,
            headline:
              change < 0
                ? t(`Tổng chi giảm ${Math.round(-change)}% so với kỳ trước`, `Spending is down ${Math.round(-change)}%`)
                : t(`Tổng chi tăng ${Math.round(change)}% so với kỳ trước`, `Spending is up ${Math.round(change)}%`),
            detail: t(
              `${formatMoney(analysis.previousExpense)} → ${formatMoney(analysis.expense)} trong cùng số ngày.`,
              `${formatMoney(analysis.previousExpense)} → ${formatMoney(analysis.expense)} over the same number of days.`,
            ),
          });
        }
      }
    }

    // Weekend against weekday spending, per day so a month with five weekends
    // is not compared unfairly with one that has four.
    const weekdays = analysis.days - analysis.weekendDays;
    if (analysis.expenseCount >= 5 && analysis.weekendDays >= 2 && weekdays >= 2 && analysis.expense > 0) {
      const perWeekend = analysis.weekendSpend / analysis.weekendDays;
      const perWeekday = (analysis.expense - analysis.weekendSpend) / weekdays;
      const share = Math.round((analysis.weekendSpend / analysis.expense) * 100);
      const dayShare = `${analysis.weekendDays}/${analysis.days}`;
      if (perWeekday > 0 && perWeekend >= perWeekday * 1.5) {
        list.push({
          key: "weekend",
          tone: "neutral",
          icon: CalendarDays,
          headline: t(
            `Mỗi ngày cuối tuần tốn gấp ${decimal(perWeekend / perWeekday)} lần ngày thường`,
            `A weekend day costs ${decimal(perWeekend / perWeekday)}× a weekday`,
          ),
          detail: t(
            `Thứ Bảy và Chủ nhật chiếm ${share}% tiền chi, dù chỉ là ${dayShare} ngày trong kỳ.`,
            `Saturdays and Sundays took ${share}% of spending while being ${dayShare} days of the period.`,
          ),
        });
      } else if (perWeekend <= perWeekday * 0.5) {
        list.push({
          key: "weekend",
          tone: "neutral",
          icon: CalendarDays,
          headline: t("Cuối tuần chi ít hơn hẳn ngày thường", "Weekends cost far less than weekdays"),
          detail: t(
            `Thứ Bảy và Chủ nhật chỉ chiếm ${share}% tiền chi, trong khi là ${dayShare} ngày của kỳ.`,
            `Saturdays and Sundays took only ${share}% of spending while being ${dayShare} days of the period.`,
          ),
        });
      }
    }

    const frequent = [...analysis.categories].sort((left, right) => right.count - left.count)[0];
    if (frequent && frequent.count >= 3) {
      list.push({
        key: "frequent",
        tone: "neutral",
        icon: ReceiptText,
        category: getCategoryMeta(frequent.key),
        headline: t(
          `${label(frequent.key)}: ${frequent.count} lần trong kỳ`,
          `${label(frequent.key)}: ${frequent.count} times this period`,
        ),
        detail: t(
          `Tổng ${formatMoney(frequent.total)}, trung bình ${formatMoney(Math.round(frequent.total / frequent.count))} mỗi lần.`,
          `${formatMoney(frequent.total)} in total, ${formatMoney(Math.round(frequent.total / frequent.count))} each on average.`,
        ),
      });
    }

    const largest = analysis.largest;
    if (largest && analysis.expenseCount >= 3 && largest.amount >= analysis.expense * 0.25) {
      const share = Math.round((largest.amount / analysis.expense) * 100);
      list.push({
        key: "largest",
        tone: "neutral",
        icon: ReceiptText,
        headline: t(
          `Khoản lớn nhất: ${largest.note || label(largest.category)}`,
          `Largest expense: ${largest.note || label(largest.category)}`,
        ),
        detail: t(
          `${formatMoney(largest.amount)} · ${label(largest.category)} · ${shortDate(largest.dayKey)}, bằng ${share}% tổng chi của kỳ.`,
          `${formatMoney(largest.amount)} · ${label(largest.category)} · ${shortDate(largest.dayKey)}, ${share}% of the period's spending.`,
        ),
      });
    }

    return list.slice(0, 4);
  }, [analysis, isVietnamese, overBudget, showBudgets, t]);

  const currentYear = Number(today.slice(0, 4));
  const rate = analysis.income > 0 ? (analysis.net / analysis.income) * 100 : null;
  const roundedRate = rate === null ? 0 : Math.round(Math.abs(rate));

  const periodName =
    period === "month"
      ? monthLabel(month, year, isVietnamese)
      : period === "last"
        ? monthLabel(shiftMonth(year, month, -1).month, shiftMonth(year, month, -1).year, isVietnamese)
        : period === "3m"
          ? t("3 tháng", "3 months")
          : t("6 tháng", "6 months");

  const chartData = history.map((point) => ({
    label: point.month.replace(/^Th/, isVietnamese ? "T" : "M"),
    income: toAmount(point.income),
    expense: toAmount(point.expense),
  }));

  const maxShare = analysis.categories[0]?.total || 0;

  const observationsSection = (
    <Section
      icon={Lightbulb}
      meta={!loading && observations.length ? String(observations.length) : undefined}
      subtitle={t("Rút ra từ các khoản trong kỳ", "Read off this period's entries")}
      title={t("Đáng chú ý", "Worth noticing")}
      tone="spend"
    >
      {loading ? (
        <SkeletonRows rows={3} />
      ) : observations.length ? (
        <div className="space-y-2.5">
          {observations.map((item) => (
            <ObservationTile item={item} key={item.key} />
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-ledger-ink-2">
          {analysis.expenseCount
            ? t(
                "Kỳ này chưa có gì nổi bật để nêu ra. Số liệu vẫn nằm đầy đủ ở các mục bên cạnh.",
                "Nothing in this period stands out. The full figures are alongside.",
              )
            : t(
                "Chưa có khoản chi nào trong kỳ này nên chưa có gì để nhận xét.",
                "No spending in this period yet, so there is nothing to point out.",
              )}
        </p>
      )}
    </Section>
  );

  // Not tied to the period picker, so it says so in its subtitle.
  const chartSection = chartData.length ? (
    <Section
      action={<ChartLegend />}
      icon={ChartColumn}
      subtitle={t("Luôn là 6 tháng gần nhất", "Always the latest six months")}
      title={t("Thu chi 6 tháng", "Last 6 months")}
    >
      <IncomeExpenseBars data={chartData} height={220} />
    </Section>
  ) : null;

  const perDayChange =
    analysis.hasPrevious && analysis.previousPerDay > 0
      ? ((analysis.perDay - analysis.previousPerDay) / analysis.previousPerDay) * 100
      : null;
  const spentShareOfIncome = analysis.income > 0 ? (analysis.expense / analysis.income) * 100 : 0;
  const previousHint = (amount: number) =>
    !loading && analysis.hasPreviousRows
      ? t(`Kỳ trước: ${formatMoney(amount)}`, `Before: ${formatMoney(amount)}`)
      : undefined;

  return (
    <div>
      <PageHeader
        actions={
          // On the grey page a bare segmented track all but disappears, so
          // it sits on a paper card like every other control group.
          <div className="w-full rounded-[14px] border border-ledger-line bg-ledger-paper p-1 shadow-card sm:w-auto">
            <Segmented
              // Four labels have to share a 358px phone row; tighter padding
              // keeps "Tháng trước" on one line.
              className="w-full sm:w-auto [&>button]:whitespace-nowrap [&>button]:px-2.5 sm:[&>button]:px-3.5"
              onChange={setPeriod}
              options={[
                { value: "month", label: t("Tháng này", "This month") },
                { value: "last", label: t("Tháng trước", "Last month") },
                { value: "3m", label: t("3 tháng", "3 months") },
                { value: "6m", label: t("6 tháng", "6 months") },
              ]}
              value={period}
            />
          </div>
        }
        subtitle={<span className="ledger-num">{`${fullDate(range.current.start)} – ${fullDate(range.current.end)}`}</span>}
        title={t("Phân tích", "Analytics")}
      />

      <HeroStrip
        caption={
          loading
            ? null
            : rate === null
              ? analysis.expense > 0
                ? t(
                    `Kỳ này chưa ghi khoản thu nào nên chưa tính được tỷ lệ. Đã chi ${formatMoney(analysis.expense)}.`,
                    `No income is recorded in this period, so there is no rate to show. ${formatMoney(analysis.expense)} went out.`,
                  )
                : t(
                    "Kỳ này chưa ghi khoản thu nào nên chưa tính được tỷ lệ tiết kiệm.",
                    "No income is recorded in this period, so there is no saving rate yet.",
                  )
              : analysis.net >= 0
                ? t(
                    `Bạn giữ lại ${formatMoney(analysis.net)} trong ${formatMoney(analysis.income)} thu được.`,
                    `You kept ${formatMoney(analysis.net)} of the ${formatMoney(analysis.income)} that came in.`,
                  )
                : t(
                    `Bạn chi nhiều hơn thu ${formatMoney(Math.abs(analysis.net))} trong kỳ này.`,
                    `You spent ${formatMoney(Math.abs(analysis.net))} more than came in.`,
                  )
        }
        icon={PiggyBank}
        label={t("Tỷ lệ tiết kiệm", "Saving rate")}
        stats={[
          // A zero is not good or bad news, so it is not coloured as either.
          {
            label: t("Thu", "In"),
            icon: ArrowDownLeft,
            tone: "in",
            value: <Money amount={analysis.income} signed tone={analysis.income > 0 ? "in" : "muted"} />,
            hint: previousHint(analysis.previousIncome),
          },
          {
            label: t("Chi", "Out"),
            icon: ArrowUpRight,
            tone: "out",
            value: <Money amount={analysis.expense} tone={analysis.expense > 0 ? "out" : "muted"} />,
            hint: previousHint(analysis.previousExpense),
          },
          {
            label: t("Chênh lệch", "Net"),
            icon: Scale,
            tone: "accent",
            value: <Money amount={analysis.net} signed tone={analysis.net < 0 ? "out" : "neutral"} />,
            hint: previousHint(analysis.previousIncome - analysis.previousExpense),
          },
          // Total spending over the period's days; the pill compares it with
          // the previous period's own per-day figure.
          {
            label: t("Chi mỗi ngày", "Per day"),
            icon: Gauge,
            tone: "spend",
            value: (
              <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:justify-start">
                <Money amount={Math.round(analysis.perDay)} tone={analysis.perDay > 0 ? "neutral" : "muted"} />
                {!loading && perDayChange !== null && Math.abs(perDayChange) >= 1 ? (
                  <ChangePill current={analysis.perDay} previous={analysis.previousPerDay} />
                ) : null}
              </span>
            ),
            hint: loading
              ? undefined
              : perDayChange !== null
                ? t(
                    `Kỳ trước: ${formatMoney(Math.round(analysis.previousPerDay))}`,
                    `Before: ${formatMoney(Math.round(analysis.previousPerDay))}`,
                  )
                : t(`Chia cho ${analysis.days} ngày của kỳ`, `Over ${analysis.days} days`),
          },
        ]}
        value={
          loading ? (
            <span className="text-ledger-line-strong">—</span>
          ) : rate === null ? (
            // Not 0%: with nothing earned there is no rate, and saying 0 would
            // read as "you saved nothing".
            <span className="text-ledger-muted">—</span>
          ) : (
            <span className={cn("ledger-num", rate < 0 && roundedRate > 0 ? "text-ledger-out" : "text-ledger-ink")}>
              {rate < 0 && roundedRate > 0 ? "−" : ""}
              {roundedRate}%
            </span>
          )
        }
      >
        {/* How much of what came in went out again: the track fills amber
            near the whole of it and rose past it. */}
        {!loading && analysis.income > 0 ? (
          <div>
            <Track percent={spentShareOfIncome} />
            <p className="ledger-num mt-2 text-[13px] text-ledger-muted">
              {t(
                `Đã chi ${Math.round(spentShareOfIncome)}% số thu · ${formatMoney(analysis.expense)} / ${formatMoney(analysis.income)}`,
                `${Math.round(spentShareOfIncome)}% of income spent · ${formatMoney(analysis.expense)} / ${formatMoney(analysis.income)}`,
              )}
            </p>
          </div>
        ) : null}
      </HeroStrip>

      {truncated ? (
        <Notice className="mt-3 sm:mt-4 xl:mt-5" icon={Info} tone="muted">
          {t(
            `Khoảng này có hơn ${formatAmountInput(FETCH_LIMIT)} giao dịch; số liệu chỉ tính ${formatAmountInput(FETCH_LIMIT)} giao dịch mới nhất.`,
            `This range has more than ${FETCH_LIMIT} transactions; only the latest ${FETCH_LIMIT} are counted.`,
          )}
        </Notice>
      ) : null}

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:mt-5 xl:grid-cols-12 xl:gap-5">
        <div className="min-w-0 space-y-3 sm:space-y-4 xl:col-span-8 xl:space-y-5">
          {/* Below xl the observations come first: they are the summary the
              rest of the page backs up. */}
          <div className="xl:hidden">{observationsSection}</div>

          <Section
            icon={ChartPie}
            meta={!loading && analysis.categories.length ? String(analysis.categories.length) : undefined}
            subtitle={
              loading || !analysis.expense ? (
                periodName
              ) : (
                <>
                  {periodName} ·{" "}
                  <span className="ledger-num">
                    {t(`tổng ${formatMoney(analysis.expense)}`, `${formatMoney(analysis.expense)} in total`)}
                  </span>
                </>
              )
            }
            title={t("Chi theo nhóm", "Spending by group")}
            tone="spend"
          >
            {loading ? (
              <SkeletonRows rows={4} />
            ) : analysis.categories.length ? (
              <>
                <div
                  className={cn(
                    "mb-3 hidden items-center gap-x-4 rounded-[10px] bg-ledger-canvas px-3 py-2 sm:-mx-3 sm:grid",
                    SHARE_COLUMNS,
                  )}
                >
                  <Eyebrow>{t("Nhóm", "Group")}</Eyebrow>
                  <Eyebrow>{t("So với nhóm lớn nhất", "Against the largest")}</Eyebrow>
                  <Eyebrow className="text-right">{t("Số tiền", "Amount")}</Eyebrow>
                  <Eyebrow className="text-right">{t("Tỷ lệ", "Share")}</Eyebrow>
                </div>
                <div className="divide-y divide-ledger-line">
                  {analysis.categories.map((item) => (
                    <ShareRow
                      count={item.count}
                      key={item.key}
                      meta={getCategoryMeta(item.key)}
                      overBudget={showBudgets && overBudget.has(item.key)}
                      relative={maxShare > 0 ? (item.total / maxShare) * 100 : 0}
                      share={item.share}
                      total={item.total}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[14px] text-ledger-ink-2">
                {t("Chưa có khoản chi nào trong kỳ này.", "No spending in this period.")}
              </p>
            )}
          </Section>

          <Section
            icon={History}
            subtitle={
              <>
                <span className="ledger-num">{rangeLabel(range.previous, currentYear)}</span>
                {t(" so với ", " against ")}
                <span className="ledger-num">{rangeLabel(range.current, currentYear)}</span>
              </>
            }
            title={t("So với kỳ trước", "Against the previous period")}
          >
            {loading ? (
              <SkeletonRows rows={3} />
            ) : !analysis.hasPrevious ? (
              <p className="text-[14px] text-ledger-ink-2">
                {t(
                  "Kỳ trước chưa ghi khoản chi nào nên chưa có gì để so sánh.",
                  "Nothing was spent in the previous period, so there is nothing to compare with.",
                )}
              </p>
            ) : (
              <>
                <div
                  className={cn(
                    "mb-1 hidden items-center gap-x-4 rounded-[10px] bg-ledger-canvas px-3 py-2 sm:-mx-3 sm:grid",
                    COMPARE_COLUMNS,
                  )}
                >
                  <Eyebrow>{t("Nhóm", "Group")}</Eyebrow>
                  <Eyebrow className="text-right">{t("Kỳ trước", "Before")}</Eyebrow>
                  <Eyebrow className="text-right">{t("Kỳ này", "Now")}</Eyebrow>
                  <Eyebrow className="text-right">{t("Thay đổi", "Change")}</Eyebrow>
                </div>
                <div className="divide-y divide-ledger-line">
                  {analysis.comparison.map((item) => {
                    const meta = getCategoryMeta(item.key);
                    return (
                      <CompareRow
                        current={item.current}
                        icon={<CategoryIcon meta={meta} size={32} />}
                        key={item.key}
                        label={isVietnamese ? meta.vi : meta.en}
                        previous={item.previous}
                      />
                    );
                  })}
                </div>
                <div className="sm:-mx-3">
                  <CompareRow
                    current={analysis.expense}
                    label={t("Tổng chi", "Total spent")}
                    previous={analysis.previousExpense}
                    total
                  />
                </div>
              </>
            )}
          </Section>
        </div>

        {/* The busiest days and the chart side by side from md to xl, one
            column beside the main one from xl up. */}
        <div className="grid min-w-0 content-start gap-3 sm:gap-4 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1 xl:gap-5">
          <div className="hidden xl:block">{observationsSection}</div>

          <Section
            icon={CalendarDays}
            subtitle={t("Ba ngày tiêu nhiều nhất trong kỳ", "The three costliest days")}
            title={t("Ngày chi nhiều nhất", "Biggest spending days")}
            tone="out"
          >
            {loading ? (
              <SkeletonRows rows={3} />
            ) : analysis.topDays.length ? (
              <div className="divide-y divide-ledger-line">
                {analysis.topDays.map((day, index) => (
                  <div
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    key={day.dayKey}
                  >
                    <span className="ledger-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ledger-canvas text-[13px] font-semibold text-ledger-ink-2">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="ledger-num text-[15px] font-medium text-ledger-ink">
                        {dayGroupLabel(day.dayKey, timezoneOffsetMinutes, isVietnamese)}
                      </p>
                      <p className="text-[13px] text-ledger-muted">
                        {t(`${day.count} khoản chi`, `${day.count} ${day.count === 1 ? "expense" : "expenses"}`)}
                        {analysis.expense > 0
                          ? ` · ${Math.round((day.total / analysis.expense) * 100)}% ${t("tổng chi", "of spending")}`
                          : ""}
                      </p>
                    </div>
                    <Money amount={day.total} className="shrink-0 text-[15px] font-semibold" tone="out" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-ledger-ink-2">
                {t("Chưa có ngày nào có khoản chi.", "No spending days yet.")}
              </p>
            )}
          </Section>

          {/* The six-month chart comes last: it does not change with the
              period, so the period's own figures go first. */}
          {chartSection ? <div className="min-w-0">{chartSection}</div> : null}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
