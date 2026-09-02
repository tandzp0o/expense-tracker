import React from "react";
import { ReceiptText } from "lucide-react";
import { MoneyField } from "components/app/money-field";
import { Button } from "components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogSection,
} from "components/ui/dialog";
import { Input } from "components/ui/input";
import { Select } from "components/ui/select";
import { Textarea } from "components/ui/textarea";
import { incomeCategoryOptions } from "../constants";
import type { Transaction, TransactionStatus } from "../components/TransactionList";
import type { WalletItem } from "../components/TransactionFilters";

export interface TransactionFormValues {
  type: "INCOME" | "EXPENSE";
  status: TransactionStatus;
  amount: number;
  note: string;
  category: string;
  budgetId: string;
  walletId: string;
  date: string;
}

export interface ExpenseBudgetOption {
  _id: string;
  category: string;
  remaining: number;
  amount: number;
}

export interface ComposerModeBanner {
  badge: string;
  title: string;
  description: string;
  tone: string;
}

export interface TransactionFormModalCopy {
  formDescription: string;
  editTransaction: string;
  createTransactionTitle: string;
  type: string;
  status: string;
  amount: string;
  typeExpense: string;
  typeIncome: string;
  expenseBudget: string;
  incomeCategory: string;
  selectBudget: string;
  loadingBudgets: string;
  budgetHint: string;
  budgetEmpty: string;
  wallet: string;
  selectWallet: string;
  date: string;
  statusHelp: string;
  note: string;
  whatHappened: string;
  otherIncomeNotePlaceholder: string;
  otherIncomeNoteHint: string;
  cancel: string;
  saving: string;
  updateTransaction: string;
  createTransaction: string;
}

