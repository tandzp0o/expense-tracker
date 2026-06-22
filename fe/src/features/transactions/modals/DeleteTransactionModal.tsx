import React from "react";
import { ConfirmDialog } from "components/ui/dialog";
import type { Transaction } from "../components/TransactionList";

export interface DeleteTransactionModalCopy {
  keep: string;
  delete: string;
  deleteTransaction: string;
}

export interface DeleteTransactionModalProps {
  transaction: Transaction | null;
  submitting: boolean;
  copy: DeleteTransactionModalCopy;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteTransactionModal: React.FC<DeleteTransactionModalProps> = ({
  transaction,
  submitting,
  copy,
  description,
  onClose,
  onConfirm,
}) => (
  <ConfirmDialog
    busy={submitting}
    cancelLabel={copy.keep}
    confirmLabel={copy.delete}
    description={description}
    onClose={onClose}
    onConfirm={onConfirm}
    open={!!transaction}
    title={copy.deleteTransaction}
    variant="destructive"
  />
);
