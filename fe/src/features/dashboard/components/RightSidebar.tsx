import React, { forwardRef } from "react";
import { CreditCard, Landmark, Target, Wallet } from "lucide-react";
import { Button } from "components/ui/button";
import { hexToRgba } from "lib/utils";
import { Badge } from "components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import { Progress } from "components/ui/progress";

type Props = {
  copy: any;
  goalSummary: any;
  walletCards: any[];
  walletBudgetSummaryMap: Map<string, any>;
  navigate: (path: string) => void;
  formatDate: (date: string) => string;
  formatCurrency: (
    amount: number | null | undefined,
    currency?: string,
    opts?: any,
  ) => string;
  parseAmount: (value: unknown) => number;
  getBudgetColor: (budget: any, index: number) => string;
  normalizeText: (text: string) => string;
  appearance: { primaryColor: string };
  themeColors: { primary: string; secondary: string };
};

const RightSidebar = forwardRef<HTMLDivElement, Props>(
  (
    {
      copy,
      goalSummary,
      walletCards,
      walletBudgetSummaryMap,
      navigate,
      formatDate,
      formatCurrency,
      parseAmount,
      getBudgetColor,
      normalizeText,
      appearance,
      themeColors,
    },
    ref,
  ) => {
    return (
      <div className="flex min-w-0 flex-col gap-4 sm:gap-6" ref={ref}>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-4 border-b border-border/70 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle>{copy.savingGoalTitle}</CardTitle>
              <CardDescription>{copy.savingGoalDesc}</CardDescription>
            </div>

            <Button
              onClick={() => navigate("/goals")}
              size="sm"
              variant="outline"
            >
              {copy.openGoals}
            </Button>
          </CardHeader>

          <CardContent className="pt-4 sm:pt-6">
            {goalSummary.featuredGoal ? (
              <div className="rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-4 sm:p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-foreground">
                        {goalSummary.featuredGoal.title}
                      </p>
                      <Badge variant="outline">
                        {copy.goalStatuses[goalSummary.featuredGoal.status]}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {goalSummary.featuredGoal.category ||
                        copy.genericCategory}
                      {" - "}
                      {goalSummary.featuredGoal.deadline
                        ? `${copy.deadline}: ${formatDate(goalSummary.featuredGoal.deadline)}`
                        : copy.noDeadline}
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-3xl font-semibold tracking-tight text-foreground">
                      {formatCurrency(
                        parseAmount(goalSummary.featuredGoal.currentAmount),
                      )}
                    </p>
                    <p className="hidden md:block mt-1 text-sm text-muted-foreground">
                      {copy.target}{" "}
                      {formatCurrency(
                        parseAmount(goalSummary.featuredGoal.targetAmount),
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span>{copy.progress}</span>
                    <span>{goalSummary.featuredGoal.progress.toFixed(0)}%</span>
                  </div>
                  <Progress
                    className="h-3"
                    indicatorClassName="bg-primary"
                    value={goalSummary.featuredGoal.progress}
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-[192px] flex-col items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-4 text-center sm:min-h-[220px] sm:px-6">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--app-radius-lg)] bg-primary-soft text-primary">
                  <Target className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {copy.noGoalsTitle}
                </h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {copy.noGoalsDesc}
                </p>
                <Button className="mt-5" onClick={() => navigate("/goals")}>
                  {copy.openGoals}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/70 p-4 sm:p-5 lg:p-6">
            <div className="min-w-0 space-y-0.5 sm:space-y-1">
              <CardTitle className="text-base sm:text-lg">
                {copy.myWalletTitle}
              </CardTitle>
              <CardDescription className="hidden sm:block">
                {copy.myWalletDesc}
              </CardDescription>
            </div>

            <Button
              className="h-9 shrink-0 px-3 text-xs sm:text-sm"
              onClick={() => navigate("/wallets")}
              size="sm"
              variant="outline"
            >
              {copy.manageWallets}
            </Button>
          </CardHeader>

          <CardContent className="px-3 pb-4 pt-3 sm:p-5 lg:p-6">
            {walletCards.length > 0 ? (
              <div className="flex flex-nowrap gap-2.5 overflow-x-auto overflow-y-hidden py-1 sm:gap-3">
                {walletCards.map((wallet) => {
                  const normalizedType = normalizeText(wallet.type || "");
                  const walletTypeLabel = normalizedType.includes("bank")
                    ? copy.walletTypes.bank
                    : normalizedType.includes("ewallet")
                      ? copy.walletTypes.ewallet
                      : normalizedType.includes("cash")
                        ? copy.walletTypes.cash
                        : copy.walletTypes.other;

                  const walletBudgetSummary = walletBudgetSummaryMap.get(
                    wallet._id,
                  );
                  const reserveItems = (
                    walletBudgetSummary?.items || []
                  ).filter(
                    (item: any) =>
                      Number(item.remaining || 0) > 0 ||
                      Number(item.spent || 0) > 0,
                  );
                  const reservedAmount = reserveItems.reduce(
                    (sum: number, item: any) =>
                      sum + Number(item.remaining || 0),
                    0,
                  );
                  const freeAmount = Math.max(
                    parseAmount(wallet.balance) - reservedAmount,
                    0,
                  );
                  const allocationTotal = Math.max(
                    parseAmount(wallet.balance),
                    reservedAmount,
                    1,
                  );
                  const allocationSegments = [
                    ...(freeAmount > 0
                      ? [
                          {
                            key: `${wallet._id}-free`,
                            label: copy.freeToSpend,
                            amount: freeAmount,
                            color: appearance.primaryColor,
                          },
                        ]
                      : []),
                    ...reserveItems
                      .filter((item: any) => Number(item.remaining || 0) > 0)
                      .map((item: any, index: number) => ({
                        key: item._id,
                        label: item.category,
                        amount: Number(item.remaining || 0),
                        color: getBudgetColor(item, index),
                      })),
                  ];

                  return (
                    <div
                      key={wallet._id}
                      className="flex h-full w-[min(286px,calc(100vw-3rem))] shrink-0 flex-col overflow-hidden rounded-[var(--app-radius-xl)] border border-white/12 bg-card shadow-sm"
                    >
                      <div
                        className="relative flex min-h-[154px] flex-1 overflow-hidden p-3.5 text-white sm:min-h-[238px] sm:p-5"
                        style={{
                          backgroundImage: wallet.background,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }}
                      >
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.36)_42%,rgba(2,6,23,0.88)_100%)]" />
                        <div className="relative z-10 flex w-full flex-col gap-3 sm:gap-4">
                          <div className="flex items-start gap-2.5 sm:justify-between sm:gap-3">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--app-radius-md)-4px)] bg-white/14 backdrop-blur-sm sm:h-10 sm:w-10">
                                {normalizedType.includes("bank") ? (
                                  <Landmark className="h-4 w-4 sm:h-5 sm:w-5" />
                                ) : normalizedType.includes("ewallet") ? (
                                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                                ) : (
                                  <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/72 sm:text-[10px] sm:tracking-[0.16em]">
                                  {walletTypeLabel}
                                </p>
                                <h3 className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:mt-1 sm:text-xl">
                                  {wallet.name}
                                </h3>
                                {wallet.accountNumber ? (
                                  <p className="mt-0.5 truncate text-[10px] text-white/68 sm:text-xs">
                                    {wallet.accountNumber}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="shrink-0 text-left sm:text-right">
                              <p className="text-[9px] uppercase tracking-[0.14em] text-white/68 sm:text-[10px] sm:tracking-[0.18em]">
                                {copy.availableBalance}
                              </p>
                              <p className="mt-0.5 text-xl font-semibold tracking-tight sm:mt-1 sm:text-[1.8rem]">
                                {formatCurrency(parseAmount(wallet.balance))}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 border-t border-white/18 pt-2.5 text-xs text-white/78 sm:space-y-2.5 sm:pt-3">
                            <div className="flex items-center justify-between gap-3">
                              <span>
                                {copy.share}: {wallet.share.toFixed(0)}%
                              </span>
                            </div>

                            <div className="flex h-2 overflow-hidden rounded-full bg-white/14">
                              {allocationSegments.length > 0 ? (
                                allocationSegments.map((segment) => (
                                  <div
                                    key={segment.key}
                                    style={{
                                      backgroundColor: segment.color,
                                      width: `${(segment.amount / allocationTotal) * 100}%`,
                                    }}
                                  />
                                ))
                              ) : (
                                <div className="h-full w-full bg-white/24" />
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
                              <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-md)] bg-white/10 px-3 py-2 backdrop-blur-sm">
                                <span className="text-[11px] text-white/72">
                                  {copy.freeToSpend}
                                </span>
                                <span className="text-sm font-semibold text-white">
                                  {formatCurrency(freeAmount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-md)] bg-white/10 px-3 py-2 backdrop-blur-sm">
                                <span className="text-[11px] text-white/72">
                                  {copy.budgetReserved}
                                </span>
                                <span className="text-sm font-semibold text-white">
                                  {formatCurrency(reservedAmount)}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {reserveItems.length > 0 ? (
                                reserveItems
                                  .filter(
                                    (item: any) =>
                                      Number(item.remaining || 0) > 0,
                                  )
                                  .slice(0, 3)
                                  .map((item: any, index: number) => (
                                    <span
                                      key={item._id}
                                      className="inline-flex max-w-full items-center truncate rounded-full px-2 py-1 text-[10px] font-medium"
                                      style={{
                                        backgroundColor: hexToRgba(
                                          getBudgetColor(item, index),
                                          0.14,
                                        ),
                                        color: getBudgetColor(item, index),
                                      }}
                                    >
                                      {item.category}
                                    </span>
                                  ))
                              ) : (
                                <span className="text-xs text-white/68">
                                  {copy.noBudgetReserve}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[192px] items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-4 text-center text-sm text-muted-foreground sm:min-h-[220px] sm:px-6">
                {copy.noWallets}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  },
);

RightSidebar.displayName = "RightSidebar";

export default React.memo(RightSidebar);
