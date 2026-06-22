import React from "react";
import { LucideIcon, PencilLine, ReceiptText, Trash2 } from "lucide-react";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import { EmptyState } from "components/app/empty-state";

export type TransactionStatus =
  | "SCHEDULED"
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface WalletItem {
  _id: string;
  name: string;
}

export interface Transaction {
  _id: string;
  walletId: string | { _id: string; name?: string };
  budgetId?: string;
  type: "INCOME" | "EXPENSE" | "GOAL_DEPOSIT" | "GOAL_WITHDRAW";
  status?: TransactionStatus;
  amount: number | string;
  category: string;
  date: string;
  note?: string;
  transferGroupId?: string;
}

interface TransactionListCopy {
  transactionList: string;
  transactionListDesc: (
    page: number,
    totalPages: number,
    totalTransactions: number,
  ) => string;
  showingRows: (count: number) => string;
  previous: string;
  next: string;
  untitledTransaction: string;
  noTransactions: string;
  noTransactionsDescWithWallet: string;
  noTransactionsDescWithoutWallet: string;
  createTransaction: string;
  note: string;
  category: string;
  wallet: string;
  date: string;
  type: string;
  status: string;
  amount: string;
  action: string;
}

interface TransactionListEmptyState {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon: LucideIcon;
}

