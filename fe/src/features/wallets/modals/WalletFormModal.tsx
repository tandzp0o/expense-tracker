import React from "react";
import {
  Banknote,
  Building2,
  Car,
  CreditCard,
  Home,
  LucideIcon,
  Plane,
  ShoppingCart,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  Wallet,
  WalletCards,
} from "lucide-react";
import { MoneyField } from "components/app/money-field";
import { Button } from "components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogSection,
} from "components/ui/dialog";
import { Input } from "components/ui/input";
import { cn } from "lib/utils";
import { colorOptions, iconOptions, walletTypeText } from "../constants";

const walletIconComponents: Record<string, LucideIcon> = {
  account_balance: Building2,
  payments: Banknote,
  credit_card: CreditCard,
  phone_android: Smartphone,
  wallet: Wallet,
  home: Home,
  directions_car: Car,
  flight: Plane,
  shopping_cart: ShoppingCart,
  restaurant: UtensilsCrossed,
};

const currencyOptions = ["VND", "USD", "EUR"] as const;

const iconButtonClass = (active: boolean) =>
  cn(
    "flex h-[68px] w-[68px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-[var(--app-radius-md)] border px-1 transition-colors",
    active
      ? "border-primary bg-primary/10 text-primary shadow-sm"
      : "border-border bg-background text-muted-foreground hover:bg-muted",
  );

const segmentButtonClass = (active: boolean) =>
  cn(
    "flex-1 rounded-[var(--app-radius-md)] border px-2 py-2 text-sm font-medium transition-colors",
    active
      ? "border-primary bg-primary/10 text-primary shadow-sm"
      : "border-border bg-background text-muted-foreground hover:bg-muted",
  );

export interface WalletFormValues {
  name: string;
  accountNumber: string;
  initialBalance: number;
  type: "cash" | "bank" | "ewallet";
  currency: string;
  icon: string;
  color: string;
}

export interface WalletFormModalCopy {
  formDescription: string;
  editWallet: string;
  createWalletTitle: string;
  cardImage: string;
  walletPreview: string;
  walletName: string;
  walletNamePlaceholder: string;
  accountNumber: string;
  walletType: string;
  currency: string;
  icon: string;
  auto: string;
  iconPlaceholder: string;
  iconHint: string;
  accentColor: string;
  startingBalance: string;
  startingBalancePlaceholder: string;
  cancel: string;
  saving: string;
  updateWallet: string;
  createWallet: string;
}

