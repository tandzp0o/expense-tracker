import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  ReceiptText,
  Search,
  SearchX,
  Shapes,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet as WalletGlyph,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "lib/utils";
import { getMonthRangeIso, transactionApi, walletApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { ConfirmDialog } from "../components/overlays";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconBadge,
  Money,
  Notice,
  PageHeader,
  Segmented,
  SkeletonRows,
  TextLink,
  type Tone,
} from "../components/primitives";
import { TimelineColumnsHeader, TimelineDayGroup } from "../components/timeline";
import { useLedger } from "../LedgerContext";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  getCategoryMeta,
} from "../lib/categories";
import { currentMonth, formatMoney, monthLabel } from "../lib/format";
import { useT } from "../lib/i18n";
import { getIdToken } from "../lib/session";
import { buildTimeline, type TimelineEntry } from "../lib/timeline";
import {
  toAmount,
  walletIdOf,
  walletNameOf,
  type Transaction,
  type Wallet,
} from "../lib/types";

const PAGE_SIZE = 30;
const TRANSFER_CATEGORY = "Transfer";
const ADJUSTMENT_CATEGORY = getCategoryMeta("Điều chỉnh số dư").key;
// Enough to see every transfer leg of a month in one request; nobody moves
// money between their own wallets hundreds of times a month.
const TRANSFER_SCAN_LIMIT = 500;

type Kind = "all" | "expense" | "income" | "transfer";

interface Period {
  month: number;
  year: number;
}

interface WalletEffect {
  id: string;
  name: string;
  /** What deleting does to the wallet: positive gives money back. */
  delta: number;
  balance: number | null;
}

const isTransferRow = (transaction: Transaction) =>
  Boolean(transaction.transferGroupId) ||
  String(transaction.category || "").toLowerCase() === "transfer";

const shiftMonth = ({ month, year }: Period, delta: number): Period => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

const englishMonth = ({ month, year }: Period, style: "long" | "short", withYear: boolean) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: style,
    timeZone: "UTC",
    ...(withYear ? { year: "numeric" as const } : {}),
  });

/**
 * How many rows the server counts that the list does not show as rows of
 * their own. A transfer is stored as two legs but read as one "A → B" entry,
 * and under Chi/Thu transfers are hidden altogether, so the server's `total`
 * alone would say "12 khoản" above a list of 11.
 */
const foldedRowCount = (response: unknown, kind: Kind) => {
  const legs: Transaction[] = (
    (response as { data?: { transactions?: Transaction[] } })?.data?.transactions || []
  ).filter(isTransferRow);

  if (kind === "expense" || kind === "income") {
    return legs.length;
  }

  const groups = new Set(legs.map((leg) => leg.transferGroupId || leg._id));
  return legs.length - groups.size;
};

/**
 * A native <select> dressed as a dropdown button. The real control sits on
 * top, invisible, so the phone still opens its own picker and the button is
 * only as wide as the current choice rather than the longest option. It is
 * outlined like an input, not rounded like a chip, so it reads as "pick one
 * from a list" next to the type switch.
 */
const FilterSelect: React.FC<{
  label: string;
  value: string;
  display: string;
  icon: LucideIcon;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ label, value, display, icon: Icon, onChange, children }) => (
  <label
    className={cn(
      "relative inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[12px] border pl-3 pr-2.5 text-[13.5px] font-medium transition-colors",
      "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ledger-accent",
      value
        ? "border-ledger-accent bg-ledger-accent-wash text-ledger-accent"
        : "border-ledger-line-strong bg-ledger-paper text-ledger-ink hover:bg-ledger-hover",
    )}
  >
    <Icon className={cn("h-4 w-4 shrink-0", !value && "text-ledger-muted")} />
    <span className="max-w-[200px] truncate">{display}</span>
    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
    <select
      aria-label={label}
      className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 [color-scheme:light] dark:[color-scheme:dark]"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  </label>
);

const SelectOption: React.FC<{ value: string; children: React.ReactNode }> = ({
  value,
  children,
}) => (
  <option className="bg-ledger-paper text-ledger-ink" value={value}>
    {children}
  </option>
);

/**
 * One of the month's figures as its own card, laid out like the Dashboard's
 * stat tiles so the two pages read the same way.
 */
const StatTile: React.FC<{
  label: string;
  icon: LucideIcon;
  tone: Tone;
  value: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ label, icon, tone, value, hint }) => (
  <Card className="hidden min-w-0 flex-col justify-center sm:flex">
    <div className="flex min-w-0 items-center gap-2.5">
      <IconBadge icon={icon} tone={tone} />
      <p className="truncate text-[13.5px] font-medium text-ledger-ink-2">{label}</p>
    </div>
    <div className="mt-3 text-[20px] font-semibold leading-tight tracking-[-0.02em] 2xl:text-[22px]">
      {value}
    </div>
    {hint ? <p className="mt-1 text-[12.5px] leading-snug text-ledger-muted">{hint}</p> : null}
  </Card>
);

