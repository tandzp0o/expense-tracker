import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  ChevronRight,
  CircleCheck,
  Clock,
  Ellipsis,
  Info,
  Pencil,
  Plus,
  ReceiptText,
  Scale,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { walletApi } from "services/api";
import { useAuth } from "contexts/AuthContext";
import { SUPPORTED_CURRENCIES, useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { cn } from "lib/utils";
import { WALLET_TYPE_META, WalletIcon, WalletRow } from "../components/finance";
import { ConfirmDialog, Panel } from "../components/overlays";
import {
  Button,
  EmptyState,
  Eyebrow,
  FieldLabel,
  HeroStrip,
  Money,
  Notice,
  PageHeader,
  Segmented,
  SkeletonRows,
  TextInput,
} from "../components/primitives";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useLedger } from "../LedgerContext";
import { formatAmountInput, formatMoney, parseAmountInput, todayKey } from "../lib/format";
import { useT } from "../lib/i18n";
import { extractWarnings, getIdToken } from "../lib/session";
import { toAmount, type Wallet, type WalletType } from "../lib/types";

const WALLET_TYPES: WalletType[] = ["cash", "bank", "ewallet"];

// The v1 palette, so a colour picked there is still recognised as selected.
const COLOR_OPTIONS = [
  "#2563eb",
  "#0f766e",
  "#7c3aed",
  "#dc2626",
  "#ea580c",
  "#0891b2",
  "#475569",
];

const isHexColor = (value?: string) => Boolean(value && /^#[0-9a-f]{6}$/i.test(value));

const currencySuffix = (currency?: string) =>
  !currency || currency === "VND" ? "₫" : currency;

/** The server's `{ payload }` on a refused update, when there is one. */
const errorPayload = (error: unknown) =>
  ((error as { payload?: Record<string, unknown> })?.payload || {}) as {
    message?: string;
    field?: string;
    requiresConfirmation?: boolean;
    requiresAdjustment?: boolean;
  };

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : undefined;

/* ------------------------------------------------------------ Row actions */

const iconActionClass = (danger?: boolean) =>
  cn(
    "flex h-8 w-8 items-center justify-center rounded-[8px] text-ledger-muted transition-colors hover:bg-ledger-canvas",
    danger ? "hover:text-ledger-out" : "hover:text-ledger-ink",
  );

const IconAction: React.FC<{
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
}> = ({ icon: Icon, label, onClick, to, danger }) =>
  to ? (
    <Link aria-label={label} className={iconActionClass(danger)} title={label} to={to}>
      <Icon className="h-4 w-4" />
    </Link>
  ) : (
    <button
      aria-label={label}
      className={iconActionClass(danger)}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  );

/** One line of the phone's action sheet: big enough for a thumb, labelled in words. */
const SheetAction: React.FC<{
  icon: LucideIcon;
  label: string;
  detail?: string;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
}> = ({ icon: Icon, label, detail, onClick, to, danger }) => {
  const body = (
    <>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ledger-canvas",
          danger ? "text-ledger-out" : "text-ledger-ink-2",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[14.5px] font-medium",
            danger ? "text-ledger-out" : "text-ledger-ink",
          )}
        >
          {label}
        </span>
        {detail ? (
          <span className="block text-[12.5px] text-ledger-muted">{detail}</span>
        ) : null}
      </span>
    </>
  );
  const classes =
    "flex w-full items-center gap-3 border-b border-ledger-line py-3 text-left last:border-b-0";

  return to ? (
    <Link className={classes} onClick={onClick} to={to}>
      {body}
    </Link>
  ) : (
    <button className={classes} onClick={onClick} type="button">
      {body}
    </button>
  );
};

/* ------------------------------------------------------------ Amount field */

const AmountInput: React.FC<{
  id: string;
  value: number;
  currency?: string;
  onChange: (value: number) => void;
}> = ({ id, value, currency, onChange }) => (
  <div className="flex h-11 items-center gap-2 rounded-[10px] border border-ledger-line bg-ledger-paper px-3.5 transition-colors focus-within:border-ledger-accent">
    <input
      className="ledger-num h-full w-full min-w-0 bg-transparent text-[15px] font-medium text-ledger-ink outline-none placeholder:text-ledger-muted"
      id={id}
      inputMode="numeric"
      onChange={(event) => onChange(parseAmountInput(event.target.value))}
      placeholder="0"
      value={formatAmountInput(value)}
    />
    <span className="shrink-0 text-[14px] font-medium text-ledger-muted">
      {currencySuffix(currency)}
    </span>
  </div>
);

/* ------------------------------------------------------------- Wallet form */

/**
 * Create or edit a wallet. What the server would refuse is never offered as
 * an input: once a wallet has transactions its opening balance and currency
 * are shown as facts, and the way to correct a balance is "Cân đối ví".
 */
