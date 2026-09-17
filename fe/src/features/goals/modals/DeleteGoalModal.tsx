import React from "react";
import { ConfirmDialog } from "components/ui/dialog";

export interface GoalSummary {
  title: string;
  currentAmount?: number;
}

export interface DeleteGoalModalCopy {
  keep: string;
  delete: string;
  deleteGoal: string;
  deleteGoalDesc: (title: string) => string;
  refundNotice: (amount: number) => string;
}

export interface DeleteGoalModalProps {
  goal: GoalSummary | null;
  saving: boolean;
  copy: DeleteGoalModalCopy;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteGoalModal: React.FC<DeleteGoalModalProps> = ({
  goal,
  saving,
  copy,
  onClose,
  onConfirm,
}) => (
  <ConfirmDialog
    busy={saving}
    cancelLabel={copy.keep}
    confirmLabel={copy.delete}
    description={
      goal
        ? [
            copy.deleteGoalDesc(goal.title),
            // Say up front that the savings come back, so deleting a funded goal
            // does not feel like throwing the money away.
            Number(goal.currentAmount || 0) > 0
              ? copy.refundNotice(Number(goal.currentAmount))
              : "",
          ]
            .filter(Boolean)
            .join(" ")
        : ""
    }
    onClose={onClose}
    onConfirm={onConfirm}
    open={!!goal}
    title={copy.deleteGoal}
    variant="destructive"
  />
);
