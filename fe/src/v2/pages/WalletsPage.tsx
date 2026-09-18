import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  ChevronDown,
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
  TriangleAlert,
  Wallet as WalletGlyph,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { walletApi } from "services/api";
import { useAuth } from "contexts/AuthContext";
import { SUPPORTED_CURRENCIES, useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { cn } from "lib/utils";
import { WALLET_TYPE_META, WalletIcon, walletTypeMeta } from "../components/finance";
import { ConfirmDialog, Panel } from "../components/overlays";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Eyebrow,
  FieldLabel,
  HeroStrip,
  IconBadge,
  Money,
  Notice,
  PageHeader,
  Segmented,
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

/** "Ngân hàng · **** 4417"; the type is dropped when it is also the name. */
const walletSubtitle = (wallet: Wallet, isVietnamese: boolean) => {
  const meta = walletTypeMeta(wallet.type);
  const typeLabel = isVietnamese ? meta.vi : meta.en;
  return [
    typeLabel.toLowerCase() === String(wallet.name || "").trim().toLowerCase() ? "" : typeLabel,
    wallet.accountNumber,
  ]
    .filter(Boolean)
    .join(" · ");
};

const shareText = (share: number) => (share > 0 && share < 1 ? "<1%" : `${Math.round(share)}%`);

/* ------------------------------------------------------------ Wallet card */

/**
 * One wallet as a card: who it is, what it holds, and everything that can be
 * done with it in plain view. A negative balance says so inside the card,
 * with the two ways to fix it right there.
 */
const WalletCard: React.FC<{
  wallet: Wallet;
  /** Share of the money held across wallets; null when it would say nothing. */
  share: number | null;
  onReconcile: () => void;
  onAddIncome: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onMore: () => void;
}> = ({ wallet, share, onReconcile, onAddIncome, onEdit, onRemove, onMore }) => {
  const t = useT();
  const { isVietnamese } = useLocale();
  const balance = toAmount(wallet.balance);
  const subtitle = walletSubtitle(wallet, isVietnamese);
  const foreignCurrency = wallet.currency && wallet.currency !== "VND" ? wallet.currency : "";
  const removeLabel = wallet.hasTransactions
    ? t("Lưu trữ ví", "Archive wallet")
    : t("Xoá ví", "Delete wallet");
  const RemoveIcon = wallet.hasTransactions ? Archive : Trash2;

  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-3">
        <WalletIcon size={44} wallet={wallet} />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-[16px] font-semibold leading-snug text-ledger-ink">
            {wallet.name}
          </h3>
          {subtitle ? (
            <p className="break-words text-[13px] leading-snug text-ledger-muted">{subtitle}</p>
          ) : null}
        </div>
        {foreignCurrency ? (
          <span className="shrink-0 rounded-full bg-ledger-canvas px-2 py-0.5 text-[12px] font-medium text-ledger-ink-2">
            {foreignCurrency}
          </span>
        ) : null}
        {/* Archive/delete stays apart from the everyday actions below, as a
            quiet icon in the corner. */}
        <button
          aria-label={removeLabel}
          className="-mr-1.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-ledger-muted transition-colors hover:bg-ledger-out-wash hover:text-ledger-out sm:flex"
          onClick={onRemove}
          title={removeLabel}
          type="button"
        >
          <RemoveIcon className="h-4 w-4" />
        </button>
        {/* On a phone the actions live in a sheet with their labels; four
            buttons under every card would bury the balances. */}
        <button
          aria-label={t(`Thao tác với ví ${wallet.name}`, `Actions for ${wallet.name}`)}
          className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ledger-ink-2 hover:bg-ledger-canvas hover:text-ledger-ink sm:hidden"
          onClick={onMore}
          type="button"
        >
          <Ellipsis className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5">
        <p className="text-[13px] text-ledger-ink-2">{t("Số dư", "Balance")}</p>
        <Money
          amount={balance}
          className="mt-1 block text-[26px] font-semibold leading-tight tracking-[-0.02em] 2xl:text-[28px]"
          currency={wallet.currency}
          tone={balance < 0 ? "out" : "neutral"}
        />
        {share !== null ? (
          <p className="mt-1 text-[13px] text-ledger-muted">
            <span className="ledger-num">{shareText(share)}</span>{" "}
            {t("số tiền bạn đang có", "of the money you hold")}
          </p>
        ) : null}
      </div>

      {balance < 0 ? (
        <Notice
          action={
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-[8px] border border-current px-2.5 py-1 text-[12.5px] font-semibold text-ledger-out hover:bg-ledger-paper"
                onClick={onReconcile}
                type="button"
              >
                {t("Cân đối ví", "Reconcile")}
              </button>
              <button
                className="rounded-[8px] px-2.5 py-1 text-[12.5px] font-semibold text-ledger-out underline-offset-2 hover:underline"
                onClick={onAddIncome}
                type="button"
              >
                {t("Ghi khoản thu", "Log income")}
              </button>
            </div>
          }
          className="mt-4"
          icon={TriangleAlert}
          tone="rose"
        >
          {t(
            `Ví đang âm ${formatMoney(Math.abs(balance), wallet.currency)}. Có thể bạn quên ghi một khoản thu.`,
            `This wallet is ${formatMoney(Math.abs(balance), wallet.currency)} below zero. An income may be missing.`,
          )}
        </Notice>
      ) : null}

      <div className="mt-auto hidden pt-5 sm:block">
        <div className="flex flex-wrap items-center gap-2 border-t border-ledger-line pt-4">
          <Button icon={Scale} onClick={onReconcile} size="sm" variant="outline">
            {t("Cân đối", "Reconcile")}
          </Button>
          <ButtonLink icon={ReceiptText} to={`/transactions?walletId=${wallet._id}`}>
            {t("Giao dịch", "Transactions")}
          </ButtonLink>
          <Button icon={Pencil} onClick={onEdit} size="sm" variant="outline">
            {t("Sửa", "Edit")}
          </Button>
        </div>
      </div>
    </Card>
  );
};

