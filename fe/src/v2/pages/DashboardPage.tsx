import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChartPie, Plus, ReceiptText } from "lucide-react";
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
  Eyebrow,
  HeroStrip,
  Money,
  PageHeader,
  Ring,
  Section,
  SkeletonRows,
  TextLink,
} from "../components/primitives";
import { TimelineDayGroup } from "../components/timeline";
import { useLedger } from "../LedgerContext";
import {
  currentMonth,
  daysLeftInMonth,
  formatMoney,
  longToday,
  monthLabel,
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
        .slice(0, 2),
    [data.goals],
  );

  const monthlyIncome = toAmount(data.stats?.monthlyIncome);
  const monthlyExpense = toAmount(data.stats?.monthlyExpense);
  const hasBudget = toAmount(data.budget?.totalBudget) > 0;
  const remaining = toAmount(data.budget?.totalRemaining);
  const daysLeft = daysLeftInMonth(timezoneOffsetMinutes);
  // Rounded down to the thousand: "263.000 ₫ a day" is a figure a person can
  // hold in their head; "263.846 ₫" only looks precise.
  const perDay = Math.floor(remaining / Math.max(daysLeft, 1) / 1000) * 1000;
  const name = currentUser?.displayName || currentUser?.username || "";

  // "Can I spend this?" is answered by what is left of this month's budgets.
  // Without budgets there is no plan to measure against, so the honest figure
  // is simply what came in minus what went out.
  const hero = hasBudget
    ? {
        label: t("Còn có thể tiêu trong tháng", "Left to spend this month"),
        value: <Money amount={remaining} tone={remaining < 0 ? "out" : "neutral"} />,
        caption:
          remaining > 0
            ? t(
                `Còn ${daysLeft} ngày · khoảng ${formatMoney(perDay)} mỗi ngày`,
                `${daysLeft} days left · about ${formatMoney(perDay)} a day`,
              )
            : t(
                `Đã tiêu quá tổng hạn mức ${formatMoney(Math.abs(remaining))}. Mọi khoản vẫn được ghi nhận.`,
                `${formatMoney(Math.abs(remaining))} over this month's plan. Everything is still recorded.`,
              ),
      }
    : {
        label: t("Thu trừ chi tháng này", "In minus out this month"),
        value: (
          <Money amount={monthlyIncome - monthlyExpense} signed tone="auto" />
        ),
        caption: (
          <span>
            {t(
              "Đặt ngân sách để biết mỗi ngày còn tiêu được bao nhiêu. ",
              "Set a budget to see how much you can spend each day. ",
            )}
            <TextLink to="/budgets">{t("Tạo ngân sách", "Create a budget")}</TextLink>
          </span>
        ),
      };

  const history = (data.stats?.history || []).map((point) => ({
    label: point.month.replace(/^Th/, isVietnamese ? "T" : "M"),
    income: toAmount(point.income),
    expense: toAmount(point.expense),
  }));

  const reconcile = (wallet: Wallet) => navigate(`/wallets?reconcile=${wallet._id}`);

  const walletsSection = (
    <Section
      action={<TextLink to="/wallets">{t("Tất cả", "All")}</TextLink>}
      title={t("Ví tiền", "Wallets")}
    >
      {loading ? (
        <SkeletonRows rows={3} />
      ) : data.wallets.length ? (
        data.wallets.map((wallet) => (
          <WalletRow
            compact
            key={wallet._id}
            onAddIncome={(target) => openQuickAdd({ mode: "INCOME", walletId: target._id })}
            onReconcile={reconcile}
            wallet={wallet}
          />
        ))
      ) : (
        <p className="text-[13.5px] text-ledger-ink-2">
          {t("Chưa có ví nào.", "No wallets yet.")}{" "}
          <TextLink to="/wallets">{t("Tạo ví", "Create one")}</TextLink>
        </p>
      )}
    </Section>
  );

  return (
    <div>
      <PageHeader
        actions={
          <span className="rounded-full border border-ledger-line px-3 py-1.5 text-[13px] text-ledger-ink-2">
            {monthLabel(month, year, isVietnamese)}
          </span>
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
        label={hero.label}
        stats={[
          {
            label: t("Tổng số dư", "Balance"),
            value: <Money amount={data.totalBalance} tone={data.totalBalance < 0 ? "out" : "neutral"} />,
          },
          {
            label: t(`Thu tháng ${month}`, `In, ${monthLabel(month, year, false)}`),
            value: <Money amount={monthlyIncome} signed tone="in" />,
          },
          {
            label: t(`Chi tháng ${month}`, `Out, ${monthLabel(month, year, false)}`),
            value: <Money amount={monthlyExpense} />,
          },
        ]}
        value={loading ? <span className="text-ledger-line-strong">—</span> : hero.value}
      />

      <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Section
            action={<TextLink to="/budgets">{t("Quản lý", "Manage")}</TextLink>}
            meta={
              data.budget?.items?.length
                ? t(`${data.budget.items.length} nhóm`, `${data.budget.items.length} groups`)
                : undefined
            }
            title={t(`Ngân sách tháng ${month}`, `Budgets, ${monthLabel(month, year, false)}`)}
          >
            {loading ? (
              <SkeletonRows rows={3} />
            ) : budgetItems.length ? (
              budgetItems.map((budget) => (
                <BudgetTrackRow budget={budget} key={budget._id} showIcon={false} />
              ))
            ) : (
              <div className="flex flex-col items-start gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13.5px] text-ledger-ink-2">
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

          {/* On a phone the wallets come right after the budgets: a negative
              wallet is the next thing worth seeing, not something to scroll
              past a chart for. The desktop copy lives in the side pane. */}
          <div className="lg:hidden">{walletsSection}</div>

          <Section
            action={<TextLink to="/transactions">{t("Xem tất cả", "See all")}</TextLink>}
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
              <div className="flex flex-col items-start gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13.5px] text-ledger-ink-2">
                  {t("Chưa có giao dịch nào.", "Nothing recorded yet.")}
                </p>
                <Button icon={Plus} onClick={() => openQuickAdd()} size="sm">
                  {t("Ghi khoản đầu tiên", "Record the first one")}
                </Button>
              </div>
            )}
          </Section>

          {history.length ? (
            <Section action={<ChartLegend />} bare title={t("Thu chi 6 tháng", "Last 6 months")}>
              <IncomeExpenseBars data={history} />
            </Section>
          ) : null}
        </div>

        <aside className="min-w-0 lg:border-l lg:border-ledger-line lg:pl-8">
          <div className="hidden lg:block">{walletsSection}</div>

          <Section
            action={<TextLink to="/goals">{t("Tất cả", "All")}</TextLink>}
            title={t("Mục tiêu", "Goals")}
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
                    <div className="flex items-center gap-3 py-3 first:pt-0" key={goal._id}>
                      <Ring percent={percent} size={46} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-medium text-ledger-ink">
                          {goal.title}
                        </p>
                        <p className="ledger-num text-[12.5px] text-ledger-muted">
                          {formatMoney(saved)} / {formatMoney(target)}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-ledger-ink-2">
                          {t(
                            `Còn thiếu ${formatMoney(Math.max(target - saved, 0))}`,
                            `${formatMoney(Math.max(target - saved, 0))} to go`,
                          )}{" "}
                          · <TextLink to={`/goals?contribute=${goal._id}`}>{t("Nạp thêm", "Add")}</TextLink>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13.5px] text-ledger-ink-2">
                {t("Chưa có mục tiêu đang chạy.", "No active goals.")}{" "}
                <TextLink to="/goals">{t("Đặt mục tiêu", "Set one")}</TextLink>
              </p>
            )}
          </Section>

          {data.reminder ? (
            <Section bare title={t("Nhắc ghi chép", "Reminders")}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ledger-canvas text-ledger-ink-2">
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-ledger-ink">
                    {data.reminder.enabled && data.reminder.times.length
                      ? data.reminder.times.join(" · ")
                      : t("Đang tắt", "Off")}
                  </p>
                  <Eyebrow className="normal-case tracking-normal">
                    {data.reminder.enabled
                      ? t("Thông báo lên điện thoại mỗi ngày", "A daily notification on your phone")
                      : t("Bật để không quên ghi chép", "Turn on so you do not forget")}
                  </Eyebrow>
                </div>
                <TextLink to="/settings?tab=reminders">{t("Sửa", "Edit")}</TextLink>
              </div>
            </Section>
          ) : null}
        </aside>
      </div>

      {!loading && !data.transactions.length && !data.wallets.length ? (
        <div className="mt-6 flex items-center gap-3 rounded-[14px] bg-ledger-canvas p-4 text-[13.5px] text-ledger-ink-2">
          <ReceiptText className="h-5 w-5 shrink-0" />
          {t(
            "Bắt đầu bằng cách tạo một ví, rồi ghi khoản chi đầu tiên.",
            "Start by creating a wallet, then record your first expense.",
          )}
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPage;
