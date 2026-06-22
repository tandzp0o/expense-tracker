import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "components/ui/card";

type Props = {
  recentTransactions: any[];
  transactionFilter: string;
  setTransactionFilter: (v: any) => void;
  copy: any;
  getTransactionStatus: (t: any) => string;
  getCategoryMeta: (c: string) => { icon: any; tone: string };
  formatDate: (d: string) => string;
  parseAmount: (v: unknown) => number;
  formatCurrency: (
    amount: number | null | undefined,
    currency?: string,
    opts?: any,
  ) => string;
  setPendingDelete: (t: any | null) => void;
  navigate: (path: string) => void;
  selectedWalletItem?: any;
  isVietnamese: boolean;
};

const transactionStatusText: any = {
  COMPLETED: { vi: "Đã ghi nhận", en: "Completed" },
  SCHEDULED: { vi: "Đã lên lịch", en: "Scheduled" },
  PENDING: { vi: "Đang chờ", en: "Pending" },
  FAILED: { vi: "Thất bại", en: "Failed" },
  CANCELLED: { vi: "Đã hủy", en: "Cancelled" },
};

const TransactionsPanel: React.FC<Props> = ({
  recentTransactions,
  transactionFilter,
  setTransactionFilter,
  copy,
  getTransactionStatus,
  getCategoryMeta,
  formatDate,
  parseAmount,
  formatCurrency,
  setPendingDelete,
  navigate,
  selectedWalletItem,
  isVietnamese,
}) => {
  return (
    <Card className="overflow-hidden xl:flex xl:h-full xl:flex-col">
      <CardHeader className="flex flex-col gap-3 border-b border-border/70 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle>{copy.transactionsTitle}</CardTitle>
          <CardDescription>{copy.transactionsDesc}</CardDescription>
        </div>

        <div className="hidden flex-wrap items-center gap-1.5 md:flex">
          {(["ALL", "INCOME", "EXPENSE"] as const).map((type) => (
            <Button
              className="h-8 whitespace-nowrap rounded-full px-2.5 text-xs"
              key={type}
              onClick={() => setTransactionFilter(type)}
              size="sm"
              variant={transactionFilter === type ? "default" : "outline"}
            >
              {type === "ALL"
                ? copy.all
                : type === "INCOME"
                  ? copy.income
                  : copy.expense}
            </Button>
          ))}
          <Button
            className="h-8 whitespace-nowrap rounded-full px-2.5 text-xs"
            onClick={() => navigate("/transactions")}
            size="sm"
            variant="outline"
          >
            {copy.openTransactions}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5 pt-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        {recentTransactions.length > 0 ? (
          recentTransactions.slice(0, 10).map((transaction) => {
            const isIncome = transaction.type === "INCOME";
            const isExpense = transaction.type === "EXPENSE";
            const transactionStatus = getTransactionStatus(transaction);
            const transactionLabel =
              transaction.note || transaction.category || copy.genericCategory;
            const categoryMeta = getCategoryMeta(transaction.category);
            const Icon = categoryMeta.icon;
            const walletName =
              (typeof transaction.walletId === "string"
                ? copy.unknownWallet
                : transaction.walletId?.name) ||
              selectedWalletItem?.name ||
              copy.unknownWallet;

            return (
              <div
                key={transaction._id}
                className="flex items-start justify-between gap-2.5 rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <div
                    className={
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--app-radius-md)-5px)] " +
                      categoryMeta.tone
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-foreground sm:text-sm">
                        {transactionLabel}
                      </p>
                      <Badge
                        className="h-5 rounded-full px-1.5 text-[10px]"
                        variant={
                          isIncome
                            ? "success"
                            : isExpense
                              ? "danger"
                              : "outline"
                        }
                      >
                        {isIncome
                          ? copy.transactionLabels.INCOME
                          : isExpense
                            ? copy.transactionLabels.EXPENSE
                            : copy.transactionLabels.OTHER}
                      </Badge>
                      {transactionStatus !== "COMPLETED" ? (
                        <Badge variant="outline">
                          {
                            transactionStatusText[transactionStatus as any][
                              isVietnamese ? "vi" : "en"
                            ]
                          }
                        </Badge>
                      ) : null}
                    </div>
                    <p className="hidden">
                      {walletName} •{" "}
                      {transaction.category || copy.genericCategory}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {walletName} •{" "}
                      {transaction.category || copy.genericCategory} •{" "}
                      {formatDate(transaction.date)}
                    </p>
                  </div>
                </div>

                <div className="ml-1.5 flex shrink-0 flex-col items-end gap-1">
                  <p
                    className={
                      "text-[13px] font-semibold sm:text-sm " +
                      (isIncome
                        ? "text-emerald-600"
                        : isExpense
                          ? "text-rose-600"
                          : "text-primary")
                    }
                  >
                    {isIncome ? "+" : isExpense ? "-" : ""}
                    {formatCurrency(parseAmount(transaction.amount))}
                  </p>
                  <Button
                    className="h-7 w-7 rounded-full"
                    onClick={() => setPendingDelete(transaction)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex min-h-[200px] items-center justify-center rounded-[var(--app-radius-lg)] border border-dashed border-border bg-muted/15 px-4 text-center text-sm text-muted-foreground sm:min-h-[240px] sm:px-6">
            {copy.noTransactions}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(TransactionsPanel);