export interface TransactionFormModalProps {
  open: boolean;
  editing: Transaction | null;
  isVietnamese: boolean;
  language: "vi" | "en";
  copy: TransactionFormModalCopy;
  formValues: TransactionFormValues;
  amountInput: string;
  wallets: WalletItem[];
  expenseBudgets: ExpenseBudgetOption[];
  expenseBudgetsLoading: boolean;
  incomeCategoryOptionsForForm: ReadonlyArray<{
    value: string;
    vi: string;
    en: string;
  }>;
  composerModeCopy: ComposerModeBanner | null;
  shouldHighlightIncomeOtherNote: boolean;
  submitting: boolean;
  formatCurrency: (value: number) => string;
  getTransactionStatusLabel: (status?: TransactionStatus) => string;
  onClose: () => void;
  onSubmit: () => void;
  onFormValuesChange: React.Dispatch<React.SetStateAction<TransactionFormValues>>;
  onAmountChange: (value: string, numericValue: number) => void;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  open,
  editing,
  isVietnamese,
  language,
  copy,
  formValues,
  amountInput,
  wallets,
  expenseBudgets,
  expenseBudgetsLoading,
  incomeCategoryOptionsForForm,
  composerModeCopy,
  shouldHighlightIncomeOtherNote,
  submitting,
  formatCurrency,
  getTransactionStatusLabel,
  onClose,
  onSubmit,
  onFormValuesChange,
  onAmountChange,
}) => (
  <Dialog
    description={copy.formDescription}
    eyebrow={
      editing
        ? isVietnamese
          ? "Cập nhật giao dịch"
          : "Edit transaction"
        : isVietnamese
          ? "Ghi nhận mới"
          : "New transaction"
    }
    icon={ReceiptText}
    onClose={onClose}
    open={open}
    title={editing ? copy.editTransaction : copy.createTransactionTitle}
    tone="transaction"
  >
    <div className="space-y-3">
      {composerModeCopy ? (
        <div
          className={`rounded-[var(--app-radius-lg)] border px-4 py-3 ${composerModeCopy.tone}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            {composerModeCopy.badge}
          </p>
          <p className="mt-2 text-sm font-semibold">{composerModeCopy.title}</p>
          <p className="mt-1 text-xs leading-5 opacity-90">
            {composerModeCopy.description}
          </p>
        </div>
      ) : null}

      <DialogSection
        description={
          isVietnamese
            ? "Chọn loại, trạng thái và số tiền trước khi gắn giao dịch vào ví."
            : "Set the transaction type, lifecycle status, and amount first."
        }
        title={isVietnamese ? "Thiết lập nhanh" : "Quick setup"}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">{copy.type}</label>
            <Select
              onChange={(event) =>
                onFormValuesChange((current) => {
                  const nextType = event.target.value as "INCOME" | "EXPENSE";
                  if (nextType === current.type) {
                    return current;
                  }
                  return {
                    ...current,
                    type: nextType,
                    category:
                      nextType === "INCOME" ? incomeCategoryOptions[0].value : "",
                    budgetId: "",
                  };
                })
              }
              value={formValues.type}
            >
              <option value="EXPENSE">{copy.typeExpense}</option>
              <option value="INCOME">{copy.typeIncome}</option>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">{copy.status}</label>
            <Select
              onChange={(event) =>
                onFormValuesChange((current) => ({
                  ...current,
                  status: event.target.value as TransactionStatus,
                }))
              }
              value={formValues.status}
            >
              <option value="COMPLETED">
                {getTransactionStatusLabel("COMPLETED")}
              </option>
              <option value="SCHEDULED">
                {getTransactionStatusLabel("SCHEDULED")}
              </option>
              <option value="PENDING">
                {getTransactionStatusLabel("PENDING")}
              </option>
            </Select>
          </div>
          <MoneyField
            className="md:col-span-2"
            label={copy.amount}
            onChange={onAmountChange}
            placeholder={copy.amount}
            type="desktop"
            value={amountInput}
          />
        </div>
      </DialogSection>

      <DialogSection
        description={
          isVietnamese
            ? "Ví là nơi tiền đi ra, ngân sách là hạn mức của nhóm chi tiêu. Khoản thu dùng nhóm thu nhập riêng."
            : "The wallet is where the money leaves from; the budget is the category cap. Income uses its own groups."
        }
        title={
          isVietnamese ? "Nguồn tiền và phân loại" : "Source and classification"
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {formValues.type === "EXPENSE" ? copy.expenseBudget : copy.incomeCategory}
            </label>
            {formValues.type === "EXPENSE" ? (
              <>
                <Select
                  onChange={(event) => {
                    const nextBudget = expenseBudgets.find(
                      (budget) => budget._id === event.target.value,
                    );
                    onFormValuesChange((current) => ({
                      ...current,
                      budgetId: event.target.value,
                      category: nextBudget?.category || "",
                    }));
                  }}
                  value={formValues.budgetId}
                >
                  <option value="">{copy.selectBudget}</option>
                  {expenseBudgets.map((budget) => (
                    <option key={budget._id} value={budget._id}>
                      {`${budget.category} - ${formatCurrency(budget.remaining)} / ${formatCurrency(budget.amount)}`}
                    </option>
                  ))}
                </Select>
                <p className="mt-2 text-xs text-muted-foreground">
                  {expenseBudgetsLoading
                    ? copy.loadingBudgets
                    : expenseBudgets.length > 0
                      ? copy.budgetHint
                      : copy.budgetEmpty}
                </p>
                {!expenseBudgetsLoading && !formValues.budgetId ? (
                  <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    {isVietnamese
                      ? "Khoản chi này sẽ được ghi vào mục Chi tiêu tự do."
                      : "This expense will be recorded under Free spending."}
                  </p>
                ) : null}
              </>
            ) : (
              <Select
                onChange={(event) =>
                  onFormValuesChange((current) => ({
                    ...current,
                    category: event.target.value,
                    budgetId: "",
                  }))
                }
                value={formValues.category}
              >
                {incomeCategoryOptionsForForm.map((category) => (
                  <option key={category.value} value={category.value}>
                    {language === "vi" ? category.vi : category.en}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">{copy.wallet}</label>
            <Select
              onChange={(event) =>
                onFormValuesChange((current) => ({
                  ...current,
                  walletId: event.target.value,
                  ...(current.type === "EXPENSE" ? { budgetId: "", category: "" } : {}),
                }))
              }
              value={formValues.walletId}
            >
              <option value="">{copy.selectWallet}</option>
              {wallets.map((wallet) => (
                <option key={wallet._id} value={wallet._id}>
                  {wallet.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </DialogSection>

      <DialogSection
        description={
          isVietnamese
            ? "Ghi thêm ngữ cảnh để sau này xem lại dòng tiền dễ hơn."
            : "Add the date and context so the entry remains clear later."
        }
        title={isVietnamese ? "Thời điểm và ghi chú" : "Timing and note"}
      >
        <div>
          <label className="mb-2 block text-sm font-medium">{copy.date}</label>
          <Input
            onChange={(event) =>
              onFormValuesChange((current) => ({
                ...current,
                date: event.target.value,
              }))
            }
            type="date"
            value={formValues.date}
          />
          <p className="mt-2 text-xs text-muted-foreground">{copy.statusHelp}</p>
        </div>
        <div>
          <label
            className={`mb-2 block text-sm font-medium ${
              shouldHighlightIncomeOtherNote ? "text-amber-700" : ""
            }`}
          >
            {copy.note}
          </label>
          <Textarea
            className={
              shouldHighlightIncomeOtherNote
                ? "border-amber-300 bg-amber-50/40 focus-visible:ring-amber-200"
                : undefined
            }
            onChange={(event) =>
              onFormValuesChange((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
            placeholder={
              shouldHighlightIncomeOtherNote
                ? copy.otherIncomeNotePlaceholder
                : copy.whatHappened
            }
            value={formValues.note}
          />
          {shouldHighlightIncomeOtherNote ? (
            <p className="mt-2 text-xs text-amber-700">{copy.otherIncomeNoteHint}</p>
          ) : null}
        </div>
      </DialogSection>

      <DialogFooter>
        <Button className="w-full sm:w-auto" onClick={onClose} variant="outline">
          {copy.cancel}
        </Button>
        <Button className="w-full sm:w-auto" disabled={submitting} onClick={onSubmit}>
          {submitting
            ? copy.saving
            : editing
              ? copy.updateTransaction
              : copy.createTransaction}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>
);