interface TransactionListProps {
  transactions: Transaction[];
  copy: TransactionListCopy;
  header?: {
    title: string;
    description: string;
  };
  emptyState?: TransactionListEmptyState;
  getWalletName: (walletId: Transaction["walletId"]) => string;
  getCategoryLabel: (category: string) => string;
  getTransactionStatus: (transaction: Transaction) => TransactionStatus;
  getTransactionStatusLabel: (status?: TransactionStatus) => string;
  getTransactionTypeLabel: (type: Transaction["type"]) => string;
  parseAmount: (amount: string | number) => number;
  formatDate: (date: string) => string;
  formatCurrency: (value: number) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  page: number;
  totalPages: number;
  totalTransactions: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

const DesktopTransactionRow = React.memo(
  ({
    transaction,
    copy,
    getWalletName,
    getCategoryLabel,
    getTransactionStatus,
    getTransactionStatusLabel,
    getTransactionTypeLabel,
    parseAmount,
    formatDate,
    formatCurrency,
    onEdit,
    onDelete,
  }: {
    transaction: Transaction;
    copy: TransactionListCopy;
    getWalletName: (walletId: Transaction["walletId"]) => string;
    getCategoryLabel: (category: string) => string;
    getTransactionStatus: (transaction: Transaction) => TransactionStatus;
    getTransactionStatusLabel: (status?: TransactionStatus) => string;
    getTransactionTypeLabel: (type: Transaction["type"]) => string;
    parseAmount: (amount: string | number) => number;
    formatDate: (date: string) => string;
    formatCurrency: (value: number) => string;
    onEdit: (transaction: Transaction) => void;
    onDelete: (transaction: Transaction) => void;
  }) => {
    const transactionStatus = getTransactionStatus(transaction);
    const isCompleted = transactionStatus === "COMPLETED";
    const amount = parseAmount(transaction.amount);
    const isIncome = transaction.type === "INCOME";

    return (
      <tr className="border-b border-border/70 text-sm last:border-b-0">
        <td className="py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-[calc(var(--app-radius-md)-4px)] bg-primary-soft text-primary">
              <ReceiptText className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {transaction.note || copy.untitledTransaction}
              </p>
            </div>
          </div>
        </td>
        <td className="py-3.5 text-muted-foreground">
          {getCategoryLabel(transaction.category)}
        </td>
        <td className="py-3.5 text-muted-foreground">
          {getWalletName(transaction.walletId)}
        </td>
        <td className="py-3.5 text-muted-foreground">
          {formatDate(transaction.date)}
        </td>
        <td className="py-3.5">
          <Badge variant={transaction.type === "INCOME" ? "success" : "danger"}>
            {getTransactionTypeLabel(transaction.type)}
          </Badge>
        </td>
        <td className="py-3.5">
          <Badge
            className={
              isCompleted
                ? undefined
                : "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            }
            variant="outline"
          >
            {getTransactionStatusLabel(transaction.status)}
          </Badge>
        </td>
        <td className="py-3.5 text-right font-semibold">
          <span
            className={
              isCompleted
                ? isIncome
                  ? "text-emerald-600"
                  : "text-rose-600"
                : "text-amber-600"
            }
          >
            {isIncome ? "+" : "-"}
            {formatCurrency(amount)}
          </span>
        </td>
        <td className="py-3.5">
          <div className="flex justify-end gap-2">
            <Button onClick={() => onEdit(transaction)} size="icon" variant="ghost">
              <PencilLine className="h-4 w-4" />
            </Button>
            <Button onClick={() => onDelete(transaction)} size="icon" variant="ghost">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
    );
  },
);

const MobileTransactionItem = React.memo(
  ({
    transaction,
    copy,
    getCategoryLabel,
    getWalletName,
    getTransactionStatus,
    getTransactionStatusLabel,
    getTransactionTypeLabel,
    parseAmount,
    formatDate,
    formatCurrency,
    onEdit,
    onDelete,
  }: {
    transaction: Transaction;
    copy: TransactionListCopy;
    getCategoryLabel: (category: string) => string;
    getWalletName: (walletId: Transaction["walletId"]) => string;
    getTransactionStatus: (transaction: Transaction) => TransactionStatus;
    getTransactionStatusLabel: (status?: TransactionStatus) => string;
    getTransactionTypeLabel: (type: Transaction["type"]) => string;
    parseAmount: (amount: string | number) => number;
    formatDate: (date: string) => string;
    formatCurrency: (value: number) => string;
    onEdit: (transaction: Transaction) => void;
    onDelete: (transaction: Transaction) => void;
  }) => {
    const amount = parseAmount(transaction.amount);
    const isIncome = transaction.type === "INCOME";
    const walletName = getWalletName(transaction.walletId);
    const transactionStatus = getTransactionStatus(transaction);
    const amountTone =
      transactionStatus === "COMPLETED"
        ? isIncome
          ? "text-sm font-semibold text-emerald-600"
          : "text-sm font-semibold text-rose-600"
        : "text-sm font-semibold text-amber-600";

    return (
      <div className="rounded-[var(--app-radius-lg)] border border-border/70 bg-muted/20 px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--app-radius-md)-5px)] bg-primary-soft text-primary">
              <ReceiptText className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {transaction.note || copy.untitledTransaction}
              </p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {getCategoryLabel(transaction.category)} • {walletName} • {formatDate(transaction.date)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge className="h-5 whitespace-nowrap rounded-full px-2 text-[10px] leading-none" variant={isIncome ? "success" : "danger"}>
              {getTransactionTypeLabel(transaction.type)}
            </Badge>
            {transactionStatus !== "COMPLETED" ? (
              <Badge className="h-5 whitespace-nowrap rounded-full px-2 text-[10px] leading-none" variant="outline">
                {getTransactionStatusLabel(transaction.status)}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={amountTone}>
            {isIncome ? "+" : "-"}
            {formatCurrency(amount)}
          </span>
          <div className="flex items-center gap-1">
            <Button className="h-7 w-7" onClick={() => onEdit(transaction)} size="icon" variant="ghost">
              <PencilLine className="h-3.5 w-3.5" />
            </Button>
            <Button className="h-7 w-7" onClick={() => onDelete(transaction)} size="icon" variant="ghost">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  copy,
  header,
  emptyState,
  getWalletName,
  getCategoryLabel,
  getTransactionStatus,
  getTransactionStatusLabel,
  getTransactionTypeLabel,
  parseAmount,
  formatDate,
  formatCurrency,
  onEdit,
  onDelete,
  page,
  totalPages,
  totalTransactions,
  onPrevPage,
  onNextPage,
}) => (
  <Card>
    {header ? (
      <CardHeader>
        <CardTitle>{header.title}</CardTitle>
        <CardDescription>{header.description}</CardDescription>
      </CardHeader>
    ) : null}
    <CardContent>
      {transactions.length === 0 && emptyState ? (
        <EmptyState
          actionLabel={emptyState.actionLabel}
          description={emptyState.description}
          icon={emptyState.icon}
          onAction={emptyState.onAction}
          title={emptyState.title}
        />
      ) : (
        <>
      <div className="space-y-2.5 md:hidden">
        {transactions.map((transaction) => (
          <MobileTransactionItem
            key={transaction._id}
            transaction={transaction}
            copy={copy}
            getCategoryLabel={getCategoryLabel}
            getWalletName={getWalletName}
            getTransactionStatus={getTransactionStatus}
            getTransactionStatusLabel={getTransactionStatusLabel}
            getTransactionTypeLabel={getTransactionTypeLabel}
            parseAmount={parseAmount}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-border text-sm text-muted-foreground">
              <th className="pb-3 font-medium">{copy.note}</th>
              <th className="pb-3 font-medium">{copy.category}</th>
              <th className="pb-3 font-medium">{copy.wallet}</th>
              <th className="pb-3 font-medium">{copy.date}</th>
              <th className="pb-3 font-medium">{copy.type}</th>
              <th className="pb-3 font-medium">{copy.status}</th>
              <th className="pb-3 font-medium text-right">{copy.amount}</th>
              <th className="pb-3 font-medium text-right">{copy.action}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <DesktopTransactionRow
                key={transaction._id}
                transaction={transaction}
                copy={copy}
                getWalletName={getWalletName}
                getCategoryLabel={getCategoryLabel}
                getTransactionStatus={getTransactionStatus}
                getTransactionStatusLabel={getTransactionStatusLabel}
                getTransactionTypeLabel={getTransactionTypeLabel}
                parseAmount={parseAmount}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          {copy.showingRows(transactions.length)}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button className="w-full sm:w-auto" disabled={page <= 1} onClick={onPrevPage} variant="outline">
            {copy.previous}
          </Button>
          <Button className="w-full sm:w-auto" disabled={page >= totalPages} onClick={onNextPage} variant="outline">
            {copy.next}
          </Button>
        </div>
      </div>
        </>
      )}
    </CardContent>
  </Card>
);
