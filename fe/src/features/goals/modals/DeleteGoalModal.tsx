import React from "react";
import { ConfirmDialog } from "components/ui/dialog";

export interface GoalSummary {
  title: string;
}

export interface DeleteGoalModalCopy {
  keep: string;
  delete: string;
  deleteGoal: string;
  deleteGoalDesc: (title: string) => string;
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
    description={goal ? copy.deleteGoalDesc(goal.title) : ""}
    onClose={onClose}
    onConfirm={onConfirm}
    open={!!goal}
    title={copy.deleteGoal}
    variant="destructive"
  />
);
