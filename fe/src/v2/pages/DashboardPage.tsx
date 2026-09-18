import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  ChartColumn,
  ChartPie,
  Minus,
  PiggyBank,
  Plus,
  ReceiptText,
  Target,
  Wallet as WalletIcon,
} from "lucide-react";
import {
  budgetApi,
  configApi,
  goalApi,
  transactionApi,
  userApi,
  walletApi,
} from "services/api";
import { useAuth } from "contexts/AuthContext";
import { useLocale } from "contexts/LocaleContext";
import { ChartLegend, IncomeExpenseBars } from "../components/BarChart";
import { BudgetTrackRow, WalletRow } from "../components/finance";
import {
  Button,
  HeroStrip,
  Money,
  PageHeader,
  Ring,
  Section,
  SkeletonRows,
  TextLink,
  Track,
} from "../components/primitives";
import { TimelineDayGroup } from "../components/timeline";
import { useLedger } from "../LedgerContext";
import {
  currentMonth,
  daysLeftInMonth,
  formatMoney,
  longToday,
  todayKey,
} from "../lib/format";
import { useT } from "../lib/i18n";
import { getIdToken } from "../lib/session";
import { buildTimeline } from "../lib/timeline";
import {
  toAmount,
  type BudgetSummary,
  type Goal,
  type ProfileStats,
  type Transaction,
  type Wallet,
} from "../lib/types";

interface DashboardData {
  wallets: Wallet[];
  totalBalance: number;
  budget: BudgetSummary | null;
  transactions: Transaction[];
  goals: Goal[];
  stats: ProfileStats | null;
  reminder: { enabled: boolean; times: string[] } | null;
}

const EMPTY: DashboardData = {
  wallets: [],
  totalBalance: 0,
  budget: null,
  transactions: [],
  goals: [],
  stats: null,
  reminder: null,
};

const settledValue = <T,>(result: PromiseSettledResult<T>) =>
  result.status === "fulfilled" ? result.value : null;

const DashboardPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isVietnamese, timezoneOffsetMinutes } = useLocale();
  const { dataVersion, openQuickAdd } = useLedger();
  const { month, year } = currentMonth(timezoneOffsetMinutes);

  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const token = await getIdToken();
        // Each block renders from whatever arrived; one slow or failing
        // endpoint should not blank the whole overview.
        const [wallets, budget, transactions, goals, stats, config] =
          await Promise.allSettled([
            walletApi.getWallets(token),
            budgetApi.getBudgetSummary({ month, year }, token),
            transactionApi.getTransactions({ page: 1, limit: 12 }, token),
            goalApi.getGoals(token),
            userApi.getProfileStats(token),
            configApi.getConfig(token),
          ]);

        if (!active) {
          return;
        }

        const walletResponse = settledValue(wallets);
        const configResponse = settledValue(config);
        setData({
          wallets: walletResponse?.wallets || [],
          totalBalance: toAmount(walletResponse?.totalBalance),
          budget: settledValue(budget),
          transactions: settledValue(transactions)?.data?.transactions || [],
          goals: settledValue(goals) || [],
          stats: settledValue(stats),
          reminder: configResponse
            ? {
                enabled: Boolean(configResponse.remindersEnabled),
                times: configResponse.reminderTimes || [],
              }
            : null,
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [dataVersion, month, year]);

  // "Recent" means what already happened; a bill scheduled for next week does
  // not belong at the top of it.
  const timeline = useMemo(() => {
    const today = todayKey(timezoneOffsetMinutes);
    return buildTimeline(data.transactions, data.wallets, timezoneOffsetMinutes, isVietnamese)
      .filter((day) => day.dayKey <= today)
      .slice(0, 3);
  }, [data.transactions, data.wallets, isVietnamese, timezoneOffsetMinutes]);

  const budgetItems = useMemo(
    () =>
      [...(data.budget?.items || [])]
        .sort((left, right) => {
          const leftRatio = toAmount(left.spent) / Math.max(toAmount(left.amount), 1);
          const rightRatio = toAmount(right.spent) / Math.max(toAmount(right.amount), 1);
          return rightRatio - leftRatio;
        })
        .slice(0, 4),
    [data.budget],
  );

  const activeGoals = useMemo(
    () =>
      data.goals
        .filter((goal) => goal.status !== "completed")
        .sort(
          (left, right) =>
            toAmount(right.currentAmount) / Math.max(toAmount(right.targetAmount), 1) -
            toAmount(left.currentAmount) / Math.max(toAmount(left.targetAmount), 1),
        )
        .slice(0, 3),
    [data.goals],
  );

  const monthlyIncome = toAmount(data.stats?.monthlyIncome);
  const monthlyExpense = toAmount(data.stats?.monthlyExpense);
  const totalBudget = toAmount(data.budget?.totalBudget);
  const totalSpent = toAmount(data.budget?.totalSpent);
  const hasBudget = totalBudget > 0;
  const remaining = toAmount(data.budget?.totalRemaining);
  const daysLeft = daysLeftInMonth(timezoneOffsetMinutes);
  // Rounded down to the thousand: "263.000 ₫ a day" is a figure a person can
  // hold in their head; "263.846 ₫" only looks precise.
  const perDay = Math.floor(remaining / Math.max(daysLeft, 1) / 1000) * 1000;
  const usedPercent = hasBudget ? (totalSpent / totalBudget) * 100 : 0;
  const name = currentUser?.displayName || currentUser?.username || "";

  const history = (data.stats?.history || []).map((point) => ({
    label: point.month.replace(/^Th/, isVietnamese ? "T" : "M"),
    income: toAmount(point.income),
    expense: toAmount(point.expense),
  }));
  // Last month in full, as context for this month so far. A percentage
  // against a whole month would call the 18th of the month a "drop".
  const lastMonth = history.length >= 2 ? history[history.length - 2] : null;
  const previousMonth = month === 1 ? 12 : month - 1;

  // "Can I spend this?" is answered by what is left of this month's budgets.
  // Without budgets there is no plan to measure against, so the honest figure
  // is simply what came in minus what went out.
  const hero = hasBudget
    ? {
        label: t(`Còn có thể tiêu trong tháng ${month}`, "Left to spend this month"),
        value: <Money amount={remaining} tone={remaining < 0 ? "out" : "neutral"} />,
        caption:
          remaining > 0
            ? t(
                `Còn ${daysLeft} ngày, khoảng ${formatMoney(perDay)} mỗi ngày.`,
                `${daysLeft} days left, about ${formatMoney(perDay)} a day.`,
              )
            : t(
                `Đã tiêu quá tổng hạn mức ${formatMoney(Math.abs(remaining))}. Mọi khoản vẫn được ghi nhận.`,
                `${formatMoney(Math.abs(remaining))} over this month's plan. Everything is still recorded.`,
              ),
      }
    : {
        label: t(`Thu trừ chi tháng ${month}`, "In minus out this month"),
        value: <Money amount={monthlyIncome - monthlyExpense} signed tone="auto" />,
        caption: (
          <span>
            {t(
              "Đặt ngân sách để biết mỗi ngày còn tiêu được bao nhiêu. ",
              "Set a budget to see how much you can spend each day. ",
            )}
            <TextLink to="/budgets?create=1">{t("Tạo ngân sách", "Create a budget")}</TextLink>
          </span>
        ),
      };

  const reconcile = (wallet: Wallet) => navigate(`/wallets?reconcile=${wallet._id}`);

  const walletsCard = (
    <Section
      action={<TextLink to="/wallets">{t("Quản lý", "Manage")}</TextLink>}
      icon={WalletIcon}
      meta={data.wallets.length ? String(data.wallets.length) : undefined}
      title={t("Ví tiền", "Wallets")}
    >
      {loading ? (
        <SkeletonRows rows={3} />
      ) : data.wallets.length ? (
        <div className="-mt-3">
          {data.wallets.map((wallet) => (
            <WalletRow
              compact
              key={wallet._id}
              onAddIncome={(target) => openQuickAdd({ mode: "INCOME", walletId: target._id })}
              onReconcile={reconcile}
              wallet={wallet}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[14px] text-ledger-ink-2">
            {t("Chưa có ví nào. Tạo một ví để bắt đầu ghi chép.", "No wallets yet. Create one to start.")}
          </p>
          <Button icon={Plus} onClick={() => navigate("/wallets?create=1")} size="sm" variant="outline">
            {t("Tạo ví", "Create a wallet")}
          </Button>
        </div>
      )}
    </Section>
  );

  return (
    <div>
      <PageHeader
        actions={
          <div className="hidden items-center gap-2 sm:flex">
            <Button icon={ArrowLeftRight} onClick={() => openQuickAdd({ mode: "TRANSFER" })} variant="outline">
              {t("Chuyển ví", "Transfer")}
            </Button>
            <Button icon={Plus} onClick={() => openQuickAdd({ mode: "INCOME" })} variant="outline">
              {t("Ghi thu", "Income")}
            </Button>
            <Button icon={Minus} onClick={() => openQuickAdd({ mode: "EXPENSE" })}>
              {t("Ghi chi", "Expense")}
            </Button>
          </div>
        }
        subtitle={longToday(timezoneOffsetMinutes, isVietnamese)}
        title={
          name
            ? t(`Chào ${name.split(" ").slice(-1)[0]}`, `Hi ${name.split(" ")[0]}`)
            : t("Tổng quan", "Overview")
        }
      />

      <HeroStrip
        caption={loading ? null : hero.caption}
        icon={PiggyBank}
        label={hero.label}
        stats={[
          {
            label: t("Tổng số dư", "Total balance"),
            icon: WalletIcon,
            tone: "accent",
            value: (
              <Money amount={data.totalBalance} tone={data.totalBalance < 0 ? "out" : "neutral"} />
            ),
            hint: data.wallets.length
              ? t(`Trên ${data.wallets.length} ví đang dùng`, `Across ${data.wallets.length} wallets`)
              : undefined,
          },
          {
            label: t(`Thu tháng ${month}`, "Income this month"),
            icon: ArrowDownLeft,
            tone: "in",
            value: <Money amount={monthlyIncome} signed tone="in" />,
            hint: lastMonth
              ? t(`Tháng ${previousMonth}: ${formatMoney(lastMonth.income)}`, `Last month: ${formatMoney(lastMonth.income)}`)
              : undefined,
          },
          {
            label: t(`Chi tháng ${month}`, "Spent this month"),
            icon: ArrowUpRight,
            tone: "out",
            value: <Money amount={monthlyExpense} />,
            hint: lastMonth
              ? t(`Tháng ${previousMonth}: ${formatMoney(lastMonth.expense)}`, `Last month: ${formatMoney(lastMonth.expense)}`)
              : undefined,
          },
        ]}
        value={loading ? <span className="text-ledger-line-strong">—</span> : hero.value}
      >
        {!loading && hasBudget ? (
          <div>
            <Track percent={usedPercent} />
            <div className="mt-2 flex items-center justify-between gap-3 text-[12.5px] text-ledger-muted">
              <span className="ledger-num">
                {t(
                  `Đã dùng ${Math.round(usedPercent)}% · ${formatMoney(totalSpent)} / ${formatMoney(totalBudget)}`,
                  `${Math.round(usedPercent)}% used · ${formatMoney(totalSpent)} / ${formatMoney(totalBudget)}`,
                )}
              </span>
            </div>
          </div>
        ) : null}
      </HeroStrip>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:mt-5 xl:grid-cols-12 xl:gap-5">
        <div className="min-w-0 space-y-3 sm:space-y-4 xl:col-span-8 xl:space-y-5">
          <Section
            action={<TextLink to="/budgets">{t("Xem tất cả", "See all")}</TextLink>}
            icon={ChartPie}
            meta={data.budget?.items?.length ? String(data.budget.items.length) : undefined}
            subtitle={t(
              "Nhóm sắp chạm hạn mức hiện trước",
              "Closest to their limit first",
            )}
            title={t(`Ngân sách tháng ${month}`, "Budgets this month")}
          >
            {loading ? (
              <SkeletonRows rows={3} />
            ) : budgetItems.length ? (
              <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
                {budgetItems.map((budget) => (
                  <BudgetTrackRow budget={budget} key={budget._id} showScope={false} tile />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] text-ledger-ink-2">
                  {t(
                    "Chưa có ngân sách nào cho tháng này. Ngân sách chỉ để theo dõi, không bao giờ chặn bạn chi.",
                    "No budgets for this month yet. Budgets only track, they never stop you spending.",
                  )}
                </p>
                <Button icon={ChartPie} onClick={() => navigate("/budgets?create=1")} size="sm" variant="outline">
                  {t("Tạo ngân sách", "Create a budget")}
                </Button>
              </div>
            )}
          </Section>

          {/* On a phone and a narrow laptop the wallets come right after the
              budgets: a negative wallet is the next thing worth seeing. On a
              wide screen they live in the side column. */}
          <div className="xl:hidden">{walletsCard}</div>

          <Section
            action={<TextLink to="/transactions">{t("Xem tất cả", "See all")}</TextLink>}
            icon={ReceiptText}
            subtitle={t("Bấm vào một dòng để sửa hoặc xoá", "Click a row to edit or delete it")}
            title={t("Giao dịch gần đây", "Recent activity")}
          >
            {loading ? (
              <SkeletonRows rows={4} />
            ) : timeline.length ? (
              timeline.map((day) => (
                <TimelineDayGroup
                  day={day}
                  key={day.dayKey}
                  onEdit={(entry) => openQuickAdd({ editing: entry.source })}
                />
              ))
            ) : (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] text-ledger-ink-2">
                  {t("Chưa có giao dịch nào.", "Nothing recorded yet.")}
                </p>
                <Button icon={Plus} onClick={() => openQuickAdd()} size="sm">
                  {t("Ghi khoản đầu tiên", "Record the first one")}
                </Button>
              </div>
            )}
          </Section>
        </div>

        <div className="min-w-0 space-y-3 sm:space-y-4 xl:col-span-4 xl:space-y-5">
          <div className="hidden xl:block">{walletsCard}</div>

          {history.length ? (
            <Section
              action={<ChartLegend />}
              icon={ChartColumn}
              title={t("Thu chi 6 tháng", "Last 6 months")}
            >
              <IncomeExpenseBars data={history} />
            </Section>
          ) : null}

          <Section
            action={<TextLink to="/goals">{t("Xem tất cả", "See all")}</TextLink>}
            icon={Target}
            title={t("Mục tiêu tiết kiệm", "Savings goals")}
          >
            {loading ? (
              <SkeletonRows rows={2} />
            ) : activeGoals.length ? (
              <div className="divide-y divide-ledger-line">
                {activeGoals.map((goal) => {
                  const target = toAmount(goal.targetAmount);
                  const saved = toAmount(goal.currentAmount);
                  const percent = target > 0 ? (saved / target) * 100 : 0;
                  return (
                    <div className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0" key={goal._id}>
                      <Ring percent={percent} size={48} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-ledger-ink">
                          {goal.title}
                        </p>
                        {/* Two nowrap halves, so a narrow column wraps between
                            the figures instead of running under the button. */}
                        <p className="mt-0.5 text-[13px] text-ledger-muted">
                          <span className="ledger-num">{formatMoney(saved)}</span>{" "}
                          <span className="ledger-num">/ {formatMoney(target)}</span>
                        </p>
                      </div>
                      <Button
                        onClick={() => navigate(`/goals?contribute=${goal._id}`)}
                        size="sm"
                        variant="soft"
                      >
                        {t("Nạp thêm", "Add")}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-[14px] text-ledger-ink-2">
                  {t("Chưa có mục tiêu đang chạy.", "No active goals.")}
                </p>
                <Button icon={Target} onClick={() => navigate("/goals")} size="sm" variant="outline">
                  {t("Đặt mục tiêu", "Set a goal")}
                </Button>
              </div>
            )}
          </Section>

          {data.reminder ? (
            <Section
              action={<TextLink to="/settings?tab=reminders">{t("Sửa", "Edit")}</TextLink>}
              icon={Bell}
              subtitle={
                data.reminder.enabled
                  ? t("Thông báo lên điện thoại mỗi ngày", "A daily notification on your phone")
                  : t("Bật để không quên ghi chép", "Turn on so you do not forget")
              }
              title={t("Nhắc ghi chép", "Reminders")}
              tone="neutral"
            >
              <div className="flex flex-wrap gap-2">
                {data.reminder.enabled && data.reminder.times.length ? (
                  data.reminder.times.map((time) => (
                    <span
                      className="ledger-num rounded-[10px] bg-ledger-canvas px-3 py-1.5 text-[14px] font-semibold text-ledger-ink"
                      key={time}
                    >
                      {time}
                    </span>
                  ))
                ) : (
                  <span className="rounded-[10px] bg-ledger-canvas px-3 py-1.5 text-[14px] text-ledger-ink-2">
                    {t("Đang tắt", "Off")}
                  </span>
                )}
              </div>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
