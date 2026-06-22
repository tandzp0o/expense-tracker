import React from "react";
import { ConfirmDialog } from "components/ui/dialog";
import type { BudgetSummaryItem } from "../components/BudgetCards";

export interface DeleteBudgetModalCopy {
  keep: string;
  delete: string;
  deleteBudget: string;
  deleteBudgetDesc: (category: string) => string;
}

export interface DeleteBudgetModalProps {
  budget: BudgetSummaryItem | null;
  submitting: boolean;
  copy: DeleteBudgetModalCopy;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteBudgetModal: React.FC<DeleteBudgetModalProps> = ({
  budget,
  submitting,
  copy,
  onClose,
  onConfirm,
}) => (
  <ConfirmDialog
    busy={submitting}
    cancelLabel={copy.keep}
    confirmLabel={copy.delete}
    description={budget ? copy.deleteBudgetDesc(budget.category) : ""}
    onClose={onClose}
    onConfirm={onConfirm}
    open={!!budget}
    title={copy.deleteBudget}
    variant="destructive"
  />
);
