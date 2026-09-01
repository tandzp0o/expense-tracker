import React from "react";
import {
  BookOpen,
  Car,
  CreditCard,
  Film,
  HeartPulse,
  LucideIcon,
  ReceiptText,
  ShoppingBag,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { Button } from "components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogSection,
} from "components/ui/dialog";
import { Input } from "components/ui/input";
import { Select } from "components/ui/select";
import { MoneyField } from "components/app/money-field";
import { cn } from "lib/utils";
import type { BudgetSummaryItem } from "../components/BudgetCards";

/**
 * Picking a category and picking its icon used to be two separate steps that
 * always ended up saying the same thing, so the tiles below do both at once:
 * `category` carries the meaning, `icon` is derived from the same choice.
 */
const CATEGORY_TILES: {
  category: string;
  icon: string;
  Icon: LucideIcon;
  vi: string;
  en: string;
}[] = [
  { category: "Ăn uống", icon: "utensils", Icon: UtensilsCrossed, vi: "Ăn uống", en: "Food" },
  { category: "Di chuyển", icon: "car", Icon: Car, vi: "Di chuyển", en: "Transport" },
  { category: "Mua sắm", icon: "shopping-bag", Icon: ShoppingBag, vi: "Mua sắm", en: "Shopping" },
  { category: "Giải trí", icon: "film", Icon: Film, vi: "Giải trí", en: "Entertainment" },
  { category: "Sức khỏe", icon: "heart-pulse", Icon: HeartPulse, vi: "Sức khỏe", en: "Health" },
  { category: "Giáo dục", icon: "book-open", Icon: BookOpen, vi: "Giáo dục", en: "Education" },
  { category: "Hóa đơn", icon: "receipt-text", Icon: ReceiptText, vi: "Hóa đơn", en: "Bills" },
  { category: "Khác", icon: "wallet", Icon: Wallet, vi: "Khác", en: "Other" },
];

const iconButtonClass = (active: boolean) =>
  cn(
    "flex h-[68px] w-[68px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-[var(--app-radius-md)] border px-1 transition-colors",
    active
      ? "border-primary bg-primary/10 text-primary shadow-sm"
      : "border-border bg-background text-muted-foreground hover:bg-muted",
  );

const COLOR_SWATCHES = [
  "#2E7D32",
  "#1565C0",
  "#6A1B9A",
  "#EF6C00",
  "#00838F",
  "#C62828",
  "#5D4037",
  "#455A64",
];

export interface BudgetFormData {
  walletId: string;
  category: string;
  categoryType: "standard" | "custom";
  customCategoryName: string;
  subcategory: string;
  icon: string;
  color: string;
  tags: string;
  amount: number;
}

interface WalletItem {
  _id: string;
  name: string;
}

export interface BudgetFormModalCopy {
  formDescription: string;
  editBudget: string;
  createBudgetTitle: string;
  wallet: string;
  amount: string;
  cancel: string;
  saving: string;
  updateBudget: string;
  createBudget: string;
}

