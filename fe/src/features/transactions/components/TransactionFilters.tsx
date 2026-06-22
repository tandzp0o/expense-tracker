import React, { useState } from "react";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "lib/utils";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { Select } from "components/ui/select";

export type TransactionStatus =
  | "SCHEDULED"
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface WalletItem {
  _id: string;
  name: string;
}

interface TransactionFiltersProps {
  searchQuery: string;
  selectedCategory: string;
  selectedWallet: string;
  selectedStatus: TransactionStatus | "";
  categoryFilterOptions: string[];
  wallets: WalletItem[];
  language: "vi" | "en";
  statusOptions: Array<[
    TransactionStatus,
    {
      vi: string;
      en: string;
    },
  ]>;
  copy: {
    searchByNote: string;
    allCategories: string;
    allWallets: string;
    allStatuses: string;
    reset: string;
  };
  getCategoryLabel: (category: string) => string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onWalletChange: (value: string) => void;
  onStatusChange: (value: TransactionStatus | "") => void;
  onReset: () => void;
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  searchQuery,
  selectedCategory,
  selectedWallet,
  selectedStatus,
  categoryFilterOptions,
  wallets,
  language,
  statusOptions,
  copy,
  getCategoryLabel,
  onSearchChange,
  onCategoryChange,
  onWalletChange,
  onStatusChange,
  onReset,
}) => {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const hasActiveFilters = Boolean(
    selectedCategory || selectedWallet || selectedStatus,
  );
  const toggleFiltersLabel =
    language === "vi" ? "Hiển thị bộ lọc" : "Show filters";

  const searchField = (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={copy.searchByNote}
        value={searchQuery}
      />
    </div>
  );

  const categorySelect = (
    <Select
      onChange={(event) => onCategoryChange(event.target.value)}
      value={selectedCategory}
    >
      <option value="">{copy.allCategories}</option>
      {categoryFilterOptions.map((category) => (
        <option key={category} value={category}>
          {getCategoryLabel(category)}
        </option>
      ))}
    </Select>
  );

  const walletSelect = (
    <Select
      onChange={(event) => onWalletChange(event.target.value)}
      value={selectedWallet}
    >
      <option value="">{copy.allWallets}</option>
      {wallets.map((wallet) => (
        <option key={wallet._id} value={wallet._id}>
          {wallet.name}
        </option>
      ))}
    </Select>
  );

  const statusSelect = (
    <Select
      onChange={(event) =>
        onStatusChange(event.target.value as TransactionStatus | "")
      }
      value={selectedStatus}
    >
      <option value="">{copy.allStatuses}</option>
      {statusOptions.map(([value, label]) => (
        <option key={value} value={value}>
          {label[language]}
        </option>
      ))}
    </Select>
  );

  const resetButton = (
    <Button className="w-full md:w-auto" onClick={onReset} variant="outline">
      <Filter className="h-4 w-4" />
      {copy.reset}
    </Button>
  );

  return (
    <>
      <div className="space-y-3 md:hidden">
        <div className="flex items-center gap-2">
          {searchField}
          <Button
            aria-expanded={mobileFiltersOpen}
            aria-label={toggleFiltersLabel}
            className={cn(
              "relative shrink-0",
              hasActiveFilters &&
                "border-primary/40 bg-primary-soft text-primary hover:bg-primary-soft",
            )}
            onClick={() => setMobileFiltersOpen((current) => !current)}
            size="icon"
            variant="outline"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {hasActiveFilters ? (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
            ) : null}
          </Button>
        </div>

        {mobileFiltersOpen ? (
          <div className="grid gap-3">
            {categorySelect}
            {walletSelect}
            {statusSelect}
            {resetButton}
          </div>
        ) : null}
      </div>

      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-[1.3fr,1fr,1fr,1fr,auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={copy.searchByNote}
            value={searchQuery}
          />
        </div>
        {categorySelect}
        {walletSelect}
        {statusSelect}
        {resetButton}
      </div>
    </>
  );
};