const WalletCardSkeleton: React.FC = () => (
  <div aria-hidden>
    <Card>
      <div className="flex animate-pulse items-center gap-3">
        <span className="h-11 w-11 rounded-[11px] bg-ledger-canvas" />
        <span className="h-3.5 w-32 rounded bg-ledger-canvas" />
      </div>
      <span className="mt-6 block h-3 w-14 animate-pulse rounded bg-ledger-canvas" />
      <span className="mt-2.5 block h-6 w-44 animate-pulse rounded bg-ledger-canvas" />
    </Card>
  </div>
);

/**
 * How the money held splits across wallet types, as one segmented track with
 * a labelled legend: each type keeps the colour its wallet icons wear.
 */
const AllocationBar: React.FC<{
  parts: Array<{ type: WalletType; amount: number; share: number }>;
}> = ({ parts }) => {
  const t = useT();
  const { isVietnamese } = useLocale();
  const label = (type: WalletType) =>
    isVietnamese ? WALLET_TYPE_META[type].vi : WALLET_TYPE_META[type].en;

  return (
    <div>
      <p className="mb-2.5 text-[13px] font-medium text-ledger-ink-2">
        {t("Tiền đang nằm ở đâu", "Where the money is")}
      </p>
      <div
        aria-label={parts.map((part) => `${label(part.type)} ${shareText(part.share)}`).join(", ")}
        className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
      >
        {parts.map((part) => (
          <span
            className="h-full min-w-[4px]"
            key={part.type}
            style={{
              backgroundColor: WALLET_TYPE_META[part.type].color,
              flexBasis: 0,
              flexGrow: part.amount,
            }}
            title={`${label(part.type)}: ${formatMoney(part.amount)} · ${shareText(part.share)}`}
          />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ledger-ink-2">
        {parts.map((part) => (
          <li className="flex items-center gap-1.5" key={part.type}>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: WALLET_TYPE_META[part.type].color }}
            />
            {label(part.type)}
            <span className="ledger-num font-semibold text-ledger-ink">{shareText(part.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

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
            {/* Three tiles with the type's own icon read faster than three
                words in a segmented bar, and match the icons in the list. */}
            <div
              aria-label={t("Loại ví", "Type")}
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
            >
              {WALLET_TYPES.map((value) => {
                const meta = WALLET_TYPE_META[value];
                const selected = value === type;
                return (
                  <button
                    aria-checked={selected}
                    className={cn(
                      "flex min-w-0 flex-col items-center gap-2 rounded-[12px] border px-2 py-3 text-center text-[13px] font-medium transition-colors",
                      selected
                        ? "border-ledger-accent bg-ledger-accent-wash text-ledger-accent"
                        : "border-ledger-line bg-ledger-paper text-ledger-ink-2 hover:border-ledger-line-strong hover:text-ledger-ink",
                    )}
                    key={value}
                    onClick={() => setType(value)}
                    role="radio"
                    type="button"
                  >
                    <meta.icon
                      className="h-5 w-5"
                      style={selected ? undefined : { color: meta.color }}
                    />
                    {isVietnamese ? meta.vi : meta.en}
                  </button>
                );
              })}
            </div>
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
              <dl className="grid grid-cols-2 divide-x divide-ledger-line rounded-[12px] bg-ledger-canvas py-3.5">
                <div className="min-w-0 px-4">
                  <dt>
                    <Eyebrow>{t("Số dư ban đầu", "Opening balance")}</Eyebrow>
                  </dt>
                  <dd className="mt-1 text-[16px] font-semibold">
                    <Money amount={toAmount(editing.initialBalance)} currency={editing.currency} />
                  </dd>
                </div>
                <div className="min-w-0 px-4">
                  <dt>
                    <Eyebrow>{t("Tiền tệ", "Currency")}</Eyebrow>
                  </dt>
                  <dd className="mt-1 text-[16px] font-semibold text-ledger-ink">
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

          {/* The wallet and what the app has on record, as one sunken block;
              the one thing to type sits under it on its own. */}
          <div className="rounded-[14px] bg-ledger-canvas p-4">
            <div className="flex items-center gap-3">
              <WalletIcon size={40} wallet={wallet} />
              <div className="min-w-0 flex-1">
                <p className="break-words text-[15px] font-semibold leading-snug text-ledger-ink">
                  {walletName}
                </p>
                {walletDetail ? (
                  <p className="break-words text-[13px] leading-snug text-ledger-muted">
                    {walletDetail}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-ledger-line pt-3.5">
              <span className="text-[13.5px] text-ledger-ink-2">
                {t("Số dư đang ghi", "Recorded balance")}
              </span>
              <Money
                amount={current}
                className="text-[18px] font-semibold"
                currency={wallet.currency}
                tone={current < 0 ? "out" : "neutral"}
              />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="reconcile-actual">
              {t("Số dư thực tế", "Actual balance")}
            </FieldLabel>
            <label
              className="flex h-16 cursor-text items-center gap-2 rounded-[12px] border border-ledger-line-strong bg-ledger-paper px-4 transition-colors focus-within:border-ledger-accent"
              htmlFor="reconcile-actual"
            >
              <input
                className="ledger-num h-full w-full min-w-0 bg-transparent text-[28px] font-semibold tracking-[-0.02em] text-ledger-ink outline-none placeholder:text-ledger-line-strong"
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
              <span className="shrink-0 text-[20px] font-semibold text-ledger-muted">
                {currencySuffix(wallet.currency)}
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
            <FieldLabel hint={t("Không bắt buộc", "Optional")} htmlFor="reconcile-note">
              {t("Ghi chú", "Note")}
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
    const countByType: Record<WalletType, number> = { cash: 0, bank: 0, ewallet: 0 };
    let total = 0;
    wallets.forEach((wallet) => {
      const balance = toAmount(wallet.balance);
      const type = WALLET_TYPE_META[wallet.type] ? wallet.type : "cash";
      byType[type] += balance;
      countByType[type] += 1;
      total += balance;
    });
    return { byType, countByType, total };
  }, [wallets]);

  // Shares are of the money actually held: a wallet below zero holds none,
  // so it is left out rather than shrinking everyone else's slice.
  const held = useMemo(
    () => wallets.reduce((sum, wallet) => sum + Math.max(toAmount(wallet.balance), 0), 0),
    [wallets],
  );
  const allocation = useMemo(() => {
    const positive = WALLET_TYPES.map((type) => ({
      type,
      amount: Math.max(totals.byType[type], 0),
    })).filter((part) => part.amount > 0);
    const sum = positive.reduce((total, part) => total + part.amount, 0);
    return positive.map((part) => ({ ...part, share: sum > 0 ? (part.amount / sum) * 100 : 0 }));
  }, [totals]);

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
        icon={WalletGlyph}
        label={t("Tổng số dư", "Total balance")}
        stats={WALLET_TYPES.map((type) => {
          const count = totals.countByType[type];
          return {
            label: typeLabel(type),
            icon: WALLET_TYPE_META[type].icon,
            tone: "neutral" as const,
            value: (
              <Money
                amount={totals.byType[type]}
                tone={totals.byType[type] < 0 ? "out" : count ? "neutral" : "muted"}
              />
            ),
            hint: loading
              ? undefined
              : count
                ? t(`${count} ví`, `${count} ${count === 1 ? "wallet" : "wallets"}`)
                : t("Chưa có ví loại này", "None of this type"),
          };
        })}
        value={
          loading ? (
            <span className="text-ledger-line-strong">—</span>
          ) : (
            <Money amount={totals.total} tone={totals.total < 0 ? "out" : "neutral"} />
          )
        }
      >
        {!loading && allocation.length >= 2 ? <AllocationBar parts={allocation} /> : null}
      </HeroStrip>

      <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4 xl:mt-5 xl:space-y-5">
        {loading ? (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:gap-5 2xl:grid-cols-3">
            <WalletCardSkeleton />
            <WalletCardSkeleton />
            <WalletCardSkeleton />
          </div>
        ) : wallets.length ? (
          <section
            aria-label={t("Ví đang dùng", "Wallets in use")}
            className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:gap-5 2xl:grid-cols-3"
          >
            {wallets.map((wallet) => {
              const balance = toAmount(wallet.balance);
              return (
                <WalletCard
                  key={wallet._id}
                  onAddIncome={() => openQuickAdd({ mode: "INCOME", walletId: wallet._id })}
                  onEdit={() => setForm({ wallet })}
                  onMore={() => setActionsFor(wallet)}
                  onReconcile={() => setReconcileId(wallet._id)}
                  onRemove={() => setPendingDelete(wallet)}
                  share={wallets.length >= 2 && balance > 0 && held > 0 ? (balance / held) * 100 : null}
                  wallet={wallet}
                />
              );
            })}
            {/* Fills the grid's last row when it has a gap, and only then:
                on its own row it would be one more "Thêm ví" than needed. */}
            <button
              className={cn(
                "hidden min-h-[200px] flex-col items-center justify-center gap-3 rounded-[18px] border-2 border-dashed border-ledger-line-strong p-6 text-center transition-colors hover:border-ledger-accent hover:bg-ledger-paper",
                wallets.length % 2 === 1 && "md:flex",
                wallets.length % 3 === 0 ? "2xl:hidden" : "2xl:flex",
              )}
              onClick={() => setForm({ wallet: null })}
              type="button"
            >
              <IconBadge icon={Plus} size="md" />
              <span className="text-[15px] font-semibold text-ledger-ink">
                {t("Thêm ví", "New wallet")}
              </span>
              <span className="max-w-[260px] text-[13px] leading-snug text-ledger-muted">
                {t(
                  "Tiền mặt, tài khoản ngân hàng hay ví điện tử bạn đang dùng.",
                  "Cash, a bank account or an e-wallet you use.",
                )}
              </span>
            </button>
          </section>
        ) : (
          <Card>
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
          </Card>
        )}

        {/* Outside the active list on purpose: archiving the last wallet leaves
            that list empty, which is exactly when the way back matters most. */}
        {!loading && archived.length ? (
          <Card>
            <CardHeader
              action={
                <Button
                  aria-controls="ledger-archived-wallets"
                  aria-expanded={archivedOpen}
                  aria-label={archivedOpen ? t("Thu gọn", "Hide") : t("Xem ví đã lưu trữ", "Show archived wallets")}
                  className="max-sm:w-8 max-sm:px-0"
                  onClick={() => setArchivedOpen((open) => !open)}
                  size="sm"
                  variant="outline"
                >
                  {/* A bare chevron on a phone, so the subtitle keeps its width. */}
                  <span className="hidden sm:inline">
                    {archivedOpen ? t("Thu gọn", "Hide") : t("Xem", "Show")}
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", archivedOpen && "rotate-180")}
                  />
                </Button>
              }
              className={archivedOpen ? undefined : "mb-0"}
              icon={Archive}
              meta={String(archived.length)}
              subtitle={t(
                "Không tính vào tổng, không hiện khi ghi giao dịch",
                "Not counted in totals, not offered when recording",
              )}
              title={t("Ví đã lưu trữ", "Archived wallets")}
              tone="neutral"
            />

            {archivedOpen ? (
              <div
                className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3"
                id="ledger-archived-wallets"
              >
                {archived.map((wallet) => {
                  const subtitle = walletSubtitle(wallet, isVietnamese);
                  return (
                    <div
                      className="flex flex-wrap items-center gap-x-3 gap-y-3 rounded-[14px] border border-ledger-line p-3.5"
                      key={wallet._id}
                    >
                      <div className="flex min-w-0 flex-1 basis-[150px] items-center gap-3">
                        {/* Greyed rather than faded: the name stays readable. */}
                        <span className="opacity-70 grayscale">
                          <WalletIcon size={38} wallet={wallet} />
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-[15px] font-medium leading-snug text-ledger-ink">
                            {wallet.name}
                          </p>
                          <p className="text-[13px] leading-snug text-ledger-muted">
                            {subtitle ? `${subtitle} · ` : ""}
                            <Money
                              amount={toAmount(wallet.balance)}
                              currency={wallet.currency}
                              tone={toAmount(wallet.balance) < 0 ? "out" : "muted"}
                            />
                          </p>
                        </div>
                      </div>
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
                    </div>
                  );
                })}
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>

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
            <div className="mb-1 flex items-center gap-3 rounded-[14px] bg-ledger-canvas p-3.5">
              <WalletIcon size={40} wallet={actionsFor} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-ledger-ink-2">
                  {walletSubtitle(actionsFor, isVietnamese) || t("Số dư", "Balance")}
                </p>
                <Money
                  amount={toAmount(actionsFor.balance)}
                  className="text-[17px] font-semibold"
                  currency={actionsFor.currency}
                  tone={toAmount(actionsFor.balance) < 0 ? "out" : "neutral"}
                />
              </div>
            </div>
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