export interface WalletFormModalProps {
  open: boolean;
  editing: { name: string } | null;
  isVietnamese: boolean;
  language: "vi" | "en";
  copy: WalletFormModalCopy;
  formValues: WalletFormValues;
  initialBalanceInput: string;
  imagePreview: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormValuesChange: React.Dispatch<React.SetStateAction<WalletFormValues>>;
  onInitialBalanceChange: (value: string, numericValue: number) => void;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const WalletFormModal: React.FC<WalletFormModalProps> = ({
  open,
  editing,
  isVietnamese,
  language,
  copy,
  formValues,
  initialBalanceInput,
  imagePreview,
  submitting,
  onClose,
  onSubmit,
  onFormValuesChange,
  onInitialBalanceChange,
  onImageChange,
}) => (
  <Dialog
    className="max-w-3xl"
    description={copy.formDescription}
    eyebrow={
      editing
        ? isVietnamese
          ? "Chỉnh ví"
          : "Edit wallet"
        : isVietnamese
          ? "Thiết lập ví mới"
          : "New wallet setup"
    }
    icon={WalletCards}
    onClose={onClose}
    open={open}
    title={editing ? copy.editWallet : copy.createWalletTitle}
    tone="wallet"
  >
    <div className="space-y-3">
      <DialogSection
        description={
          isVietnamese
            ? "Thiết lập tên hiển thị, số tài khoản và hình ảnh để dễ nhận ra trên mobile."
            : "Set the display name, account hint, and image so the wallet is easy to spot on mobile."
        }
        title={isVietnamese ? "Nhận diện ví" : "Wallet identity"}
      >
        <div>
          <label className="mb-2 block text-sm font-medium">{copy.cardImage}</label>
          <Input accept="image/*" onChange={onImageChange} type="file" />
          {imagePreview ? (
            <img
              alt={copy.walletPreview}
              className="mt-3 h-28 w-full rounded-[var(--app-radius-lg)] object-cover sm:h-36"
              src={imagePreview}
            />
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div>
            <label className="mb-2 block text-sm font-medium">{copy.walletName}</label>
            <Input
              onChange={(event) =>
                onFormValuesChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder={copy.walletNamePlaceholder}
              value={formValues.name}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">{copy.accountNumber}</label>
            <Input
              onChange={(event) =>
                onFormValuesChange((current) => ({
                  ...current,
                  accountNumber: event.target.value,
                }))
              }
              value={formValues.accountNumber}
            />
          </div>
        </div>
      </DialogSection>

      <DialogSection
        description={
          isVietnamese
            ? "Chọn loại ví, đồng tiền, icon và màu nhấn để danh sách ví dễ quét hơn."
            : "Choose the wallet type, currency, icon, and accent for faster scanning."
        }
        title={isVietnamese ? "Thiết lập hiển thị" : "Display setup"}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">{copy.walletType}</label>
            <div className="flex gap-2">
              {(["cash", "bank", "ewallet"] as const).map((type) => (
                <button
                  className={segmentButtonClass(formValues.type === type)}
                  key={type}
                  onClick={() =>
                    onFormValuesChange((current) => ({
                      ...current,
                      type,
                    }))
                  }
                  type="button"
                >
                  {walletTypeText[type][language]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">{copy.currency}</label>
            <div className="flex gap-2">
              {currencyOptions.map((currency) => (
                <button
                  className={segmentButtonClass(formValues.currency === currency)}
                  key={currency}
                  onClick={() =>
                    onFormValuesChange((current) => ({
                      ...current,
                      currency,
                    }))
                  }
                  type="button"
                >
                  {currency}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">{copy.icon}</label>
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2">
            <button
              className={iconButtonClass(!formValues.icon)}
              onClick={() =>
                onFormValuesChange((current) => ({
                  ...current,
                  icon: "",
                }))
              }
              title={copy.auto}
              type="button"
            >
              <Sparkles className="h-5 w-5" />
              <span className="text-[11px] leading-none">{copy.auto}</span>
            </button>
            {iconOptions.map((option) => {
              const OptionIcon =
                walletIconComponents[option.value] || WalletCards;
              const label = language === "vi" ? option.vi : option.en;

              return (
                <button
                  className={iconButtonClass(formValues.icon === option.value)}
                  key={option.value}
                  onClick={() =>
                    onFormValuesChange((current) => ({
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
          <label className="mb-2 block text-sm font-medium">{copy.accentColor}</label>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((color) => (
              <button
                key={color}
                className={`h-9 w-9 rounded-[var(--app-radius-md)] border sm:h-10 sm:w-10 ${
                  formValues.color === color ? "border-foreground" : "border-border"
                }`}
                onClick={() =>
                  onFormValuesChange((current) => ({
                    ...current,
                    color,
                  }))
                }
                style={{ backgroundColor: color }}
                type="button"
              />
            ))}
          </div>
        </div>
      </DialogSection>

      <DialogSection
        description={
          isVietnamese
            ? "Số dư ban đầu là mốc theo dõi, chưa phải là giao dịch."
            : "The starting balance is your tracking baseline, not a new transaction."
        }
        title={isVietnamese ? "Số dư khởi tạo" : "Opening balance"}
      >
        <MoneyField
          label={copy.startingBalance}
          onChange={onInitialBalanceChange}
          placeholder={copy.startingBalancePlaceholder}
          value={initialBalanceInput}
        />
      </DialogSection>

      <DialogFooter>
        <Button className="w-full sm:w-auto" onClick={onClose} variant="outline">
          {copy.cancel}
        </Button>
        <Button
          className="w-full sm:w-auto"
          disabled={submitting}
          onClick={onSubmit}
        >
          {submitting
            ? copy.saving
            : editing
              ? copy.updateWallet
              : copy.createWallet}
        </Button>
      </DialogFooter>
    </div>
  </Dialog>
);
