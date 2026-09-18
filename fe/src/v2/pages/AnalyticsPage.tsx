import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Info,
  ReceiptText,
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

const ShareRow: React.FC<{
  meta: CategoryMeta;
  total: number;
  share: number;
  relative: number;
  overBudget: boolean;
}> = ({ meta, total, share, relative, overBudget }) => {
  const t = useT();
  const { isVietnamese } = useLocale();

  // Mobile: name and figure on one line, the bar full width beneath. From
  // `sm` up the three sit in one row like a ranked table.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-ledger-line py-3.5 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)_170px]">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[14.5px] text-ledger-ink">{isVietnamese ? meta.vi : meta.en}</span>
        {overBudget ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-ledger-out-wash px-2 py-0.5 text-[11px] font-semibold text-ledger-out">
            {t("Vượt hạn mức", "Over budget")}
          </span>
        ) : null}
      </div>
      <div className="col-span-2 row-start-2 h-2 overflow-hidden rounded-full bg-ledger-canvas sm:col-span-1 sm:row-start-auto">
        <div
          className={cn("h-full rounded-full", overBudget ? "bg-ledger-out" : "bg-ledger-spend")}
          style={{ width: `${Math.max(relative, 1.5)}%` }}
        />
      </div>
      <div className="text-right text-[14px]">
        <Money amount={total} className="font-semibold" />
        <span className="ledger-num ml-1.5 inline-block w-[42px] text-left text-[12.5px] text-ledger-muted">
          · {Math.round(share)}%
        </span>
      </div>
    </div>
  );
};

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

