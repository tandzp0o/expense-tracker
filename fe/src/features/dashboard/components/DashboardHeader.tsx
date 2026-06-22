import React from "react";
import { Download, Plus, Sparkles } from "lucide-react";
import { PageHeader } from "components/app/page-header";
import { Button } from "components/ui/button";
import { Select } from "components/ui/select";

export type PeriodFilter = "3m" | "6m" | "12m";

type WalletItem = {
  _id: string;
  name: string;
};

type DashboardHeaderProps = {
  copy: any;
  navigate: (path: string) => void;
  wallets: WalletItem[];
  selectedPeriod: PeriodFilter;
  setSelectedPeriod: React.Dispatch<React.SetStateAction<PeriodFilter>>;
  selectedWallet: string;
  setSelectedWallet: React.Dispatch<React.SetStateAction<string>>;
  isVietnamese: boolean;
  netProfit: number;
  themedActionGradient: string;
  themedSurfaceGradient: string;
  appearance: { primaryColor: string };
  dashboardBalance: number;
  selectedWalletItem: any;
  totalIncome: number;
  totalExpense: number;
  goalSaved: number;
  formatCurrency: (
    amount: number | null | undefined,
    currency?: string,
    opts?: any,
  ) => string;
};

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  copy,
  navigate,
  wallets,
  selectedPeriod,
  setSelectedPeriod,
  selectedWallet,
  setSelectedWallet,
  isVietnamese,
  netProfit,
  themedActionGradient,
  themedSurfaceGradient,
  appearance,
  dashboardBalance,
  selectedWalletItem,
  totalIncome,
  totalExpense,
  goalSaved,
  formatCurrency,
}) => {
  return (
    <>
      <div className="space-y-3 lg:hidden">
        <div
          className="overflow-hidden rounded-[calc(var(--app-radius-xl)+4px)] border border-white/70 p-4 shadow-soft dark:border-white/10"
          style={{ backgroundImage: themedSurfaceGradient }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {copy.myBalance}
              </p>
              <p className="mt-2 text-[2rem] font-semibold tracking-tight text-foreground">
                {formatCurrency(
                  dashboardBalance,
                  selectedWalletItem?.currency || "VND",
                  {
                    displayMode: "full",
                  },
                )}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-primary dark:border-white/10 dark:bg-white/10">
              <Sparkles className="h-3.5 w-3.5" />
              {isVietnamese
                ? "AI đang học thói quen"
                : "AI learning your habits"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/50 pt-4 dark:border-white/10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {isVietnamese ? "Vào" : "In"}
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-600">
                {formatCurrency(totalIncome)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {isVietnamese ? "Ra" : "Out"}
              </p>
              <p className="mt-1 text-sm font-semibold text-rose-600">
                {formatCurrency(totalExpense)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {isVietnamese ? "Để dành" : "Saved"}
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {formatCurrency(goalSaved)}
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-[var(--app-radius-xl)] border border-white/70 px-4 py-3 text-white shadow-soft dark:border-white/10"
          style={{ backgroundImage: themedActionGradient }}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/18">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/78">
                {isVietnamese ? "Trợ lý AI" : "AI copilot"}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {netProfit >= 0
                  ? isVietnamese
                    ? "Tuần này bạn đang giữ nhịp chi tiêu ổn định, có thể đẩy thêm vào mục tiêu."
                    : "Your spending rhythm is stable this week, so you can push a bit more into goals."
                  : isVietnamese
                    ? "Chi tiêu đang cao hơn nhịp thường lệ, AI sẽ ưu tiên nhắc các nhóm dễ cắt giảm."
                    : "Spending is running above your usual rhythm, so AI will prioritize easier categories to trim."}
              </p>
            </div>
          </div>
        </div>

        <div className="hidden gap-2 rounded-[var(--app-radius-xl)] border border-border/70 bg-card/80 p-2 shadow-soft lg:grid">
          <Select
            className="w-full"
            onChange={(event) =>
              setSelectedPeriod(event.target.value as PeriodFilter)
            }
            value={selectedPeriod}
          >
            <option value="3m">{copy.periods["3m"]}</option>
            <option value="6m">{copy.periods["6m"]}</option>
            <option value="12m">{copy.periods["12m"]}</option>
          </Select>

          <Select
            className="w-full"
            onChange={(event) => setSelectedWallet(event.target.value)}
            value={selectedWallet}
          >
            <option value="all">{copy.allWallets}</option>
            {wallets.map((wallet) => (
              <option key={wallet._id} value={wallet._id}>
                {wallet.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <PageHeader
        actions={
          <div className="flex w-full flex-col gap-3 md:items-center md:flex-row-reverse justify-center">
            <div className="gap-2 flex justify-end items-center">
              <Button
                className="hidden h-9 whitespace-nowrap px-3 text-xs lg:inline-flex sm:text-sm"
                onClick={() => navigate("/analytics")}
                variant="outline"
              >
                <Download className="h-4 w-4" />
                {copy.reportButton}
              </Button>
              <Button
                className="hidden h-9 whitespace-nowrap px-3 text-xs lg:inline-flex sm:text-sm"
                onClick={() => navigate("/transactions")}
              >
                <Plus className="h-4 w-4" />
                {copy.addTransaction}
              </Button>
            </div>

            <div className="grid gap-2 rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 p-2 sm:grid-cols-2">
              <Select
                className="w-full sm:min-w-[9rem]"
                onChange={(event) =>
                  setSelectedPeriod(event.target.value as PeriodFilter)
                }
                value={selectedPeriod}
              >
                <option value="3m">{copy.periods["3m"]}</option>
                <option value="6m">{copy.periods["6m"]}</option>
                <option value="12m">{copy.periods["12m"]}</option>
              </Select>

              <Select
                className="w-full sm:min-w-[11rem]"
                onChange={(event) => setSelectedWallet(event.target.value)}
                value={selectedWallet}
              >
                <option value="all">{copy.allWallets}</option>
                {wallets.map((wallet) => (
                  <option key={wallet._id} value={wallet._id}>
                    {wallet.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
        description={copy.headerDescription}
        hideActionsOnMobile
        hideDescriptionOnMobile
        hideTitleOnMobile
        title={copy.headerTitle}
      />
    </>
  );
};

export default React.memo(DashboardHeader);
