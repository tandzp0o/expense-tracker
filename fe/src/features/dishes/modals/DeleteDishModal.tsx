import React from "react";
import { ConfirmDialog } from "components/ui/dialog";

export interface DishDeleteTarget {
  name: string;
}

export interface DeleteDishModalCopy {
  keep: string;
  delete: string;
  deleteDish: string;
  deleteDishDesc: (name: string) => string;
}

export interface DeleteDishModalProps {
  dish: DishDeleteTarget | null;
  saving: boolean;
  copy: DeleteDishModalCopy;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteDishModal: React.FC<DeleteDishModalProps> = ({
  dish,
  saving,
  copy,
  onClose,
  onConfirm,
}) => (
  <ConfirmDialog
    busy={saving}
    cancelLabel={copy.keep}
    confirmLabel={copy.delete}
    description={dish ? copy.deleteDishDesc(dish.name) : ""}
    onClose={onClose}
    onConfirm={onConfirm}
    open={!!dish}
    title={copy.deleteDish}
    variant="destructive"
  />
);