const ObservationRow: React.FC<{ item: Observation }> = ({ item }) => {
  const Icon = item.icon;

  return (
    <div className="flex gap-3 border-b border-ledger-line py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      {item.category ? (
        <CategoryIcon meta={item.category} size={38} />
      ) : (
        <span
          className={cn(
            "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full",
            item.tone === "rose" && "bg-ledger-out-wash text-ledger-out",
            item.tone === "amber" && "bg-ledger-spend-wash text-ledger-spend",
            item.tone === "green" && "bg-ledger-in-wash text-ledger-in",
            item.tone === "neutral" && "bg-ledger-canvas text-ledger-ink-2",
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold leading-snug text-ledger-ink">{item.headline}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ledger-ink-2">{item.detail}</p>
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
      previousExpense,
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
    <Section title={t("Đáng chú ý", "Worth noticing")}>
      {loading ? (
        <SkeletonRows rows={3} />
      ) : observations.length ? (
        <div>
          {observations.map((item) => (
            <ObservationRow item={item} key={item.key} />
          ))}
        </div>
      ) : (
        <p className="text-[13.5px] text-ledger-ink-2">
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

  const perDayChange =
    analysis.hasPrevious && analysis.previousPerDay > 0
      ? ((analysis.perDay - analysis.previousPerDay) / analysis.previousPerDay) * 100
      : null;

  return (
    <div>
      <PageHeader
        actions={
          <Segmented
            // Four labels have to share a 358px phone row; tighter padding
            // keeps "Tháng trước" on one line.
            className="w-full sm:w-auto [&>button]:whitespace-nowrap [&>button]:px-2.5 sm:[&>button]:px-3"
            onChange={setPeriod}
            options={[
              { value: "month", label: t("Tháng này", "This month") },
              { value: "last", label: t("Tháng trước", "Last month") },
              { value: "3m", label: t("3 tháng", "3 months") },
              { value: "6m", label: t("6 tháng", "6 months") },
            ]}
            value={period}
          />
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
        label={t("Tỷ lệ tiết kiệm", "Saving rate")}
        stats={[
          // A zero is not good or bad news, so it is not coloured as either.
          {
            label: t("Thu", "In"),
            value: <Money amount={analysis.income} signed tone={analysis.income > 0 ? "in" : "muted"} />,
          },
          {
            label: t("Chi", "Out"),
            value: <Money amount={analysis.expense} tone={analysis.expense > 0 ? "out" : "muted"} />,
          },
          {
            label: t("Chênh lệch", "Net"),
            value: <Money amount={analysis.net} signed tone={analysis.net < 0 ? "out" : "neutral"} />,
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
      />

      {truncated ? (
        <Notice className="mt-4" icon={Info} tone="muted">
          {t(
            `Khoảng này có hơn ${formatAmountInput(FETCH_LIMIT)} giao dịch; số liệu chỉ tính ${formatAmountInput(FETCH_LIMIT)} giao dịch mới nhất.`,
            `This range has more than ${FETCH_LIMIT} transactions; only the latest ${FETCH_LIMIT} are counted.`,
          )}
        </Notice>
      ) : null}

      <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {/* On a phone the observations come first: they are the summary
              the rest of the page backs up. */}
          <div className="lg:hidden">{observationsSection}</div>

          {chartData.length ? (
            <Section action={<ChartLegend />} title={t("Thu chi 6 tháng", "Last 6 months")}>
              <IncomeExpenseBars data={chartData} />
            </Section>
          ) : null}

          <Section
            action={<span className="text-[12.5px] text-ledger-muted">{periodName}</span>}
            title={t("Chi theo nhóm", "Spending by group")}
          >
            {loading ? (
              <SkeletonRows rows={4} />
            ) : analysis.categories.length ? (
              <div>
                {analysis.categories.map((item) => (
                  <ShareRow
                    key={item.key}
                    meta={getCategoryMeta(item.key)}
                    overBudget={showBudgets && overBudget.has(item.key)}
                    relative={maxShare > 0 ? (item.total / maxShare) * 100 : 0}
                    share={item.share}
                    total={item.total}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[13.5px] text-ledger-ink-2">
                {t("Chưa có khoản chi nào trong kỳ này.", "No spending in this period.")}
              </p>
            )}
          </Section>

          <Section
            bare
            className="border-b border-ledger-line lg:border-b-0"
            title={t("So với kỳ trước", "Against the previous period")}
          >
            <p className="-mt-1 mb-3 text-[12.5px] text-ledger-muted">
              <span className="ledger-num">{rangeLabel(range.previous, currentYear)}</span>
              {t(" so với ", " against ")}
              <span className="ledger-num">{rangeLabel(range.current, currentYear)}</span>
            </p>
            {loading ? (
              <SkeletonRows rows={3} />
            ) : !analysis.hasPrevious ? (
              <p className="text-[13.5px] text-ledger-ink-2">
                {t(
                  "Kỳ trước chưa ghi khoản chi nào nên chưa có gì để so sánh.",
                  "Nothing was spent in the previous period, so there is nothing to compare with.",
                )}
              </p>
            ) : (
              <table className="w-full table-fixed text-[13px] sm:text-[13.5px]">
                <thead>
                  <tr className="border-b border-ledger-line">
                    <th className="pb-2 text-left font-normal">
                      <Eyebrow>{t("Nhóm", "Group")}</Eyebrow>
                    </th>
                    <th className="w-[86px] whitespace-nowrap pb-2 text-right font-normal sm:w-[140px]">
                      <Eyebrow>{t("Kỳ trước", "Before")}</Eyebrow>
                    </th>
                    <th className="w-[86px] whitespace-nowrap pb-2 text-right font-normal sm:w-[140px]">
                      <Eyebrow>{t("Kỳ này", "Now")}</Eyebrow>
                    </th>
                    <th className="w-[74px] whitespace-nowrap pb-2 text-right font-normal sm:w-[100px]">
                      <Eyebrow>{t("Thay đổi", "Change")}</Eyebrow>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.comparison.map((item) => {
                    const meta = getCategoryMeta(item.key);
                    const change = item.previous > 0 ? ((item.current - item.previous) / item.previous) * 100 : null;
                    return (
                      <tr className="border-b border-ledger-line last:border-b-0" key={item.key}>
                        <td className="truncate py-3 pr-2 text-ledger-ink">{isVietnamese ? meta.vi : meta.en}</td>
                        <td className="py-3 text-right">
                          <Money amount={item.previous} tone="muted" />
                        </td>
                        <td className="py-3 text-right">
                          <Money amount={item.current} className="font-semibold" />
                        </td>
                        <td
                          className={cn(
                            "ledger-num py-3 text-right text-[12.5px] font-semibold",
                            change === null || Math.round(change) === 0
                              ? "text-ledger-muted"
                              : change > 0
                                ? "text-ledger-out"
                                : "text-ledger-in",
                          )}
                        >
                          {change === null
                            ? t("Mới", "New")
                            : Math.round(change) === 0
                              ? "0%"
                              : `${change > 0 ? "▲" : "▼"} ${Math.abs(Math.round(change))}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        <aside className="min-w-0 lg:border-l lg:border-ledger-line lg:pl-8">
          <div className="hidden lg:block">{observationsSection}</div>

          <Section title={t("Ngày chi nhiều nhất", "Biggest spending days")}>
            {loading ? (
              <SkeletonRows rows={3} />
            ) : analysis.topDays.length ? (
              <div>
                {analysis.topDays.map((day) => (
                  <div
                    className="flex items-center justify-between gap-3 border-b border-ledger-line py-3 first:pt-0 last:border-b-0 last:pb-0"
                    key={day.dayKey}
                  >
                    <div className="min-w-0">
                      <p className="ledger-num text-[14px] text-ledger-ink">
                        {dayGroupLabel(day.dayKey, timezoneOffsetMinutes, isVietnamese)}
                      </p>
                      <p className="text-[12px] text-ledger-muted">
                        {t(`${day.count} khoản chi`, `${day.count} ${day.count === 1 ? "expense" : "expenses"}`)}
                      </p>
                    </div>
                    <Money amount={day.total} className="text-[14.5px] font-semibold" tone="out" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13.5px] text-ledger-ink-2">
                {t("Chưa có ngày nào có khoản chi.", "No spending days yet.")}
              </p>
            )}
          </Section>

          <Section bare title={t("Trung bình mỗi ngày", "Daily average")}>
            {loading ? (
              <SkeletonRows rows={1} />
            ) : (
              <>
                <Money
                  amount={Math.round(analysis.perDay)}
                  className="text-[30px] font-semibold leading-none tracking-[-0.02em]"
                />
                <p className="mt-2 text-[13px] text-ledger-ink-2">
                  {perDayChange !== null && Math.abs(perDayChange) >= 1
                    ? perDayChange < 0
                      ? t(
                          `Thấp hơn kỳ trước khoảng ${Math.round(-perDayChange)}% (${formatMoney(Math.round(analysis.previousPerDay))} mỗi ngày).`,
                          `About ${Math.round(-perDayChange)}% lower than before (${formatMoney(Math.round(analysis.previousPerDay))} a day).`,
                        )
                      : t(
                          `Cao hơn kỳ trước khoảng ${Math.round(perDayChange)}% (${formatMoney(Math.round(analysis.previousPerDay))} mỗi ngày).`,
                          `About ${Math.round(perDayChange)}% higher than before (${formatMoney(Math.round(analysis.previousPerDay))} a day).`,
                        )
                    : t(
                        `Tổng chi chia cho ${analysis.days} ngày của kỳ.`,
                        `Total spending over the ${analysis.days} days of the period.`,
                      )}
                </p>
              </>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
};

export default AnalyticsPage;
