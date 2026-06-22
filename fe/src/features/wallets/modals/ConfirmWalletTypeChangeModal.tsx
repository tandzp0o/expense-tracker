import React from "react";
import { ConfirmDialog } from "components/ui/dialog";

export interface ConfirmWalletTypeChangeModalCopy {
  cancel: string;
  changeType: string;
  changeTypeDesc: string;
  confirmTypeChange: string;
}

export interface ConfirmWalletTypeChangeModalProps {
  open: boolean;
  submitting: boolean;
  copy: ConfirmWalletTypeChangeModalCopy;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmWalletTypeChangeModal: React.FC<
  ConfirmWalletTypeChangeModalProps
> = ({ open, submitting, copy, onClose, onConfirm }) => (
  <ConfirmDialog
    busy={submitting}
    cancelLabel={copy.cancel}
    confirmLabel={copy.changeType}
    description={copy.changeTypeDesc}
    onClose={onClose}
    onConfirm={onConfirm}
    open={open}
    title={copy.confirmTypeChange}
  />
);
