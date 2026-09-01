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
  Sparkles,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { STANDARD_EXPENSE_CATEGORY_OPTIONS } from "constants/categories";
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

const ICON_OPTIONS: { value: string; icon: LucideIcon; vi: string; en: string }[] =
  [
    { value: "shopping-bag", icon: ShoppingBag, vi: "Mua sắm", en: "Shopping" },
    { value: "utensils", icon: UtensilsCrossed, vi: "Ăn uống", en: "Food" },
    { value: "car", icon: Car, vi: "Di chuyển", en: "Transport" },
    { value: "film", icon: Film, vi: "Giải trí", en: "Fun" },
    { value: "heart-pulse", icon: HeartPulse, vi: "Sức khỏe", en: "Health" },
    { value: "book-open", icon: BookOpen, vi: "Học tập", en: "Study" },
    { value: "receipt-text", icon: ReceiptText, vi: "Hóa đơn", en: "Bills" },
    { value: "wallet", icon: Wallet, vi: "Khác", en: "Other" },
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
        <div className="grid gap-3 md:grid-cols-2">
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
          <div>
            <label className="mb-2 block text-sm font-medium">
              {isVietnamese ? "Danh mục cha" : "Parent category"}
            </label>
            <Select
              onChange={(event) =>
                onFormDataChange((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              value={formData.category}
            >
              <option value="">
                {isVietnamese ? "Chọn danh mục chuẩn" : "Select category"}
              </option>
              {STANDARD_EXPENSE_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {isVietnamese ? option.vi : option.en}
                </option>
              ))}
            </Select>
          </div>
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
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium">
              {isVietnamese ? "Icon" : "Icon"}
            </label>
            <div className="-mx-1 flex w-full min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2">
              <button
                className={iconButtonClass(!formData.icon)}
                onClick={() =>
                  onFormDataChange((current) => ({ ...current, icon: "" }))
                }
                title={isVietnamese ? "Tự động" : "Auto"}
                type="button"
              >
                <Sparkles className="h-5 w-5" />
                <span className="text-[11px] leading-none">
                  {isVietnamese ? "Tự động" : "Auto"}
                </span>
              </button>
              {ICON_OPTIONS.map((option) => {
                const OptionIcon = option.icon;
                const label = isVietnamese ? option.vi : option.en;

                return (
                  <button
                    className={iconButtonClass(formData.icon === option.value)}
                    key={option.value}
                    onClick={() =>
                      onFormDataChange((current) => ({
                        ...current,
                        icon: option.value,
                      }))
                    }
                    title={label}
                    type="button"
                  >
                    <OptionIcon className="h-5 w-5" />
                    <span className="max-w-full truncate text-[11px] leading-none">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isVietnamese
                ? "Lướt ngang để xem thêm biểu tượng."
                : "Swipe sideways to see more icons."}
            </p>
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
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">
              {isVietnamese ? "Tags (phân tách bằng dấu phẩy)" : "Tags (comma separated)"}
            </label>
            <Input
              onChange={(event) =>
                onFormDataChange((current) => ({
                  ...current,
                  tags: event.target.value,
                }))
              }
              placeholder={
                isVietnamese ? "cá nhân, gia đình, ưu tiên" : "personal, family, priority"
              }
              value={formData.tags}
            />
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