export interface BudgetFormModalProps {
  open: boolean;
  editing: BudgetSummaryItem | null;
  isVietnamese: boolean;
  copy: BudgetFormModalCopy;
  formData: BudgetFormData;
  amountInput: string;
  wallets: WalletItem[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormDataChange: React.Dispatch<React.SetStateAction<BudgetFormData>>;
  onAmountChange: (value: string, numericValue: number) => void;
}

export const BudgetFormModal: React.FC<BudgetFormModalProps> = ({
  open,
  editing,
  isVietnamese,
  copy,
  formData,
  amountInput,
  wallets,
  submitting,
  onClose,
  onSubmit,
  onFormDataChange,
  onAmountChange,
}) => (
  <Dialog
    description={copy.formDescription}
    eyebrow={
      editing
        ? isVietnamese
          ? "Chỉnh ngân sách"
          : "Edit budget"
        : isVietnamese
          ? "Kế hoạch mới"
          : "New plan"
    }
    icon={CreditCard}
    onClose={onClose}
    open={open}
    title={editing ? copy.editBudget : copy.createBudgetTitle}
    tone="budget"
  >
    <div className="space-y-3">
      <DialogSection
        description={
          isVietnamese
            ? "Gắn ngân sách vào đúng ví để theo dõi reserve và chi tiêu chính xác."
            : "Attach this budget to the right wallet so reserve tracking stays accurate."
        }
        title={isVietnamese ? "Phạm vi áp dụng" : "Scope"}
      >
        <div>
          <label className="mb-2 block text-sm font-medium">{copy.wallet}</label>
          <Select
            onChange={(event) =>
              onFormDataChange((current) => ({
                ...current,
                walletId: event.target.value,
              }))
            }
            value={formData.walletId}
          >
            <option value="">{copy.wallet}</option>
            {wallets.map((wallet) => (
              <option key={wallet._id} value={wallet._id}>
                {wallet.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium">
            {isVietnamese ? "Nhóm chi tiêu" : "Spending category"}
          </label>
          <div className="-mx-1 flex w-full min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2">
            {CATEGORY_TILES.map((tile) => {
              const TileIcon = tile.Icon;
              const label = isVietnamese ? tile.vi : tile.en;

              return (
                <button
                  className={iconButtonClass(formData.category === tile.category)}
                  key={tile.category}
                  onClick={() =>
                    onFormDataChange((current) => ({
                      ...current,
                      category: tile.category,
                      icon: tile.icon,
                    }))
                  }
                  title={label}
                  type="button"
                >
                  <TileIcon className="h-5 w-5" />
                  <span className="max-w-full truncate text-[11px] leading-none">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isVietnamese
              ? "Lướt ngang để xem thêm. Biểu tượng của ngân sách lấy theo nhóm bạn chọn."
              : "Swipe sideways for more. The budget icon follows the category you pick."}
          </p>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium">
              {isVietnamese ? "Tên custom (nếu có)" : "Custom category name"}
            </label>
            <Input
              onChange={(event) =>
                onFormDataChange((current) => ({
                  ...current,
                  customCategoryName: event.target.value,
                  categoryType: event.target.value.trim() ? "custom" : "standard",
                }))
              }
              placeholder={
                isVietnamese
                  ? "Ví dụ: Chăm vợ, Dịch vụ mua sắm"
                  : "Example: Partner care, Service shopping"
              }
              value={formData.customCategoryName}
            />
          </div>
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium">
              {isVietnamese ? "Danh mục con" : "Subcategory"}
            </label>
            <Input
              onChange={(event) =>
                onFormDataChange((current) => ({
                  ...current,
                  subcategory: event.target.value,
                }))
              }
              placeholder={isVietnamese ? "Ví dụ: Ăn ngoài" : "Example: Eating out"}
              value={formData.subcategory}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              {isVietnamese ? "Màu" : "Color"}
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`color-${swatch}`}
                  className={`h-8 w-8 rounded-md border ${
                    formData.color === swatch
                      ? "border-foreground ring-2 ring-offset-2"
                      : "border-border"
                  }`}
                  onClick={() =>
                    onFormDataChange((current) => ({
                      ...current,
                      color: swatch,
                    }))
                  }
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogSection>

      <DialogSection
        description={
          isVietnamese
            ? "Nhập mức chi tối đa cho tháng này."
            : "Set the spending limit for this month."
        }
        title={isVietnamese ? "Hạn mức" : "Budget amount"}
      >
        <MoneyField
          label={copy.amount}
          onChange={onAmountChange}
          placeholder={copy.amount}
          value={amountInput}
        />
      </DialogSection>

      <DialogFooter>
        <Button className="w-full sm:w-auto" onClick={onClose} variant="outline">
          {copy.cancel}
        </Button>
        <Button className="w-full sm:w-auto" disabled={submitting} onClick={onSubmit}>
          {submitting
            ? copy.saving
            : editing
              ? copy.updateBudget
              : copy.createBudget}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>
);
