import React from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { MoneyField } from "components/app/money-field";
import { Button } from "components/ui/button";
import { Dialog, DialogFooter, DialogSection } from "components/ui/dialog";
import { Input } from "components/ui/input";
import { Select } from "components/ui/select";
import { formatCurrency } from "utils/formatters";

export type ContributionMode = "deposit" | "withdraw";

export interface ContributionWallet {
  _id: string;
  name: string;
  balance: number;
  currency?: string;
}

export interface GoalContributionModalProps {
  open: boolean;
  mode: ContributionMode;
  isVietnamese: boolean;
  goal: { title: string; currentAmount: number; targetAmount: number } | null;
  wallets: ContributionWallet[];
  walletId: string;
  amountInput: string;
  note: string;
  submitting: boolean;
  onWalletChange: (walletId: string) => void;
  onAmountChange: (value: string, numericValue: number) => void;
  onNoteChange: (note: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export const GoalContributionModal: React.FC<GoalContributionModalProps> = ({
  open,
  mode,
  isVietnamese,
  goal,
  wallets,
  walletId,
  amountInput,
  note,
  submitting,
  onWalletChange,
  onAmountChange,
  onNoteChange,
  onClose,
  onSubmit,
}) => {
  const isDeposit = mode === "deposit";
  const selectedWallet = wallets.find((wallet) => wallet._id === walletId);
  const remaining = goal
    ? Math.max(goal.targetAmount - goal.currentAmount, 0)
    : 0;

  return (
    <Dialog
      description={
        isDeposit
          ? isVietnamese
            ? "Tiền được chuyển từ ví sang mục tiêu, nên số dư ví sẽ giảm tương ứng."
            : "The money moves from a wallet into the goal, so the wallet balance drops accordingly."
          : isVietnamese
            ? "Tiền được trả ngược từ mục tiêu về ví và có thể tiêu lại bình thường."
            : "The money returns from the goal to a wallet and becomes spendable again."
      }
      eyebrow={goal?.title}
      icon={isDeposit ? ArrowDownToLine : ArrowUpFromLine}
      onClose={onClose}
      open={open}
      title={
        isDeposit
          ? isVietnamese
            ? "Nạp tiền vào mục tiêu"
            : "Add money to this goal"
          : isVietnamese
            ? "Rút tiền về ví"
            : "Withdraw back to a wallet"
      }
      tone="goal"
    >
      <div className="space-y-3">
        <DialogSection
          description={
            isDeposit
              ? isVietnamese
                ? "Chọn ví thực sự đang giữ số tiền này."
                : "Pick the wallet that actually holds this money."
              : isVietnamese
                ? "Chọn ví sẽ nhận lại số tiền."
                : "Pick the wallet that receives the money back."
          }
          title={isVietnamese ? "Nguồn tiền" : "Money source"}
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              {isVietnamese ? "Ví" : "Wallet"}
            </label>
            <Select
              onChange={(event) => onWalletChange(event.target.value)}
              value={walletId}
            >
              <option value="">
                {isVietnamese ? "Chọn ví" : "Select a wallet"}
              </option>
              {wallets.map((wallet) => (
                <option key={wallet._id} value={wallet._id}>
                  {`${wallet.name} - ${formatCurrency(wallet.balance, wallet.currency)}`}
                </option>
              ))}
            </Select>
            {isDeposit && selectedWallet ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {isVietnamese
                  ? `Số dư khả dụng: ${formatCurrency(selectedWallet.balance, selectedWallet.currency)}`
                  : `Available balance: ${formatCurrency(selectedWallet.balance, selectedWallet.currency)}`}
              </p>
            ) : null}
          </div>
        </DialogSection>

        <DialogSection
          description={
            isDeposit
              ? isVietnamese
                ? `Còn thiếu ${formatCurrency(remaining)} là đạt mục tiêu.`
                : `${formatCurrency(remaining)} left to reach the target.`
              : isVietnamese
                ? `Đang có ${formatCurrency(goal?.currentAmount || 0)} trong mục tiêu này.`
                : `${formatCurrency(goal?.currentAmount || 0)} is currently held in this goal.`
          }
          title={isVietnamese ? "Số tiền" : "Amount"}
        >
          <MoneyField
            label={isVietnamese ? "Số tiền" : "Amount"}
            onChange={onAmountChange}
            placeholder={isVietnamese ? "Số tiền" : "Amount"}
            value={amountInput}
          />
          <div>
            <label className="mb-2 block text-sm font-medium">
              {isVietnamese ? "Ghi chú" : "Note"}
            </label>
            <Input
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder={
                isVietnamese ? "Không bắt buộc" : "Optional"
              }
              value={note}
            />
          </div>
        </DialogSection>
      </div>

      <DialogFooter>
        <Button className="w-full sm:w-auto" onClick={onClose} variant="outline">
          {isVietnamese ? "Hủy" : "Cancel"}
        </Button>
        <Button
          className="w-full sm:w-auto"
          disabled={submitting}
          onClick={onSubmit}
        >
          {submitting
            ? isVietnamese
              ? "Đang lưu..."
              : "Saving..."
            : isDeposit
              ? isVietnamese
                ? "Nạp tiền"
                : "Add money"
              : isVietnamese
                ? "Rút về ví"
                : "Withdraw"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

export default GoalContributionModal;
