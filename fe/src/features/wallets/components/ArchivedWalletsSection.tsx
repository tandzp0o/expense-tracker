import React from "react";
import {
  Archive,
  Building2,
  ChevronDown,
  RotateCcw,
  Smartphone,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "utils/formatters";
import { Badge } from "components/ui/badge";
import { Button } from "components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "components/ui/card";
import { walletTypeText } from "../constants";

export interface ArchivedWalletItem {
  _id: string;
  name: string;
  balance: number;
  currency: string;
  type: "cash" | "bank" | "ewallet";
}

export interface ArchivedWalletsSectionCopy {
  archivedWallets: string;
  archivedWalletsDesc: string;
  archivedWalletsCount: (count: number) => string;
  show: string;
  hide: string;
  restore: string;
  restoring: string;
}

export interface ArchivedWalletsSectionProps {
  wallets: ArchivedWalletItem[];
  language: "vi" | "en";
  copy: ArchivedWalletsSectionCopy;
  open: boolean;
  onToggle: () => void;
  onRestore: (wallet: ArchivedWalletItem) => void;
  /** Id of the wallet currently being restored, so only its row shows a busy state. */
  restoringWalletId: string | null;
}

const typeIcons = {
  bank: Building2,
  ewallet: Smartphone,
  cash: Wallet,
} as const;

export const ArchivedWalletsSection: React.FC<
  ArchivedWalletsSectionProps
> = ({
  wallets,
  language,
  copy,
  open,
  onToggle,
  onRestore,
  restoringWalletId,
}) => {
  // An empty archive is not worth a card: the section only exists to undo an
  // accidental archive, so it stays invisible until there is something to undo.
  if (wallets.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-0">
        <button
          aria-expanded={open}
          className="flex w-full items-start justify-between gap-3 text-left"
          onClick={onToggle}
          type="button"
        >
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-muted-foreground" />
              {copy.archivedWallets}
              <Badge variant="secondary">
                {copy.archivedWalletsCount(wallets.length)}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              {copy.archivedWalletsDesc}
            </CardDescription>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 pt-1 text-xs font-semibold text-muted-foreground">
            {open ? copy.hide : copy.show}
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </span>
        </button>
      </CardHeader>

      {open ? (
        <CardContent className="space-y-2 pt-4">
          {wallets.map((wallet) => {
            const Icon = typeIcons[wallet.type] || Wallet;
            const restoring = restoringWalletId === wallet._id;

            return (
              <div
                key={wallet._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--app-radius-md)] border border-border/70 bg-muted/20 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--app-radius-md)] bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {wallet.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {walletTypeText[wallet.type][language]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Archived balances keep their own currency because they are
                      never folded into the converted page totals. */}
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(wallet.balance, wallet.currency, {
                      displayMode: "full",
                    })}
                  </p>
                  <Button
                    disabled={restoring}
                    onClick={() => onRestore(wallet)}
                    size="sm"
                    variant="outline"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {restoring ? copy.restoring : copy.restore}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      ) : null}
    </Card>
  );
};

export default ArchivedWalletsSection;
