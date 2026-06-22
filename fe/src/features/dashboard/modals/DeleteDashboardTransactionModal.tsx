import React from "react";
import { ConfirmDialog } from "components/ui/dialog";

export interface DashboardTransactionDeleteTarget {
  _id: string;
  note?: string;
  category?: string;
}

export interface DeleteDashboardTransactionModalCopy {
  keep: string;
  delete: string;
  deleteTransaction: string;
  genericCategory: string;
  deleteTransactionDesc: (label: string) => string;
}

export interface DeleteDashboardTransactionModalProps {
  transaction: DashboardTransactionDeleteTarget | null;
  deleting: boolean;
  copy: DeleteDashboardTransactionModalCopy;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteDashboardTransactionModal: React.FC<
  DeleteDashboardTransactionModalProps
> = ({ transaction, deleting, copy, onClose, onConfirm }) => (
  <ConfirmDialog
    busy={deleting}
    cancelLabel={copy.keep}
    confirmLabel={copy.delete}
    description={
      transaction
        ? copy.deleteTransactionDesc(
            transaction.note ||
              transaction.category ||
              copy.genericCategory,
          )
        : ""
    }
    onClose={onClose}
    onConfirm={onConfirm}
    open={!!transaction}
    title={copy.deleteTransaction}
    variant="destructive"
  />
);
