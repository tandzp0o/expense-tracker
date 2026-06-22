import React from "react";
import { CreditCard } from "lucide-react";
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
import type { BudgetSummaryItem } from "../components/BudgetCards";

const ICON_OPTIONS = [
  "shopping-bag",
  "utensils",
  "car",
  "film",
  "heart-pulse",
  "book-open",
  "receipt-text",
  "wallet",
];

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
          <div>
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
          <div>
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
              {isVietnamese ? "Icon" : "Icon"}
            </label>
            <Select
              onChange={(event) =>
                onFormDataChange((current) => ({
                  ...current,
                  icon: event.target.value,
                }))
              }
              value={formData.icon}
            >
              <option value="">{isVietnamese ? "Chọn icon" : "Select icon"}</option>
              {ICON_OPTIONS.map((iconName) => (
                <option key={iconName} value={iconName}>
                  {iconName}
                </option>
              ))}
            </Select>
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
