import React from "react";
import dayjs from "dayjs";
import { ArrowDownRight, ArrowUpRight, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import BarChart from "components/charts/BarChart";
import LineChart from "components/charts/LineChart";
import PieChart from "components/charts/PieChart";
import { cn, hexToRgba } from "lib/utils";

type PeriodFilter = "3m" | "6m" | "12m";

type DashboardOverviewProps = {
  selectedWallet: string;
  selectedWalletItem: any;
  selectedPeriod: PeriodFilter;
  setSelectedPeriod: React.Dispatch<React.SetStateAction<PeriodFilter>>;
  setSelectedWallet: React.Dispatch<React.SetStateAction<string>>;
  wallets: any[];
  copy: any;
  dashboardBalance: number;
  totalIncome: number;
  previousIncome: number;
  totalExpense: number;
  previousExpense: number;
  netProfit: number;
  previousNetProfit: number;
  savingsRate: number;
  isVietnamese: boolean;
  currentWeekExpense: number;
  weeklyExpenseChangeLabel: string;
  weeklyExpenseChange: number;
  currentWeekStart: dayjs.Dayjs;
  themedActionGradient: string;
  appearance: { primaryColor: string };
  themeColors: { primary: string; secondary: string };
  themedSurfaceGradient: string;
  mobileSparklinePath: string;
  weeklyExpenseBuckets: Array<{ label: string; value: number }>;
  mobileWeekMaxExpense: number;
  formatCurrency: (
    amount: number | null | undefined,
    currency?: string,
    opts?: any,
  ) => string;
  formatDeltaText: (current: number, previous: number) => string;
  getDeltaTone: (
    current: number,
    previous: number,
    variant?: "inverse",
  ) => string;
  incomeChartData: any;
  expenseChartData: any;
  summaryChartData: any;
  expenseCategories: Array<{
    name: string;
    color: string;
    percent: number;
    value: number;
  }>;
  sharedLegend: any;
  tickColor: string;
  gridColor: string;
  axisTick: (value: number | string) => string;
  periodLabel: string;
};

const DashboardStatCard: React.FC<{
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}> = ({ title, value, description, icon: Icon, iconClassName }) => (
  <Card className="overflow-hidden border-border/70 bg-card/95">
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[calc(var(--app-radius-md)-3px)] bg-muted text-foreground",
            iconClassName,
          )}
        >
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-[1.5rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[1.7rem]">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  selectedWallet,
  selectedWalletItem,
  selectedPeriod,
  setSelectedPeriod,
  setSelectedWallet,
  wallets,
  copy,
  dashboardBalance,
  totalIncome,
  previousIncome,
  totalExpense,
  previousExpense,
  netProfit,
  previousNetProfit,
  savingsRate,
  isVietnamese,
  currentWeekExpense,
  weeklyExpenseChangeLabel,
  weeklyExpenseChange,
  currentWeekStart,
  themedActionGradient,
  themedSurfaceGradient,
  appearance,
  themeColors,
  mobileSparklinePath,
  weeklyExpenseBuckets,
  mobileWeekMaxExpense,
  formatCurrency,
  formatDeltaText,
  getDeltaTone,
  incomeChartData,
  expenseChartData,
  summaryChartData,
  expenseCategories,
  sharedLegend,
  tickColor,
  gridColor,
  axisTick,
  periodLabel,
}) => {
  return (
    <>
      <div className="hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          description={
            selectedWallet === "all"
              ? copy.allWalletsActive(wallets.length)
              : copy.activeWalletFocus(
                  selectedWalletItem?.name || copy.unknownWallet,
                )
          }
          icon={Wallet}
          iconClassName="bg-primary-soft text-primary"
          title={copy.myBalance}
          value={formatCurrency(
            dashboardBalance,
            selectedWalletItem?.currency || "VND",
            { displayMode: "full" },
          )}
        />
        <DashboardStatCard
          description={formatDeltaText(totalIncome, previousIncome)}
          icon={ArrowDownRight}
          iconClassName={cn(
            "bg-emerald-500/10",
            getDeltaTone(totalIncome, previousIncome),
          )}
          title={copy.income}
          value={formatCurrency(totalIncome)}
        />
        <DashboardStatCard
          description={formatDeltaText(totalExpense, previousExpense)}
          icon={ArrowUpRight}
          iconClassName={cn(
            "bg-rose-500/10",
            getDeltaTone(totalExpense, previousExpense, "inverse"),
          )}
          title={copy.monthExpense}
          value={formatCurrency(totalExpense)}
        />
        <DashboardStatCard
          description={
            netProfit >= 0
              ? copy.savingsRate(Math.max(savingsRate, 0))
              : formatDeltaText(netProfit, previousNetProfit)
          }
          icon={TrendingUp}
          iconClassName={
            netProfit >= 0
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-rose-500/10 text-rose-600"
          }
          title={copy.netProfit}
          value={formatCurrency(netProfit)}
        />
      </div>

      <div
        className="overflow-hidden rounded-[calc(var(--app-radius-xl)+4px)] border border-white/70 p-4 shadow-soft lg:hidden dark:border-white/10"
        style={{ backgroundImage: themedSurfaceGradient }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {isVietnamese ? "Tuần này" : "This week"}
            </p>
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <p className="text-[1.55rem] font-semibold leading-none tracking-tight text-foreground">
                {formatCurrency(currentWeekExpense)}
              </p>
              {weeklyExpenseChangeLabel ? (
                <span
                  className={cn(
                    "text-xs font-semibold",
                    weeklyExpenseChange >= 0
                      ? "text-emerald-600"
                      : "text-rose-600",
                  )}
                >
                  {weeklyExpenseChangeLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-w-[92px]">
            <p className="mb-1 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {isVietnamese ? "Tháng này" : "This month"}
            </p>
            <svg
              aria-hidden="true"
              className="h-10 w-24"
              preserveAspectRatio="none"
              viewBox="0 0 100 44"
            >
              <path
                d={mobileSparklinePath}
                fill="none"
                stroke={appearance.primaryColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
            </svg>
          </div>
        </div>

        <div className="mt-5 grid h-24 grid-cols-7 items-end gap-2">
          {weeklyExpenseBuckets.map((item, index) => {
            const height = Math.max(
              (item.value / mobileWeekMaxExpense) * 100,
              16,
            );
            const isToday = currentWeekStart
              .add(index, "day")
              .isSame(dayjs(), "day");

            return (
              <div
                key={item.label}
                className="flex h-full flex-col justify-end gap-2"
              >
                <div
                  className="rounded-t-[var(--app-radius-md)] rounded-b-sm"
                  style={{
                    height: `${height}%`,
                    background: isToday
                      ? themedActionGradient
                      : hexToRgba(themeColors.secondary, 0.58),
                  }}
                />
                <span
                  className={cn(
                    "text-center text-[10px] font-medium",
                    isToday ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden gap-4 sm:gap-6 lg:grid xl:grid-cols-3">
        <div className="flex flex-col col-span-2 gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>{copy.income}</CardTitle>
                <CardDescription>
                  {copy.incomeChartDesc(periodLabel)}
                </CardDescription>
              </div>
              <Badge variant="outline">{periodLabel}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-20 lg:h-[12rem]">
                <LineChart
                  data={incomeChartData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: tickColor },
                      },
                      y: {
                        grid: { color: gridColor },
                        ticks: { color: tickColor, callback: axisTick },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>{copy.monthExpense}</CardTitle>
                <CardDescription>{copy.expenseChartDesc}</CardDescription>
              </div>
              <Badge variant="outline">{copy.monthExpense}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-20 lg:h-[10rem]">
                <BarChart
                  data={expenseChartData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: tickColor },
                      },
                      y: {
                        grid: { color: gridColor },
                        ticks: { color: tickColor, callback: axisTick },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>{copy.summary}</CardTitle>
              <CardDescription>{copy.summaryChartDesc}</CardDescription>
            </div>
            <Badge variant="outline">{copy.summary}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {expenseCategories.length > 0 ? (
              <>
                <div className="h-36 lg:h-[18rem]">
                  <PieChart
                    data={summaryChartData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: sharedLegend },
                    }}
                  />
                </div>

                <div className="space-y-3">
                  {expenseCategories.map((category) => (
                    <div
                      key={category.name}
                      className="flex items-center justify-between rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {category.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {category.percent.toFixed(0)}%
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(category.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex min-h-36 items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-6 text-center text-sm text-muted-foreground lg:min-h-[18rem]">
                {copy.noExpenseData}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default React.memo(DashboardOverview);
