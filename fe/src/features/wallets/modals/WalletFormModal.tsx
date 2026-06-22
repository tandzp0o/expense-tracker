import React from "react";
import { WalletCards } from "lucide-react";
import { MoneyField } from "components/app/money-field";
import { Button } from "components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogSection,
} from "components/ui/dialog";
import { Input } from "components/ui/input";
import { Select } from "components/ui/select";
import { colorOptions, iconOptions, walletTypeText } from "../constants";

export interface WalletFormValues {
  name: string;
  accountNumber: string;
  initialBalance: number;
  type: "cash" | "bank" | "ewallet";
  currency: string;
  icon: string;
  color: string;
}

export type BindTargetRef = (
  targetRef: React.MutableRefObject<HTMLElement | null>,
  selector?: string,
) => (node: HTMLDivElement | null) => void;

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
  bindTargetRef: BindTargetRef;
  fieldRefs: {
    image: React.MutableRefObject<HTMLElement | null>;
    name: React.MutableRefObject<HTMLElement | null>;
    accountNumber: React.MutableRefObject<HTMLElement | null>;
    type: React.MutableRefObject<HTMLElement | null>;
    currency: React.MutableRefObject<HTMLElement | null>;
    icon: React.MutableRefObject<HTMLElement | null>;
    balance: React.MutableRefObject<HTMLElement | null>;
  };
  submitButtonRef?: React.Ref<HTMLButtonElement>;
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
  bindTargetRef,
  fieldRefs,
  submitButtonRef,
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
        <div ref={bindTargetRef(fieldRefs.image, 'input[type="file"]')}>
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
          <div ref={bindTargetRef(fieldRefs.name, "input")}>
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
          <div ref={bindTargetRef(fieldRefs.accountNumber, "input")}>
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
          <div ref={bindTargetRef(fieldRefs.type, "select")}>
            <label className="mb-2 block text-sm font-medium">{copy.walletType}</label>
            <Select
              onChange={(event) =>
                onFormValuesChange((current) => ({
                  ...current,
                  type: event.target.value as WalletFormValues["type"],
                }))
              }
              value={formValues.type}
            >
              <option value="cash">{walletTypeText.cash[language]}</option>
              <option value="bank">{walletTypeText.bank[language]}</option>
              <option value="ewallet">{walletTypeText.ewallet[language]}</option>
            </Select>
          </div>
          <div ref={bindTargetRef(fieldRefs.currency, "select")}>
            <label className="mb-2 block text-sm font-medium">{copy.currency}</label>
            <Select
              onChange={(event) =>
                onFormValuesChange((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
              value={formValues.currency}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div ref={bindTargetRef(fieldRefs.icon, "input")}>
            <label className="mb-2 block text-sm font-medium">{copy.icon}</label>
            <Input
              list="wallet-icon-suggestions"
              onChange={(event) =>
                onFormValuesChange((current) => ({
                  ...current,
                  icon: event.target.value,
                }))
              }
              placeholder={copy.iconPlaceholder}
              value={formValues.icon}
            />
            <datalist id="wallet-icon-suggestions">
              <option value="">{copy.auto}</option>
              {iconOptions.map((option) => (
                <option
                  key={option.value}
                  label={language === "vi" ? option.vi : option.en}
                  value={option.value}
                />
              ))}
            </datalist>
            <p className="mt-2 text-xs text-muted-foreground">{copy.iconHint}</p>
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
          fieldRef={bindTargetRef(fieldRefs.balance, "input")}
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
          ref={submitButtonRef}
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
