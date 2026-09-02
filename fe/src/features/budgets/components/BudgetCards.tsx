import React from "react";
import { LucideIcon, Trash2 } from "lucide-react";
import { Button } from "components/ui/button";
import { Card, CardContent } from "components/ui/card";
import { Progress } from "components/ui/progress";
import { EmptyState } from "components/app/empty-state";

export interface BudgetSummaryItem {
  _id: string;
  /** Empty when the budget is not pinned to a single wallet. */
  walletId?: string | null;
  walletName?: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  overspent?: number;
  percent: number;
  color?: string;
  categoryType?: "standard" | "custom";
  customCategoryName?: string;
  subcategory?: string;
  icon?: string;
  tags?: string[];
  subBudgets?: Array<{
    name: string;
    amount: number;
  }>;
}

interface BudgetCardsCopy {
  spent: string;
  remaining: string;
  of: string;
  edit: string;
  monthlyCategoriesDesc: string;
  monthlyCategories: string;
  noBudgets: string;
  noBudgetsDesc: string;
  createBudget: string;
  allWallets: string;
}

interface BudgetCardsProps {
  budgets: BudgetSummaryItem[];
  copy: BudgetCardsCopy;
  icon: LucideIcon;
  formatCurrency: (value: number) => string;
  getCategoryLabel?: (budget: BudgetSummaryItem) => string;
  onEdit: (budget: BudgetSummaryItem) => void;
  onDelete: (budget: BudgetSummaryItem) => void;
  onCreate: () => void;
}

export const BudgetCards: React.FC<BudgetCardsProps> = ({
  budgets,
  copy,
  icon,
  formatCurrency,
  getCategoryLabel = (budget) => budget.category,
  onEdit,
  onDelete,
  onCreate,
}) => {
  if (budgets.length === 0) {
    return (
      <EmptyState
        actionLabel={copy.createBudget}
        description={copy.noBudgetsDesc}
        icon={icon}
        onAction={onCreate}
        title={copy.noBudgets}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {budgets.map((budget) => {
        const statusColor =
          budget.percent > 100
            ? "bg-rose-500"
            : budget.percent > 85
            ? "bg-amber-500"
            : "bg-emerald-500";

        return (
          <Card key={budget._id} className="border-border/80">
            <CardContent className="p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">
                    {getCategoryLabel(budget)}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {budget.walletName || copy.allWallets}
                  </p>
                </div>
                <Button onClick={() => onDelete(budget)} size="icon" variant="ghost">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-3 grid gap-2 rounded-[var(--app-radius-md)] bg-muted/35 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{copy.spent}</span>
                  <span className="font-medium text-foreground">{formatCurrency(budget.spent)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{copy.remaining}</span>
                  <span className="font-medium text-foreground">{formatCurrency(budget.remaining)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    {formatCurrency(budget.spent)} {copy.of} {formatCurrency(budget.amount)}
                  </span>
                  {budget.overspent ? (
                    <span className="font-medium text-rose-600">+{formatCurrency(budget.overspent)}</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3">
                <Progress indicatorClassName={statusColor} value={Math.min(budget.percent, 100)} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{Math.round(budget.percent)}%</span>
                <button className="font-medium text-primary" onClick={() => onEdit(budget)} type="button">
                  {copy.edit}
                </button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