const TransactionsPage: React.FC = () => {
  const t = useT();
  const { toast } = useToast();
  const { isVietnamese, timezoneOffsetMinutes } = useLocale();
  const { dataVersion, notifyDataChanged, openQuickAdd } = useLedger();
  const [searchParams, setSearchParams] = useSearchParams();

  // Budgets and Wallets link here with "Xem giao dịch"; the first request
  // already has to carry that filter, so it is read before the first render.
  const [kind, setKind] = useState<Kind>(() =>
    (searchParams.get("category") || "").toLowerCase() === "transfer" ? "transfer" : "all",
  );
  const [category, setCategory] = useState(() => {
    const value = searchParams.get("category") || "";
    return value.toLowerCase() === "transfer" ? "" : value;
  });
  const [walletId, setWalletId] = useState(() => searchParams.get("walletId") || "");
  const [period, setPeriod] = useState<Period>(() => currentMonth(timezoneOffsetMinutes));
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");

  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [folded, setFolded] = useState(0);
  const [summary, setSummary] = useState<{ income: number; expense: number } | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<TimelineEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pagesLoaded = useRef(1);
  const lastFilterKey = useRef<string | null>(null);
  const requestSeq = useRef(0);

  // The same links can arrive while this page is already open, so they are
  // applied here too, then dropped from the URL so a refresh starts clean.
  useEffect(() => {
    const nextCategory = searchParams.get("category");
    const nextWallet = searchParams.get("walletId");
    if (nextCategory === null && nextWallet === null) {
      return;
    }
    if (nextCategory !== null) {
      const isTransfer = nextCategory.toLowerCase() === "transfer";
      setKind(isTransfer ? "transfer" : "all");
      setCategory(isTransfer ? "" : nextCategory);
    }
    if (nextWallet !== null) {
      setWalletId(nextWallet);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const handle = window.setTimeout(() => setNote(search.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [search]);

  const query = useMemo(() => {
    const { startDate, endDate } = getMonthRangeIso(
      period.month,
      period.year,
      timezoneOffsetMinutes,
    );
    return {
      startDate,
      endDate,
      type:
        kind === "expense"
          ? ("EXPENSE" as const)
          : kind === "income"
            ? ("INCOME" as const)
            : undefined,
      category: kind === "transfer" ? TRANSFER_CATEGORY : category || undefined,
      walletId: walletId || undefined,
      note: note || undefined,
    };
  }, [category, kind, note, period.month, period.year, timezoneOffsetMinutes, walletId]);

  const filterKey = JSON.stringify([query, kind]);

  useEffect(() => {
    // A new filter starts over at one page. A refresh after a save keeps as
    // many rows as were already loaded, so deleting something far down the
    // list does not throw the user back to the top.
    if (lastFilterKey.current !== filterKey) {
      lastFilterKey.current = filterKey;
      pagesLoaded.current = 1;
      setLoading(true);
    }
    const request = ++requestSeq.current;
    const canHoldTransfers = !query.category || query.category === TRANSFER_CATEGORY;

    (async () => {
      try {
        const token = await getIdToken();
        const [list, transfers] = await Promise.all([
          transactionApi.getTransactions(
            { ...query, page: 1, limit: pagesLoaded.current * PAGE_SIZE },
            token,
          ),
          canHoldTransfers
            ? transactionApi.getTransactions(
                { ...query, category: TRANSFER_CATEGORY, page: 1, limit: TRANSFER_SCAN_LIMIT },
                token,
              )
            : Promise.resolve(null),
        ]);

        if (request !== requestSeq.current) {
          return;
        }

        setRows(list?.data?.transactions || []);
        setTotal(toAmount(list?.data?.total));
        setSummary({
          income: toAmount(list?.data?.summary?.income),
          expense: toAmount(list?.data?.summary?.expense),
        });
        setFolded(foldedRowCount(transfers, kind));
        setError(null);
      } catch (loadError) {
        if (request === requestSeq.current) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (request === requestSeq.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      requestSeq.current += 1;
    };
  }, [dataVersion, filterKey, kind, query, reloadKey]);

  // Archived wallets are included so a history reached from an archived
  // wallet's "Xem giao dịch" still has its name in the picker.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getIdToken();
        const response = await walletApi.getWallets(token, { includeArchived: true });
        if (active) {
          setWallets(response?.wallets || []);
        }
      } catch {
        // The list still renders with the names the rows carry.
      }
    })();
    return () => {
      active = false;
    };
  }, [dataVersion]);

  const loadMore = async () => {
    const request = requestSeq.current;
    setLoadingMore(true);
    try {
      const token = await getIdToken();
      const response = await transactionApi.getTransactions(
        { ...query, page: pagesLoaded.current + 1, limit: PAGE_SIZE },
        token,
      );
      if (request !== requestSeq.current) {
        return;
      }
      const next: Transaction[] = response?.data?.transactions || [];
      pagesLoaded.current += 1;
      setRows((current) => {
        const seen = new Set(current.map((row) => row._id));
        return [...current, ...next.filter((row) => !seen.has(row._id))];
      });
      setTotal(toAmount(response?.data?.total));
    } catch (loadError) {
      toast({
        title: t("Không tải thêm được", "Could not load more"),
        description: loadError instanceof Error ? loadError.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
  };

  // "Chi" means spending. Moving money between one's own wallets is not, even
  // though its outgoing leg is stored as an expense.
  const visibleRows = useMemo(
    () =>
      kind === "expense" || kind === "income"
        ? rows.filter((row) => !isTransferRow(row))
        : rows,
    [kind, rows],
  );

  const days = useMemo(
    () =>
      buildTimeline(visibleRows, wallets, timezoneOffsetMinutes, isVietnamese).map((day) => ({
        ...day,
        entries: day.entries.map((entry) => {
          // Filtered to the receiving wallet, only the incoming leg is here and
          // the merged entry would read "Tiền mặt → Tiền mặt". Name the side
          // that sent it instead, as far as the row lets us know it.
          if (entry.kind !== "transfer" || entry.source.type !== "INCOME") {
            return entry;
          }
          const receiver = walletNameOf(entry.source, wallets);
          const sender =
            wallets.find((wallet) => wallet._id === String(entry.source.transferPeerWalletId || ""))
              ?.name || (isVietnamese ? "Ví khác" : "Another wallet");
          return { ...entry, subtitle: `${sender} → ${receiver}` };
        }),
      })),
    [isVietnamese, timezoneOffsetMinutes, visibleRows, wallets],
  );

  const entryCount = days.reduce((sum, day) => sum + day.entries.length, 0);
  const count = Math.max(total - folded, entryCount);
  const hasMore = rows.length < total;
  const hasFilters = kind !== "all" || Boolean(category) || Boolean(walletId) || Boolean(note);

  const today = currentMonth(timezoneOffsetMinutes);
  const isCurrentMonth = period.month === today.month && period.year === today.year;
  const isFutureMonth =
    period.year * 12 + period.month > today.year * 12 + today.month;
  const monthName = isVietnamese
    ? `tháng ${period.month}${period.year === today.year ? "" : `/${period.year}`}`
    : englishMonth(period, "long", period.year !== today.year);

  const subtitle = loading && !rows.length
    ? isVietnamese
      ? monthLabel(period.month, period.year, true)
      : englishMonth(period, "long", true)
    : hasFilters
      ? t(`${count} khoản khớp bộ lọc trong ${monthName}`, `${count} matching in ${monthName}`)
      : t(
          `${count} khoản trong ${monthName}`,
          `${count} ${count === 1 ? "transaction" : "transactions"} in ${monthName}`,
        );

  const chooseKind = (next: Kind) => {
    setKind(next);
    // A category only survives the switch if it can still match anything.
    if (
      next === "transfer" ||
      (next === "expense" && INCOME_CATEGORIES.some((item) => item.key === category)) ||
      (next === "income" && EXPENSE_CATEGORIES.some((item) => item.key === category))
    ) {
      setCategory("");
    }
  };

  const clearFilters = () => {
    setKind("all");
    setCategory("");
    setWalletId("");
    setSearch("");
    setNote("");
  };

  /* ------------------------------------------------------------- Delete */

  const walletEffects = (entry: TimelineEntry): WalletEffect[] => {
    const source = entry.source;
    if ((source.status || "COMPLETED") !== "COMPLETED") {
      return [];
    }

    const effectOf = (row: Transaction) => ({
      id: walletIdOf(row),
      name: walletNameOf(row, wallets),
      delta:
        row.type === "INCOME" || row.type === "GOAL_WITHDRAW"
          ? -toAmount(row.amount)
          : toAmount(row.amount),
    });

    const legs =
      entry.kind === "transfer" && source.transferGroupId
        ? rows.filter((row) => row.transferGroupId === source.transferGroupId)
        : [source];
    const effects = legs.map(effectOf);

    if (entry.kind === "transfer" && legs.length < 2) {
      const peer = wallets.find(
        (wallet) => wallet._id === String(source.transferPeerWalletId || ""),
      );
      if (peer) {
        effects.push({ id: peer._id, name: peer.name, delta: -effects[0].delta });
      }
    }

    return effects.map((effect) => {
      const wallet = wallets.find((item) => item._id === effect.id);
      return {
        ...effect,
        name: effect.name || wallet?.name || t("Ví", "Wallet"),
        balance: wallet ? toAmount(wallet.balance) : null,
      };
    });
  };

  // Says what the delete does to real balances before it happens, per kind
  // of row, the way v1 did. "Are you sure?" alone hides the consequence.
  const describeDelete = (entry: TimelineEntry) => {
    const source = entry.source;
    const amount = formatMoney(toAmount(source.amount));
    const wallet = walletNameOf(source, wallets) || t("ví", "the wallet");
    const status = source.status || "COMPLETED";

    if (entry.kind === "transfer") {
      return {
        confirm: t(
          "Cả hai vế của lần chuyển này sẽ bị xoá, số dư hai ví trở về như trước khi chuyển.",
          "Both sides of this transfer are removed, and both wallets go back to where they were before it.",
        ),
        done: t(
          "Đã xoá cả hai vế, số dư hai ví đã trở lại như trước.",
          "Both sides removed; both wallets are back where they were.",
        ),
      };
    }

    if (status !== "COMPLETED") {
      const state =
        status === "SCHEDULED"
          ? t("mới được lên lịch", "only scheduled")
          : status === "PENDING"
            ? t("còn đang chờ", "still pending")
            : t("chưa hoàn tất", "not completed");
      return {
        confirm: t(
          `Khoản này ${state}, chưa đụng tới ví nào, nên số dư không thay đổi.`,
          `It is ${state} and has not touched any wallet, so no balance changes.`,
        ),
        done: t("Số dư các ví không thay đổi.", "No balance changed."),
      };
    }

    const adjustment =
      entry.meta.key === ADJUSTMENT_CATEGORY
        ? t(
            "Đây là khoản cân đối số dư; xoá đi thì ví quay về số dư trước lần cân đối. ",
            "This is a balance adjustment; deleting it puts the wallet back to where it was before. ",
          )
        : "";

    switch (source.type) {
      case "INCOME":
        return {
          confirm:
            adjustment +
            t(
              `${wallet} sẽ bị trừ ${amount}, vì khoản thu này không còn được tính.`,
              `${wallet} loses ${amount}, since this income no longer counts.`,
            ),
          done: t(`${wallet} đã bị trừ ${amount}.`, `${amount} taken off ${wallet}.`),
        };
      case "GOAL_DEPOSIT":
        return {
          confirm: t(
            `${amount} về lại ${wallet} và được trừ khỏi mục tiêu.`,
            `${amount} goes back to ${wallet} and comes off the goal.`,
          ),
          done: t(
            `${amount} đã về lại ${wallet}.`,
            `${amount} is back in ${wallet}.`,
          ),
        };
      case "GOAL_WITHDRAW":
        return {
          confirm: t(
            `${wallet} bị trừ ${amount} và mục tiêu được cộng lại chừng ấy.`,
            `${wallet} loses ${amount} and the goal gets it back.`,
          ),
          done: t(
            `${amount} đã trả lại mục tiêu.`,
            `${amount} returned to the goal.`,
          ),
        };
      default:
        return {
          confirm:
            adjustment +
            t(
              `${amount} sẽ được cộng lại vào ${wallet}.`,
              `${amount} goes back into ${wallet}.`,
            ),
          done: t(`${amount} đã về lại ${wallet}.`, `${amount} is back in ${wallet}.`),
        };
    }
  };

  const requestDelete = (entry: TimelineEntry) => {
    // Legacy adjustment rows are refused by the server; say so up front
    // instead of opening a dialog whose button can only fail.
    if (entry.source.type === "ADJUSTMENT") {
      toast({
        title: t("Khoản điều chỉnh này không xoá được", "This adjustment cannot be deleted"),
        description: t(
          "Dùng \"Cân đối ví\" ở trang Ví tiền để sửa lại số dư.",
          "Use \"Reconcile\" on the Wallets page to correct the balance.",
        ),
        variant: "default",
      });
      return;
    }
    setPendingDelete(entry);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    const entry = pendingDelete;
    const copy = describeDelete(entry);
    setDeleting(true);
    try {
      const token = await getIdToken();
      await transactionApi.deleteTransaction(entry.source._id, token);
      toast({
        title:
          entry.kind === "transfer"
            ? t("Đã xoá lần chuyển ví", "Transfer deleted")
            : t("Đã xoá giao dịch", "Transaction deleted"),
        description: copy.done,
        variant: "success",
      });
      setPendingDelete(null);
      notifyDataChanged();
    } catch (deleteError) {
      toast({
        title: t("Không xoá được", "Could not delete"),
        description: deleteError instanceof Error ? deleteError.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const deleteCopy = pendingDelete ? describeDelete(pendingDelete) : null;
  const effects = pendingDelete ? walletEffects(pendingDelete) : [];
  const goesNegative = effects.filter(
    (effect) => effect.balance !== null && effect.balance + effect.delta < 0,
  );

  /* ------------------------------------------------------------ Filters */

  const activeWallets = wallets.filter((wallet) => !wallet.isArchived);
  const archivedWallets = wallets.filter((wallet) => wallet.isArchived);
  const selectedWalletName =
    wallets.find((wallet) => wallet._id === walletId)?.name ||
    (walletId && rows[0] ? walletNameOf(rows[0], wallets) : "") ||
    t("Ví đã chọn", "Selected wallet");

  const categoryLabel = (key: string) => {
    const meta = getCategoryMeta(key);
    return isVietnamese ? meta.vi : meta.en;
  };
  const knownCategory = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].some(
    (item) => item.key === category,
  );

  /* ------------------------------------------------------------ Summary */

  // The server's figures cover the whole filtered month, not only the rows
  // loaded so far. Transfers and scheduled rows are never part of them.
  const figuresReady = !loading && !error && summary !== null;
  const narrowed = Boolean(category) || Boolean(walletId) || Boolean(note);
  const income = summary?.income ?? 0;
  const expense = summary?.expense ?? 0;
  const net = income - expense;
  const placeholder = <span className="text-ledger-line-strong">—</span>;
  const filterHint = t("Theo bộ lọc đang chọn", "For the current filters");
  const transferNote = t("Chuyển ví không tính vào thu chi", "Transfers are not income or spending");
  const pickAll = t("Chọn “Tất cả” để xem", "Pick “All” to see it");

  const figures: Array<{
    key: string;
    label: string;
    short: string;
    icon: LucideIcon;
    tone: Tone;
    applies: boolean;
    value: React.ReactNode;
    hint: string;
  }> = [
    {
      key: "income",
      label: t(`Thu ${monthName}`, `Income in ${monthName}`),
      short: t("Thu", "Income"),
      icon: ArrowDownLeft,
      tone: "in",
      applies: kind === "all" || kind === "income",
      value: <Money amount={income} signed tone="in" />,
      // A tile that does not apply to the current kind says why, and no two
      // tiles repeat the same sentence.
      hint:
        kind === "transfer"
          ? transferNote
          : kind === "expense"
            ? t("Đang xem riêng khoản chi", "Showing spending only")
            : narrowed
              ? filterHint
              : t("Không tính chuyển ví", "Transfers not included"),
    },
    {
      key: "expense",
      label: t(`Chi ${monthName}`, `Spent in ${monthName}`),
      short: t("Chi", "Spent"),
      icon: ArrowUpRight,
      tone: "out",
      applies: kind === "all" || kind === "expense",
      value: <Money amount={expense} />,
      hint:
        kind === "transfer"
          ? t("Đang xem riêng chuyển ví", "Showing transfers only")
          : kind === "income"
            ? t("Đang xem riêng khoản thu", "Showing income only")
            : narrowed
              ? filterHint
              : t("Chưa tính khoản đã lên lịch", "Scheduled items not included"),
    },
    {
      key: "net",
      label: t(`Chênh lệch ${monthName}`, `Net for ${monthName}`),
      short: t("Chênh lệch", "Net"),
      icon: kind === "all" && net < 0 ? TrendingDown : TrendingUp,
      tone: net < 0 ? "out" : "accent",
      applies: kind === "all",
      value: <Money amount={net} signed tone="auto" />,
      hint:
        kind !== "all"
          ? pickAll
          : narrowed
            ? filterHint
            : t("Thu trừ chi", "Income minus spending"),
    },
  ];

  /* ------------------------------------------------------------- Render */

  const kinds: Array<{ value: Kind; label: string }> = [
    { value: "all", label: t("Tất cả", "All") },
    { value: "expense", label: t("Chi", "Out") },
    { value: "income", label: t("Thu", "In") },
    { value: "transfer", label: t("Chuyển ví", "Transfers") },
  ];

  const listHeading: Record<Kind, { title: string; icon: LucideIcon; tone: Tone }> = {
    all: { title: t("Tất cả giao dịch", "All transactions"), icon: ReceiptText, tone: "accent" },
    expense: { title: t("Khoản chi", "Spending"), icon: ArrowUpRight, tone: "out" },
    income: { title: t("Khoản thu", "Income"), icon: ArrowDownLeft, tone: "in" },
    transfer: { title: t("Chuyển ví", "Transfers"), icon: ArrowLeftRight, tone: "neutral" },
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  // "Ghi giao dịch" starts from what the list is showing: a list of income
  // opens an income, a list filtered to one wallet pays from that wallet.
  const addFromList = () =>
    openQuickAdd({
      mode: kind === "income" ? "INCOME" : kind === "transfer" ? "TRANSFER" : "EXPENSE",
      walletId: activeWallets.some((wallet) => wallet._id === walletId) ? walletId : undefined,
    });

  // Without this an unreachable server would read as "no transactions".
  const errorNotice = error ? (
    <Notice
      action={<TextLink onClick={retry}>{t("Thử lại", "Retry")}</TextLink>}
      className="mb-4"
      detail={error}
      icon={TriangleAlert}
      tone="rose"
    >
      {t("Không tải được giao dịch.", "Could not load transactions.")}
    </Notice>
  ) : null;

  let body: React.ReactNode;
  if (error && !rows.length) {
    body = null;
  } else if (loading) {
    body = <SkeletonRows rows={7} />;
  } else if (!days.length && hasFilters && !hasMore) {
    body = (
      <EmptyState
        action={
          <Button onClick={clearFilters} variant="outline">
            {t("Xoá bộ lọc", "Clear filters")}
          </Button>
        }
        description={t(
          `Không có khoản nào trong ${monthName} khớp với lựa chọn này.`,
          `Nothing in ${monthName} matches what you picked.`,
        )}
        icon={SearchX}
        title={t("Không tìm thấy giao dịch", "No matching transactions")}
      />
    );
  } else if (!days.length && !hasMore) {
    body = isCurrentMonth ? (
      <EmptyState
        action={
          <Button icon={Plus} onClick={() => openQuickAdd()}>
            {t("Ghi khoản đầu tiên", "Record the first one")}
          </Button>
        }
        description={t(
          "Mỗi khoản chi, khoản thu bạn ghi sẽ hiện ở đây, gom theo ngày.",
          "Everything you spend or receive shows up here, grouped by day.",
        )}
        icon={ReceiptText}
        title={t(`Chưa có khoản nào trong ${monthName}`, `Nothing recorded in ${monthName} yet`)}
      />
    ) : (
      <EmptyState
        action={
          <Button onClick={() => setPeriod(today)} variant="outline">
            {t("Về tháng này", "Back to this month")}
          </Button>
        }
        icon={ReceiptText}
        title={
          isFutureMonth
            ? t(`Chưa có khoản nào lên lịch cho ${monthName}`, `Nothing scheduled for ${monthName}`)
            : t(`Không có giao dịch nào trong ${monthName}`, `No transactions in ${monthName}`)
        }
      />
    );
  } else {
    body = (
      <>
        {/* On a wide screen the rows become a table: category, wallet and
            amount each get a column under these titles. */}
        <TimelineColumnsHeader />
        <div className="[&>*+*]:mt-4">
          {days.map((day) => (
            <TimelineDayGroup
              columns
              day={day}
              key={day.dayKey}
              onDelete={requestDelete}
              onEdit={(entry) => openQuickAdd({ editing: entry.source })}
              sticky
            />
          ))}
        </div>
        {hasMore ? (
          <div className="mt-5 flex flex-col items-center gap-2 border-t border-ledger-line pt-5">
            <Button disabled={loadingMore} icon={ChevronDown} onClick={loadMore} variant="outline">
              {loadingMore ? t("Đang tải…", "Loading…") : t("Xem thêm", "Show more")}
            </Button>
            <p className="ledger-num text-[12.5px] text-ledger-muted">
              {t(`Đang xem ${entryCount} / ${count}`, `Showing ${entryCount} of ${count}`)}
            </p>
          </div>
        ) : null}
      </>
    );
  }

  const monthTitle = isVietnamese
    ? monthLabel(period.month, period.year, true)
    : englishMonth(period, "long", true);
  // Previous / next month. On a phone they sit beside the month at thumb
  // size; in a tile they sit on the label row, 32px like the icon badge, so
  // the month name keeps the tile's full width and lines up with the figures
  // in the tiles next to it.
  const monthSteps = (size: "sm" | "lg") => {
    const classes = cn(
      "flex items-center justify-center border border-ledger-line-strong bg-ledger-paper text-ledger-ink-2 transition-colors hover:bg-ledger-hover hover:text-ledger-ink",
      size === "lg" ? "h-10 w-10 rounded-[10px]" : "h-8 w-8 rounded-[9px]",
    );
    const icon = size === "lg" ? "h-[18px] w-[18px]" : "h-4 w-4";
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          aria-label={t("Tháng trước", "Previous month")}
          className={classes}
          onClick={() => setPeriod((current) => shiftMonth(current, -1))}
          type="button"
        >
          <ChevronLeft className={icon} />
        </button>
        <button
          aria-label={t("Tháng sau", "Next month")}
          className={classes}
          onClick={() => setPeriod((current) => shiftMonth(current, 1))}
          type="button"
        >
          <ChevronRight className={icon} />
        </button>
      </div>
    );
  };

  // The month is the page's main switch, so it gets a card of its own at the
  // head of the figures it controls. On a phone the figure tiles are hidden
  // and the same numbers fold into this card as rows.
  const monthCard = (
    <Card className="flex min-w-0 flex-col justify-center">
      <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
        <IconBadge icon={CalendarDays} />
        <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ledger-ink-2">
          {t("Đang xem", "Viewing")}
        </p>
        {monthSteps("sm")}
      </div>
      <div className="flex items-center justify-between gap-3 sm:mt-3">
        <div className="min-w-0">
          <p className="ledger-num text-[20px] font-semibold leading-tight tracking-[-0.02em] text-ledger-ink 2xl:text-[22px]">
            {monthTitle}
          </p>
          <p className="mt-1 text-[12.5px] text-ledger-muted">
            {isCurrentMonth ? (
              t("Tháng hiện tại", "The current month")
            ) : (
              <TextLink className="text-[12.5px]" onClick={() => setPeriod(today)}>
                {t("Về tháng này", "Back to this month")}
              </TextLink>
            )}
          </p>
        </div>
        <div className="sm:hidden">{monthSteps("lg")}</div>
      </div>
      <div className="mt-4 border-t border-ledger-line pt-1 sm:hidden">
        {kind === "transfer" ? (
          <p className="pt-2.5 text-[13px] text-ledger-ink-2">{transferNote}</p>
        ) : (
          <dl className="divide-y divide-ledger-line">
            {figures
              .filter((figure) => figure.applies)
              .map((figure) => (
                <div
                  className="flex items-center justify-between gap-3 py-2.5 last:pb-0"
                  key={figure.key}
                >
                  <dt className="text-[13.5px] text-ledger-ink-2">{figure.short}</dt>
                  <dd className="text-[15px] font-semibold">
                    {figuresReady ? figure.value : placeholder}
                  </dd>
                </div>
              ))}
          </dl>
        )}
        {narrowed && kind !== "transfer" ? (
          <p className="mt-2 text-[12.5px] text-ledger-muted">{filterHint}</p>
        ) : null}
      </div>
    </Card>
  );

  const heading = listHeading[kind];

  return (
    <div>
      <PageHeader
        actions={
          <>
            <div className="relative min-w-0 flex-1 sm:w-[240px] sm:flex-none xl:w-[300px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ledger-muted" />
              <input
                aria-label={t("Tìm trong ghi chú", "Search notes")}
                className="h-10 w-full rounded-[10px] border border-ledger-line-strong bg-ledger-paper pl-9 pr-9 text-[14px] text-ledger-ink outline-none transition-colors placeholder:text-ledger-muted focus:border-ledger-accent"
                enterKeyHint="search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Tìm trong ghi chú", "Search notes")}
                type="text"
                value={search}
              />
              {search ? (
                <button
                  aria-label={t("Xoá tìm kiếm", "Clear search")}
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ledger-muted hover:bg-ledger-canvas hover:text-ledger-ink"
                  onClick={() => {
                    setSearch("");
                    setNote("");
                  }}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <Button
              icon={ArrowLeftRight}
              onClick={() => openQuickAdd({ mode: "TRANSFER" })}
              variant="outline"
            >
              {t("Chuyển ví", "Transfer")}
            </Button>
            {/* A phone has the + in the tab bar for this. */}
            <Button className="hidden sm:inline-flex" icon={Plus} onClick={addFromList}>
              {t("Ghi giao dịch", "New entry")}
            </Button>
          </>
        }
        subtitle={subtitle}
        title={t("Giao dịch", "Transactions")}
      />

      {/* Up to a laptop-sized screen the month and its figures run across the
          top. On a very wide screen they move into a side column that stays
          in view while the ledger scrolls, so the table is not stretched so
          wide that a name sits a whole screen away from its category. */}
      <div className="grid gap-3 sm:gap-4 xl:gap-5 min-[1700px]:grid-cols-12 min-[1700px]:items-start">
        <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-5 min-[1700px]:sticky min-[1700px]:top-6 min-[1700px]:order-2 min-[1700px]:col-span-3 min-[1700px]:grid-cols-1">
          {monthCard}
          {figures.map((figure) => (
            <StatTile
              hint={figure.hint}
              icon={figure.icon}
              key={figure.key}
              label={figure.label}
              tone={figure.applies ? figure.tone : "neutral"}
              value={figure.applies && figuresReady ? figure.value : placeholder}
            />
          ))}
        </section>

        <div className="min-w-0 space-y-3 sm:space-y-4 xl:space-y-5 min-[1700px]:col-span-9">
          {/* What to show: the kind as a switch, then the narrowing dropdowns. */}
          <Card className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:gap-4" flush>
            <Segmented
              // Four options share a phone's width; tighter padding keeps
              // "Chuyển ví" on one line.
              className="w-full shrink-0 lg:w-[400px] [&>button]:whitespace-nowrap [&>button]:px-1.5 sm:[&>button]:px-3"
              onChange={chooseKind}
              options={kinds}
              value={kind}
            />
            {/* These wrap rather than scroll: "Xoá bộ lọc" must never be the
                thing hidden past the edge of a phone. */}
            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-1">
              <FilterSelect
                display={walletId ? selectedWalletName : t("Mọi ví", "All wallets")}
                icon={WalletGlyph}
                label={t("Lọc theo ví", "Filter by wallet")}
                onChange={setWalletId}
                value={walletId}
              >
                <SelectOption value="">{t("Mọi ví", "All wallets")}</SelectOption>
                {activeWallets.map((wallet) => (
                  <SelectOption key={wallet._id} value={wallet._id}>
                    {wallet.name}
                  </SelectOption>
                ))}
                {archivedWallets.length ? (
                  <optgroup label={t("Đã lưu trữ", "Archived")}>
                    {archivedWallets.map((wallet) => (
                      <SelectOption key={wallet._id} value={wallet._id}>
                        {wallet.name}
                      </SelectOption>
                    ))}
                  </optgroup>
                ) : null}
                {walletId && !wallets.some((wallet) => wallet._id === walletId) ? (
                  <SelectOption value={walletId}>{selectedWalletName}</SelectOption>
                ) : null}
              </FilterSelect>

              {/* A transfer has no category of its own to narrow by. */}
              {kind !== "transfer" ? (
                <FilterSelect
                  display={category ? categoryLabel(category) : t("Mọi danh mục", "All categories")}
                  icon={Shapes}
                  label={t("Lọc theo danh mục", "Filter by category")}
                  onChange={setCategory}
                  value={category}
                >
                  <SelectOption value="">{t("Mọi danh mục", "All categories")}</SelectOption>
                  {kind !== "income" ? (
                    <optgroup label={t("Khoản chi", "Spending")}>
                      {EXPENSE_CATEGORIES.map((item) => (
                        <SelectOption key={item.key} value={item.key}>
                          {isVietnamese ? item.vi : item.en}
                        </SelectOption>
                      ))}
                    </optgroup>
                  ) : null}
                  {kind !== "expense" ? (
                    <optgroup label={t("Khoản thu", "Income")}>
                      {INCOME_CATEGORIES.map((item) => (
                        <SelectOption key={item.key} value={item.key}>
                          {isVietnamese ? item.vi : item.en}
                        </SelectOption>
                      ))}
                    </optgroup>
                  ) : null}
                  {category && !knownCategory ? (
                    <SelectOption value={category}>{categoryLabel(category)}</SelectOption>
                  ) : null}
                </FilterSelect>
              ) : null}

              {hasFilters ? (
                <button
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[12px] px-3 text-[13.5px] font-medium text-ledger-ink-2 transition-colors hover:bg-ledger-canvas hover:text-ledger-ink lg:ml-auto"
                  onClick={clearFilters}
                  type="button"
                >
                  <X className="h-4 w-4" />
                  {t("Xoá bộ lọc", "Clear filters")}
                </button>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={heading.icon}
              subtitle={
                days.length && !loading
                  ? t("Bấm vào một dòng để sửa hoặc xoá", "Click a row to edit or delete it")
                  : undefined
              }
              title={heading.title}
              tone={heading.tone}
            />
            {errorNotice}
            {body}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        busy={deleting}
        cancelLabel={t("Giữ lại", "Keep")}
        confirmLabel={t("Xoá", "Delete")}
        description={deleteCopy?.confirm}
        onClose={() => {
          if (!deleting) {
            setPendingDelete(null);
          }
        }}
        onConfirm={confirmDelete}
        open={Boolean(pendingDelete)}
        title={
          pendingDelete
            ? t(`Xoá "${pendingDelete.title}"?`, `Delete "${pendingDelete.title}"?`)
            : ""
        }
      >
        {effects.length ? (
          <div>
            <p className="mb-2 text-[13px] font-medium text-ledger-ink-2">
              {t("Số dư ví sau khi xoá", "Wallet balance afterwards")}
            </p>
            <dl className="divide-y divide-ledger-line rounded-[12px] border border-ledger-line bg-ledger-canvas px-3.5">
              {effects.map((effect) => (
                <div
                  // A phone puts the figures under the name on every row, so
                  // two wallets never end up laid out two different ways.
                  className="flex flex-col gap-1 py-2.5 text-[13.5px] sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  key={effect.id}
                >
                  <dt className="min-w-0 truncate font-medium text-ledger-ink">{effect.name}</dt>
                  <dd className="flex shrink-0 items-center gap-1.5">
                    {effect.balance !== null ? (
                      <>
                        <Money amount={effect.balance} tone="muted" />
                        <ArrowRight className="h-3.5 w-3.5 text-ledger-muted" />
                        <Money
                          amount={effect.balance + effect.delta}
                          className="font-semibold"
                          tone={effect.balance + effect.delta < 0 ? "out" : "neutral"}
                        />
                      </>
                    ) : (
                      <Money amount={effect.delta} className="font-semibold" signed tone="auto" />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {goesNegative.length ? (
              <Notice className="mt-3" icon={TriangleAlert} tone="amber">
                {goesNegative
                  .map((effect) =>
                    t(
                      `${effect.name} sẽ âm ${formatMoney(Math.abs((effect.balance || 0) + effect.delta))}.`,
                      `${effect.name} will be ${formatMoney(Math.abs((effect.balance || 0) + effect.delta))} below zero.`,
                    ),
                  )
                  .join(" ")}{" "}
                {t("Vẫn xoá được; cân đối ví sau nếu cần.", "You can still delete it and reconcile later.")}
              </Notice>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
};

export default TransactionsPage;

