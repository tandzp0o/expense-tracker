import React from "react";
import { ConfirmDialog } from "components/ui/dialog";

export interface WalletDeleteTarget {
  name: string;
  hasTransactions?: boolean;
}

export interface DeleteWalletModalCopy {
  keep: string;
  delete: string;
  archive: string;
  removeWallet: string;
  archiveWalletDesc: string;
  deleteWalletDesc: (name: string) => string;
}

export interface DeleteWalletModalProps {
  wallet: WalletDeleteTarget | null;
  submitting: boolean;
  copy: DeleteWalletModalCopy;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteWalletModal: React.FC<DeleteWalletModalProps> = ({
  wallet,
  submitting,
  copy,
  onClose,
  onConfirm,
}) => (
  <ConfirmDialog
    busy={submitting}
    cancelLabel={copy.keep}
    confirmLabel={wallet?.hasTransactions ? copy.archive : copy.delete}
    description={
      wallet?.hasTransactions
        ? copy.archiveWalletDesc
        : wallet
          ? copy.deleteWalletDesc(wallet.name)
          : ""
    }
    onClose={onClose}
    onConfirm={onConfirm}
    open={!!wallet}
    title={copy.removeWallet}
    variant="destructive"
  />
);