const WalletFormPanel: React.FC<{
  open: boolean;
  wallet: Wallet | null;
  onClose: () => void;
  onSaved: () => void;
  onReconcile: (wallet: Wallet) => void;
}> = ({ open, wallet, onClose, onSaved, onReconcile }) => {
  const t = useT();
  const isDesktop = useIsDesktop();
  const { isVietnamese, defaultCurrency } = useLocale();
  const { currentUser, updateUserStatus } = useAuth();
  const { toast } = useToast();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<WalletType>("cash");
  const [accountNumber, setAccountNumber] = useState("");
  const [color, setColor] = useState("");
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [initialBalance, setInitialBalance] = useState(0);
  const [saving, setSaving] = useState(false);
  // Set when the server asks to confirm a type change on a wallet with history.
  const [confirmingType, setConfirmingType] = useState(false);

  const editing = wallet;
  const balanceLocked = Boolean(editing?.hasTransactions);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(wallet?.name || "");
    setType(wallet?.type || "cash");
    setAccountNumber(wallet?.accountNumber || "");
    setColor(isHexColor(wallet?.color) ? String(wallet?.color) : "");
    setCurrency(wallet?.currency || defaultCurrency);
    setInitialBalance(wallet ? toAmount(wallet.initialBalance) : 0);
    setConfirmingType(false);
  }, [defaultCurrency, open, wallet]);

  useEffect(() => {
    if (open && isDesktop) {
      window.setTimeout(() => nameRef.current?.focus(), 60);
    }
  }, [open, isDesktop]);

  // A colour saved earlier that is not in today's palette stays pickable, so
  // opening the form and saving it does not quietly repaint the wallet.
  const colorChoices = useMemo(
    () =>
      isHexColor(wallet?.color) &&
      !COLOR_OPTIONS.some((option) => option.toLowerCase() === wallet?.color?.toLowerCase())
        ? [...COLOR_OPTIONS, String(wallet?.color)]
        : COLOR_OPTIONS,
    [wallet],
  );

  const typeMeta = WALLET_TYPE_META[type];
  const preview: Wallet = {
    _id: wallet?._id || "preview",
    name,
    type,
    balance: 0,
    color: color || undefined,
  };
  const canSave = name.trim().length > 0;

  const submit = async (confirmTypeChange = false) => {
    if (!canSave || saving) {
      return;
    }

    setSaving(true);
    try {
      const token = await getIdToken();
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("type", type);

      if (editing) {
        // Sent even when empty: clearing the field has to actually clear it,
        // and an empty colour hands the icon back to the type's own colour.
        formData.append("accountNumber", accountNumber.trim());
        formData.append("color", color);
        // The server refuses any opening-balance change once a wallet has
        // transactions, so it only travels when it is editable and changed.
        if (!balanceLocked && initialBalance !== toAmount(editing.initialBalance)) {
          formData.append("initialBalance", String(initialBalance));
        }
        if (confirmTypeChange) {
          formData.append("confirmTypeChange", "true");
        }
      } else {
        if (accountNumber.trim()) {
          formData.append("accountNumber", accountNumber.trim());
        }
        if (color) {
          formData.append("color", color);
        }
        formData.append("currency", currency);
        formData.append("initialBalance", String(initialBalance));
      }

      const response = editing
        ? await walletApi.updateWallet(editing._id, formData, token)
        : await walletApi.createWallet(formData, token);

      // The first wallet is what unlocks the rest of the app for a new user;
      // the server has already flipped the flag, this mirrors it locally.
      if (!editing && currentUser?.newUser) {
        updateUserStatus(false);
      }

      toast({
        title: editing
          ? t("Đã lưu thay đổi của ví", "Wallet saved")
          : t(`Đã tạo ví ${name.trim()}`, `${name.trim()} created`),
        variant: "success",
      });
      extractWarnings(response).forEach((warning) =>
        toast({ title: warning.message, variant: "default" }),
      );

      setConfirmingType(false);
      onSaved();
      onClose();
    } catch (error) {
      const payload = errorPayload(error);
      if (payload.requiresConfirmation && payload.field === "type") {
        setConfirmingType(true);
      } else if (payload.requiresAdjustment) {
        // Only reachable when the list was stale about the wallet's history.
        toast({
          title: t("Không đổi được số dư ban đầu", "The opening balance is fixed"),
          description: t(
            "Ví này đã có giao dịch. Dùng Cân đối ví để sửa số dư.",
            "This wallet already has transactions. Use Reconcile to correct its balance.",
          ),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("Chưa lưu được ví", "Could not save the wallet"),
          description: errorMessage(error),
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      {isDesktop ? (
        <Button onClick={onClose} variant="ghost">
          {t("Huỷ", "Cancel")}
        </Button>
      ) : null}
      <Button
        block={!isDesktop}
        disabled={!canSave || saving}
        form="ledger-wallet-form"
        size={isDesktop ? "md" : "lg"}
        type="submit"
      >
        {saving
          ? t("Đang lưu...", "Saving...")
          : editing
            ? t("Lưu thay đổi", "Save changes")
            : t("Tạo ví", "Create wallet")}
      </Button>
    </div>
  );

  return (
    <>
      <Panel
        footer={footer}
        onClose={onClose}
        open={open}
        title={editing ? t("Sửa ví", "Edit wallet") : t("Thêm ví", "New wallet")}
      >
        <form
          className="flex flex-col gap-5"
          id="ledger-wallet-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(false);
          }}
        >
          <div>
            <FieldLabel htmlFor="wallet-name">{t("Tên ví", "Name")}</FieldLabel>
            <div className="flex items-center gap-3">
              <WalletIcon size={44} wallet={preview} />
              <TextInput
                id="wallet-name"
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("Ví dụ: Tiền mặt, Vietcombank, MoMo", "e.g. Cash, Vietcombank, MoMo")}
                ref={nameRef}
                value={name}
              />
            </div>
          </div>

          <div>
            <FieldLabel>{t("Loại ví", "Type")}</FieldLabel>
            <Segmented
              onChange={setType}
              options={WALLET_TYPES.map((value) => ({
                value,
                label: isVietnamese ? WALLET_TYPE_META[value].vi : WALLET_TYPE_META[value].en,
              }))}
              value={type}
            />
          </div>

          <div>
            <FieldLabel
              hint={t("Không bắt buộc", "Optional")}
              htmlFor="wallet-account"
            >
              {t("Số tài khoản", "Account number")}
            </FieldLabel>
            <TextInput
              id="wallet-account"
              maxLength={40}
              onChange={(event) => setAccountNumber(event.target.value)}
              placeholder={t("4 số cuối là đủ để nhận ra, ví dụ **** 4417", "The last 4 digits are enough, e.g. **** 4417")}
              value={accountNumber}
            />
          </div>

          <div>
            <FieldLabel hint={color ? undefined : t("Theo loại ví", "Follows the type")}>
              {t("Màu", "Colour")}
            </FieldLabel>
            <div className="flex flex-wrap gap-2.5" role="radiogroup">
              {["", ...colorChoices].map((option) => {
                const selected = option.toLowerCase() === color.toLowerCase();
                const ring = "0 0 0 2px var(--l-paper), 0 0 0 4px var(--l-ink)";
                return (
                  <button
                    aria-checked={selected}
                    aria-label={option ? option : t("Theo loại ví", "Follows the type")}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-105"
                    key={option || "auto"}
                    onClick={() => setColor(option)}
                    role="radio"
                    // The type's own colour moves with the type, so it is drawn
                    // as an outline wearing the type's icon rather than as one
                    // more fixed swatch.
                    style={
                      option
                        ? { backgroundColor: option, boxShadow: selected ? ring : undefined }
                        : {
                            color: typeMeta.color,
                            boxShadow: `inset 0 0 0 2px ${typeMeta.color}${selected ? `, ${ring}` : ""}`,
                          }
                    }
                    title={option ? option : t("Theo loại ví", "Follows the type")}
                    type="button"
                  >
                    {option ? null : <typeMeta.icon className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {!editing ? (
            <div>
              <FieldLabel>{t("Tiền tệ", "Currency")}</FieldLabel>
              <Segmented
                onChange={setCurrency}
                options={SUPPORTED_CURRENCIES.map((code) => ({ value: code as string, label: code }))}
                value={currency}
              />
              <p className="mt-2 text-[12.5px] text-ledger-muted">
                {t(
                  "Không đổi được nữa khi ví đã có giao dịch.",
                  "It cannot be changed once the wallet has transactions.",
                )}
              </p>
            </div>
          ) : null}

          {editing && balanceLocked ? (
            <div>
              <dl className="grid grid-cols-2 divide-x divide-ledger-line border-y border-ledger-line py-3">
                <div className="min-w-0 pr-4">
                  <dt>
                    <Eyebrow>{t("Số dư ban đầu", "Opening balance")}</Eyebrow>
                  </dt>
                  <dd className="mt-1 text-[15px] font-semibold">
                    <Money amount={toAmount(editing.initialBalance)} currency={editing.currency} />
                  </dd>
                </div>
                <div className="min-w-0 pl-4">
                  <dt>
                    <Eyebrow>{t("Tiền tệ", "Currency")}</Eyebrow>
                  </dt>
                  <dd className="mt-1 text-[15px] font-semibold text-ledger-ink">
                    {editing.currency || "VND"}
                  </dd>
                </div>
              </dl>
              <Notice
                action={
                  <button
                    className="text-[13px] font-semibold text-ledger-accent hover:underline"
                    onClick={() => onReconcile(editing)}
                    type="button"
                  >
                    {t("Cân đối ví", "Reconcile")}
                  </button>
                }
                className="mt-3"
                icon={Info}
                tone="blue"
              >
                {t(
                  "Ví đã có giao dịch nên số dư ban đầu và tiền tệ được giữ cố định để lịch sử vẫn khớp. Số dư đang lệch với tiền thực có? Hãy cân đối ví.",
                  "This wallet has transactions, so its opening balance and currency stay fixed to keep the history consistent. Balance off from what you actually hold? Reconcile it.",
                )}
              </Notice>
            </div>
          ) : (
            <div>
              <FieldLabel
                hint={editing ? `${t("Tiền tệ", "Currency")}: ${editing.currency || "VND"}` : undefined}
                htmlFor="wallet-opening"
              >
                {t("Số dư ban đầu", "Opening balance")}
              </FieldLabel>
              <AmountInput
                currency={editing ? editing.currency : currency}
                id="wallet-opening"
                onChange={setInitialBalance}
                value={initialBalance}
              />
              <p className="mt-2 text-[12.5px] text-ledger-muted">
                {t(
                  "Số tiền đang có trong ví lúc này. Đây là mốc bắt đầu, không tính là một khoản thu.",
                  "What the wallet holds right now. It is the starting point, not an income.",
                )}
              </p>
            </div>
          )}
        </form>
      </Panel>

      <ConfirmDialog
        busy={saving}
        cancelLabel={t("Giữ loại cũ", "Keep the old type")}
        confirmLabel={t("Đổi loại", "Change type")}
        description={t(
          `Ví này đã có giao dịch. Đổi sang “${typeMeta.vi}” sẽ thay đổi cách các báo cáo cũ phân loại ví; số dư và giao dịch vẫn giữ nguyên.`,
          `This wallet has transactions. Switching it to “${typeMeta.en}” changes how past reports group it; the balance and transactions stay as they are.`,
        )}
        onClose={() => setConfirmingType(false)}
        onConfirm={() => void submit(true)}
        open={confirmingType}
        title={t("Đổi loại ví?", "Change the wallet type?")}
        tone="primary"
      />
    </>
  );
};

/* ------------------------------------------------------------- Reconcile */

/**
 * "Cân đối ví": the user types what they actually hold and the server records
 * the difference as an ordinary income or expense, so the history still
 * explains the balance instead of the number being overwritten.
 */
const ReconcilePanel: React.FC<{
  wallet: Wallet | null;
  onClose: () => void;
  onDone: () => void;
}> = ({ wallet, onClose, onDone }) => {
  const t = useT();
  const isDesktop = useIsDesktop();
  const { timezoneOffsetMinutes } = useLocale();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultNote = t(
    "Cân đối lại số dư ví theo số tiền thực tế",
    "Balance adjusted to the amount actually held",
  );

  // Digits as typed; empty means "not answered yet", which is not the same
  // thing as an actual balance of 0 — an empty wallet is a real answer.
  const [input, setInput] = useState("");
  const [note, setNote] = useState(defaultNote);
  const [saving, setSaving] = useState(false);

  const walletId = wallet?._id;
  useEffect(() => {
    if (!walletId) {
      return;
    }
    setInput("");
    setNote(defaultNote);
    if (isDesktop) {
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [defaultNote, isDesktop, walletId]);

  const typed = input !== "";
  const actual = parseAmountInput(input);
  const actualText = typed ? (actual === 0 ? "0" : formatAmountInput(actual)) : "";
  const current = toAmount(wallet?.balance);
  const difference = actual - current;
  const today = todayKey(timezoneOffsetMinutes);
  const todayLabel = `${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`;

  const submit = async () => {
    if (!wallet || !typed || saving) {
      return;
    }

    setSaving(true);
    try {
      const response = await walletApi.reconcileWallet(
        wallet._id,
        { actualBalance: actual, note: note.trim() || undefined },
        await getIdToken(),
      );
      // The server speaks Vietnamese only; English readers get the same
      // sentence from here.
      toast({
        title: t(
          response?.message || "Đã cân đối ví",
          difference === 0
            ? "Already matching, nothing to record"
            : difference > 0
              ? "An income was recorded to match the actual balance"
              : "An expense was recorded to match the actual balance",
        ),
        variant: "success",
      });
      extractWarnings(response).forEach((warning) =>
        toast({ title: warning.message, variant: "default" }),
      );
      onDone();
      onClose();
    } catch (error) {
      toast({
        title: t("Chưa cân đối được ví", "Could not reconcile the wallet"),
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      {isDesktop ? (
        <Button onClick={onClose} variant="ghost">
          {t("Huỷ", "Cancel")}
        </Button>
      ) : null}
      <Button
        block={!isDesktop}
        disabled={!typed || saving}
        form="ledger-reconcile-form"
        size={isDesktop ? "md" : "lg"}
        type="submit"
      >
        {saving ? t("Đang lưu...", "Saving...") : t("Cân đối ví", "Reconcile")}
      </Button>
    </div>
  );

  const walletName = wallet?.name || "";
  const typeMeta = wallet ? WALLET_TYPE_META[wallet.type] || WALLET_TYPE_META.cash : null;
  // "Tiền mặt · Tiền mặt" says nothing twice, so the type is dropped when it
  // is also the wallet's name.
  const walletDetail = typeMeta
    ? [t(typeMeta.vi, typeMeta.en), wallet?.accountNumber]
        .filter((part) => part && part !== walletName)
        .join(" · ")
    : "";

  return (
    <Panel
      footer={footer}
      onClose={onClose}
      open={Boolean(wallet)}
      title={t("Cân đối ví", "Reconcile wallet")}
    >
      {wallet ? (
        <form
          className="flex flex-col gap-5"
          id="ledger-reconcile-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="text-[13.5px] leading-relaxed text-ledger-ink-2">
            {t(
              "Nhập số tiền thực tế bạn đang có trong ví. Phần chênh lệch sẽ được ghi thành một giao dịch để lịch sử vẫn khớp.",
              "Enter the amount you actually hold in this wallet. The difference is recorded as a transaction so the history still adds up.",
            )}
          </p>

          <div className="flex items-center gap-3 rounded-[12px] border border-ledger-line px-3.5 py-2.5">
            <Eyebrow>{t("Ví", "Wallet")}</Eyebrow>
            <span className="ml-auto flex min-w-0 items-center gap-2.5">
              <WalletIcon size={30} wallet={wallet} />
              <span className="min-w-0 text-right">
                <span className="block truncate text-[14px] font-medium text-ledger-ink">
                  {walletName}
                </span>
                {walletDetail ? (
                  <span className="block truncate text-[12px] text-ledger-muted">
                    {walletDetail}
                  </span>
                ) : null}
              </span>
            </span>
          </div>

          <div className="grid overflow-hidden rounded-[12px] border border-ledger-line sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 border-b border-ledger-line px-4 py-3.5 sm:block sm:border-b-0 sm:border-r sm:py-4">
              <Eyebrow>{t("Số dư đang ghi", "Recorded balance")}</Eyebrow>
              <Money
                amount={current}
                className="block text-[17px] font-semibold sm:mt-2.5 sm:text-[22px]"
                currency={wallet.currency}
                tone={current < 0 ? "out" : "neutral"}
              />
            </div>
            <label className="block px-4 py-3.5 sm:py-4" htmlFor="reconcile-actual">
              <Eyebrow>{t("Số dư thực tế", "Actual balance")}</Eyebrow>
              <span className="mt-1 flex cursor-text items-baseline gap-1.5 border-b-2 border-ledger-line pb-0.5 transition-colors focus-within:border-ledger-accent">
                {/* An invisible copy of the digits sizes the input, so the
                    currency sign sits right after the number the way the
                    amount reads everywhere else. */}
                <span className="relative min-w-0 overflow-hidden">
                  <span
                    aria-hidden
                    className="ledger-num invisible block pr-0.5 text-[30px] font-semibold leading-tight tracking-[-0.02em]"
                  >
                    {actualText || "0"}
                  </span>
                  <input
                    className="ledger-num absolute inset-0 h-full w-full bg-transparent text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ledger-ink outline-none placeholder:text-ledger-line-strong"
                    id="reconcile-actual"
                    inputMode="numeric"
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "");
                      setInput(digits ? String(parseAmountInput(digits)) : "");
                    }}
                    placeholder="0"
                    ref={inputRef}
                    value={actualText}
                  />
                </span>
                <span className="shrink-0 text-[20px] font-semibold text-ledger-muted">
                  {currencySuffix(wallet.currency)}
                </span>
              </span>
            </label>
          </div>

          {typed ? (
            difference === 0 ? (
              <Notice icon={CircleCheck} tone="muted">
                {t(
                  "Số dư đã khớp với số tiền thực có, sẽ không có giao dịch nào được ghi thêm.",
                  "The balance already matches what you hold, so nothing will be recorded.",
                )}
              </Notice>
            ) : (
              <Notice
                detail={t(
                  "Khoản này nằm trong nhóm Điều chỉnh số dư, xoá được nếu nhập nhầm.",
                  "It is filed under Balance adjustment and can be deleted if this was a mistake.",
                )}
                icon={difference > 0 ? TrendingUp : TrendingDown}
                tone="blue"
              >
                {difference > 0
                  ? t(
                      `Chênh lệch ${formatMoney(difference, wallet.currency)} sẽ được ghi thành một khoản thu vào ví ${walletName}.`,
                      `The ${formatMoney(difference, wallet.currency)} difference will be recorded as income into ${walletName}.`,
                    )
                  : t(
                      `Chênh lệch ${formatMoney(-difference, wallet.currency)} sẽ được ghi thành một khoản chi từ ví ${walletName}.`,
                      `The ${formatMoney(-difference, wallet.currency)} difference will be recorded as an expense from ${walletName}.`,
                    )}
              </Notice>
            )
          ) : null}

          <div>
            <FieldLabel htmlFor="reconcile-note">
              {t("Ghi chú (không bắt buộc)", "Note (optional)")}
            </FieldLabel>
            <TextInput
              id="reconcile-note"
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </div>

          <p className="flex items-center gap-2 text-[12.5px] text-ledger-muted">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {t(`Ghi vào hôm nay, ${todayLabel}.`, `Recorded today, ${todayLabel}.`)}
          </p>
        </form>
      ) : null}
    </Panel>
  );
};

/* ------------------------------------------------------------------- Page */

const WalletsPage: React.FC = () => {
  const t = useT();
  const { isVietnamese } = useLocale();
  const { toast } = useToast();
  const { dataVersion, notifyDataChanged, openQuickAdd } = useLedger();
  const [searchParams, setSearchParams] = useSearchParams();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [archived, setArchived] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  // The wallet is copied in when the form opens, so a refresh behind the
  // drawer cannot reset what the user is typing.
  const [form, setForm] = useState<{ wallet: Wallet | null } | null>(null);
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<Wallet | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Wallet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        // The one screen that asks for archived wallets: it is the only place
        // that can hand them back.
        const response = await walletApi.getWallets(await getIdToken(), {
          includeArchived: true,
        });
        if (!active) {
          return;
        }
        const all: Wallet[] = response?.wallets || [];
        setWallets(all.filter((wallet) => !wallet.isArchived));
        setArchived(all.filter((wallet) => wallet.isArchived));
      } catch (error) {
        if (active) {
          toast({
            title: t("Không tải được danh sách ví", "Could not load wallets"),
            description: errorMessage(error),
            variant: "destructive",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [dataVersion, t, toast]);

  // Deep links from other screens: "Cân đối ví" on the dashboard or in Quick
  // add, and the new-user lock's "create your first wallet". Cleared once
  // handled so a refresh does not reopen the panel.
  useEffect(() => {
    if (loading) {
      return;
    }
    const reconcileParam = searchParams.get("reconcile");
    const createParam = searchParams.get("create");
    if (!reconcileParam && createParam !== "1") {
      return;
    }

    if (reconcileParam) {
      if ([...wallets, ...archived].some((wallet) => wallet._id === reconcileParam)) {
        setReconcileId(reconcileParam);
      } else {
        toast({
          title: t("Không tìm thấy ví cần cân đối", "That wallet could not be found"),
          variant: "default",
        });
      }
    } else {
      setForm({ wallet: null });
    }
    setSearchParams({}, { replace: true });
  }, [archived, loading, searchParams, setSearchParams, t, toast, wallets]);

  const reconcileWallet = useMemo(
    () =>
      reconcileId
        ? [...wallets, ...archived].find((wallet) => wallet._id === reconcileId) || null
        : null,
    [archived, reconcileId, wallets],
  );

  const totals = useMemo(() => {
    const byType: Record<WalletType, number> = { cash: 0, bank: 0, ewallet: 0 };
    let total = 0;
    wallets.forEach((wallet) => {
      const balance = toAmount(wallet.balance);
      byType[WALLET_TYPE_META[wallet.type] ? wallet.type : "cash"] += balance;
      total += balance;
    });
    return { byType, total };
  }, [wallets]);

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) {
      return;
    }

    const target = pendingDelete;
    setDeleting(true);
    try {
      const response = await walletApi.deleteWallet(target._id, await getIdToken());
      // The server decides by counting transactions, so its answer wins over
      // the flag the dialog was worded from.
      const wasArchived = Boolean(response?.data?.archived);
      toast({
        title: wasArchived
          ? t(`Đã lưu trữ ví ${target.name}`, `${target.name} archived`)
          : t(`Đã xoá ví ${target.name}`, `${target.name} deleted`),
        description:
          t(
            response?.message || "",
            wasArchived
              ? "It keeps its history and can be restored from Archived wallets at any time."
              : "The wallet was deleted permanently.",
          ) || undefined,
        variant: "success",
      });
      if (wasArchived) {
        setArchivedOpen(true);
      }
      setPendingDelete(null);
      notifyDataChanged();
    } catch (error) {
      toast({
        title: t("Chưa xoá được ví", "Could not remove the wallet"),
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const restore = async (wallet: Wallet) => {
    if (restoringId) {
      return;
    }

    setRestoringId(wallet._id);
    try {
      // Only the flag travels. Echoing the opening balance back would trip
      // the server's guard, and an archived wallet always has transactions.
      const formData = new FormData();
      formData.append("isArchived", "false");
      await walletApi.updateWallet(wallet._id, formData, await getIdToken());
      toast({
        title: t(`Đã khôi phục ví ${wallet.name}`, `${wallet.name} restored`),
        description: t(
          "Ví đã quay lại danh sách và được tính vào tổng số dư.",
          "It is back in the list and counted in your totals again.",
        ),
        variant: "success",
      });
      notifyDataChanged();
    } catch (error) {
      toast({
        title: t("Chưa khôi phục được ví", "Could not restore the wallet"),
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setRestoringId(null);
    }
  };

  const typeLabel = (type: WalletType) =>
    isVietnamese ? WALLET_TYPE_META[type].vi : WALLET_TYPE_META[type].en;
  const removeLabel = (wallet: Wallet) =>
    wallet.hasTransactions ? t("Lưu trữ ví", "Archive wallet") : t("Xoá ví", "Delete wallet");

  const subtitle = [
    t(`${wallets.length} ví đang dùng`, `${wallets.length} ${wallets.length === 1 ? "wallet" : "wallets"} in use`),
    archived.length
      ? t(`${archived.length} ví đã lưu trữ`, `${archived.length} archived`)
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const deleteBalance = toAmount(pendingDelete?.balance);

  return (
    <div>
      <PageHeader
        actions={
          <>
            {wallets.length >= 2 ? (
              <Button
                icon={ArrowLeftRight}
                onClick={() => openQuickAdd({ mode: "TRANSFER" })}
                variant="outline"
              >
                {t("Chuyển tiền", "Transfer")}
              </Button>
            ) : null}
            <Button icon={Plus} onClick={() => setForm({ wallet: null })}>
              {t("Thêm ví", "New wallet")}
            </Button>
          </>
        }
        subtitle={loading ? " " : subtitle}
        title={t("Ví tiền", "Wallets")}
      />

      <HeroStrip
        caption={
          !loading && archived.length
            ? t(
                "Ví đã lưu trữ không được tính vào tổng.",
                "Archived wallets are not counted in the total.",
              )
            : null
        }
        label={t("Tổng số dư", "Total balance")}
        stats={WALLET_TYPES.map((type) => ({
          label: typeLabel(type),
          value: (
            <Money
              amount={totals.byType[type]}
              tone={totals.byType[type] < 0 ? "out" : "neutral"}
            />
          ),
        }))}
        value={
          loading ? (
            <span className="text-ledger-line-strong">—</span>
          ) : (
            <Money amount={totals.total} tone={totals.total < 0 ? "out" : "neutral"} />
          )
        }
      />

      <section aria-label={t("Ví đang dùng", "Wallets in use")} className="border-b border-ledger-line">
        {loading ? (
          <div className="py-2">
            <SkeletonRows rows={3} />
          </div>
        ) : wallets.length ? (
          wallets.map((wallet) => (
            <WalletRow
              key={wallet._id}
              onAddIncome={(target) => openQuickAdd({ mode: "INCOME", walletId: target._id })}
              onReconcile={(target) => setReconcileId(target._id)}
              trailing={
                <>
                  <div className="hidden items-center gap-0.5 lg:flex">
                    <IconAction
                      icon={Scale}
                      label={t("Cân đối ví", "Reconcile")}
                      onClick={() => setReconcileId(wallet._id)}
                    />
                    <IconAction
                      icon={ReceiptText}
                      label={t("Xem giao dịch", "View transactions")}
                      to={`/transactions?walletId=${wallet._id}`}
                    />
                    <IconAction
                      icon={Pencil}
                      label={t("Sửa ví", "Edit wallet")}
                      onClick={() => setForm({ wallet })}
                    />
                    <IconAction
                      danger
                      icon={wallet.hasTransactions ? Archive : Trash2}
                      label={removeLabel(wallet)}
                      onClick={() => setPendingDelete(wallet)}
                    />
                  </div>
                  {/* Four icons would squeeze the name to a few letters on a
                      phone, so there they live in a sheet with their labels. */}
                  <button
                    aria-label={t(`Thao tác với ví ${wallet.name}`, `Actions for ${wallet.name}`)}
                    className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ledger-muted hover:bg-ledger-canvas hover:text-ledger-ink lg:hidden"
                    onClick={() => setActionsFor(wallet)}
                    type="button"
                  >
                    <Ellipsis className="h-5 w-5" />
                  </button>
                </>
              }
              wallet={wallet}
            />
          ))
        ) : (
          <EmptyState
            action={
              <Button icon={Plus} onClick={() => setForm({ wallet: null })}>
                {t("Tạo ví", "Create a wallet")}
              </Button>
            }
            description={t(
              "Mỗi khoản thu chi cần một ví để ghi vào: tiền mặt, tài khoản ngân hàng hay ví điện tử bạn đang dùng.",
              "Every entry needs a wallet to go into: the cash, bank account or e-wallet you actually use.",
            )}
            icon={WalletCards}
            title={t("Chưa có ví nào đang dùng", "No wallets in use")}
          />
        )}
      </section>

      {/* Outside the active list on purpose: archiving the last wallet leaves
          that list empty, which is exactly when the way back matters most. */}
      {!loading && archived.length ? (
        <section className="py-5">
          <button
            aria-expanded={archivedOpen}
            className="flex w-full items-start gap-2.5 text-left"
            onClick={() => setArchivedOpen((open) => !open)}
            type="button"
          >
            <ChevronRight
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 text-ledger-muted transition-transform",
                archivedOpen && "rotate-90",
              )}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-ledger-ink">
                  {t("Ví đã lưu trữ", "Archived wallets")}
                </span>
                <span className="ledger-num rounded-full bg-ledger-canvas px-2 py-0.5 text-[12px] text-ledger-ink-2">
                  {archived.length}
                </span>
              </span>
              <span className="text-[12.5px] text-ledger-muted">
                {t(
                  "Không tính vào tổng, không hiện khi ghi giao dịch",
                  "Not counted in totals, not offered when recording",
                )}
              </span>
            </span>
          </button>

          {archivedOpen ? (
            <div className="mt-2">
              {archived.map((wallet) => (
                <WalletRow
                  compact
                  dimmed
                  key={wallet._id}
                  trailing={
                    <Button
                      disabled={restoringId !== null}
                      icon={ArchiveRestore}
                      onClick={() => void restore(wallet)}
                      size="sm"
                      variant="outline"
                    >
                      {restoringId === wallet._id
                        ? t("Đang khôi phục...", "Restoring...")
                        : t("Khôi phục", "Restore")}
                    </Button>
                  }
                  wallet={wallet}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <WalletFormPanel
        onClose={() => setForm(null)}
        onReconcile={(wallet) => {
          setForm(null);
          setReconcileId(wallet._id);
        }}
        onSaved={notifyDataChanged}
        open={form !== null}
        wallet={form?.wallet || null}
      />

      <ReconcilePanel
        onClose={() => setReconcileId(null)}
        onDone={notifyDataChanged}
        wallet={reconcileWallet}
      />

      <Panel
        onClose={() => setActionsFor(null)}
        open={actionsFor !== null}
        title={actionsFor?.name || ""}
      >
        {actionsFor ? (
          <div>
            <p className="mb-1 text-[13px] text-ledger-muted">
              {typeLabel(actionsFor.type)} ·{" "}
              <Money
                amount={toAmount(actionsFor.balance)}
                currency={actionsFor.currency}
                tone={toAmount(actionsFor.balance) < 0 ? "out" : "muted"}
              />
            </p>
            <SheetAction
              icon={Pencil}
              label={t("Sửa ví", "Edit wallet")}
              onClick={() => {
                setForm({ wallet: actionsFor });
                setActionsFor(null);
              }}
            />
            <SheetAction
              detail={t("Khớp số dư với số tiền đang thực có", "Match the balance to what you actually hold")}
              icon={Scale}
              label={t("Cân đối ví", "Reconcile")}
              onClick={() => {
                setReconcileId(actionsFor._id);
                setActionsFor(null);
              }}
            />
            <SheetAction
              icon={ReceiptText}
              label={t("Xem giao dịch", "View transactions")}
              onClick={() => setActionsFor(null)}
              to={`/transactions?walletId=${actionsFor._id}`}
            />
            <SheetAction
              danger
              detail={
                actionsFor.hasTransactions
                  ? t("Giữ lịch sử, khôi phục được", "Keeps its history, can be restored")
                  : t("Chưa có giao dịch, xoá hẳn", "No transactions, removed for good")
              }
              icon={actionsFor.hasTransactions ? Archive : Trash2}
              label={removeLabel(actionsFor)}
              onClick={() => {
                setPendingDelete(actionsFor);
                setActionsFor(null);
              }}
            />
          </div>
        ) : null}
      </Panel>

      <ConfirmDialog
        busy={deleting}
        cancelLabel={t("Giữ lại", "Keep it")}
        confirmLabel={
          pendingDelete?.hasTransactions
            ? t("Lưu trữ ví", "Archive")
            : t("Xoá vĩnh viễn", "Delete for good")
        }
        description={
          pendingDelete?.hasTransactions
            ? t(
                `Ví này đã có giao dịch nên sẽ được lưu trữ chứ không bị xoá. Lịch sử giao dịch được giữ nguyên; ví rời khỏi danh sách và mọi tổng số dư${deleteBalance ? ` (kể cả ${formatMoney(deleteBalance, pendingDelete.currency)} đang có)` : ""}. Bạn có thể khôi phục bất cứ lúc nào ở mục “Ví đã lưu trữ”.`,
                `This wallet has transactions, so it is archived rather than deleted. Its history is kept; it leaves the list and every total${deleteBalance ? ` (including the ${formatMoney(deleteBalance, pendingDelete.currency)} it holds)` : ""}. You can restore it at any time from “Archived wallets”.`,
              )
            : t(
                "Ví này chưa có giao dịch nào nên sẽ bị xoá vĩnh viễn. Ngân sách đang gắn riêng với ví sẽ chuyển sang áp dụng cho mọi ví.",
                "This wallet has no transactions, so it is deleted permanently. Budgets pinned to it will apply to all wallets instead.",
              )
        }
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        open={pendingDelete !== null}
        title={
          pendingDelete?.hasTransactions
            ? t(`Lưu trữ ví “${pendingDelete?.name}”?`, `Archive “${pendingDelete?.name}”?`)
            : t(`Xoá ví “${pendingDelete?.name}”?`, `Delete “${pendingDelete?.name}”?`)
        }
        tone={pendingDelete?.hasTransactions ? "primary" : "danger"}
      />
    </div>
  );
};

export default WalletsPage;
