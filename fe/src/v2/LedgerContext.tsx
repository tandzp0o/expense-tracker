import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Transaction } from "./lib/types";
import { QuickAddPanel } from "./quick-add/QuickAddPanel";

export type QuickAddMode = "EXPENSE" | "INCOME" | "TRANSFER";

export interface QuickAddOptions {
  mode?: QuickAddMode;
  walletId?: string;
  toWalletId?: string;
  category?: string;
  amount?: number;
  note?: string;
  /** An existing income or expense to edit instead of creating a new one. */
  editing?: Transaction;
}

interface LedgerContextValue {
  /** Opens "Ghi nhanh" from anywhere: the rail, the + tab, a wallet row... */
  openQuickAdd: (options?: QuickAddOptions) => void;
  /**
   * Bumped after anything changes money. Screens list it in their effect
   * dependencies to refetch, so saving in the drawer updates the page behind.
   */
  dataVersion: number;
  notifyDataChanged: () => void;
}

const LedgerContext = createContext<LedgerContextValue>({
  openQuickAdd: () => undefined,
  dataVersion: 0,
  notifyDataChanged: () => undefined,
});

export const useLedger = () => useContext(LedgerContext);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [quickAdd, setQuickAdd] = useState<QuickAddOptions | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const notifyDataChanged = useCallback(
    () => setDataVersion((version) => version + 1),
    [],
  );
  const openQuickAdd = useCallback(
    (options: QuickAddOptions = {}) => setQuickAdd(options),
    [],
  );

  const value = useMemo(
    () => ({ openQuickAdd, dataVersion, notifyDataChanged }),
    [dataVersion, notifyDataChanged, openQuickAdd],
  );

  return (
    <LedgerContext.Provider value={value}>
      {children}
      <QuickAddPanel
        onClose={() => setQuickAdd(null)}
        onSaved={notifyDataChanged}
        options={quickAdd}
      />
    </LedgerContext.Provider>
  );
};
