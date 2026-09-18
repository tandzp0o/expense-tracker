import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  ReceiptText,
  Search,
  SearchX,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "lib/utils";
import { getMonthRangeIso, transactionApi, walletApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { ConfirmDialog } from "../components/overlays";
import {
  Button,
  Chip,
  EmptyState,
  Money,
  Notice,
  PageHeader,
  SkeletonRows,
  TextLink,
} from "../components/primitives";
import { TimelineDayGroup } from "../components/timeline";
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
 * A native <select> dressed as a filter pill. The real control sits on top,
 * invisible, so the phone still opens its own picker and the pill is only as
 * wide as the current choice rather than the longest option.
 */
const FilterSelect: React.FC<{
  label: string;
  value: string;
  display: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ label, value, display, onChange, children }) => (
  <label
    className={cn(
      "relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border pl-3.5 pr-3 text-[13px] font-medium transition-colors",
      "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ledger-accent",
      value
        ? "border-ledger-accent bg-ledger-accent-wash text-ledger-accent"
        : "border-ledger-line bg-ledger-paper text-ledger-ink-2 hover:border-ledger-line-strong hover:text-ledger-ink",
    )}
  >
    <span className="max-w-[180px] truncate">{display}</span>
    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
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

  const summaryLine =
    kind === "transfer" ? (
      <span className="text-[12.5px] text-ledger-muted">
        {t("Chuyển ví không tính vào thu chi", "Transfers are not income or spending")}
      </span>
    ) : summary ? (
      <span className="flex items-center gap-2 whitespace-nowrap text-[13px] text-ledger-ink-2">
        {kind !== "expense" ? (
          <span>
            {t("Thu", "In")}{" "}
            <Money amount={summary.income} className="font-semibold" tone="in" />
          </span>
        ) : null}
        {kind === "all" ? <span className="text-ledger-muted">·</span> : null}
        {kind !== "income" ? (
          <span>
            {t("Chi", "Out")}{" "}
            <Money amount={summary.expense} className="font-semibold" tone="out" />
          </span>
        ) : null}
      </span>
    ) : null;

  /* ------------------------------------------------------------- Render */

  const kinds: Array<{ value: Kind; label: string }> = [
    { value: "all", label: t("Tất cả", "All") },
    { value: "expense", label: t("Chi", "Out") },
    { value: "income", label: t("Thu", "In") },
    { value: "transfer", label: t("Chuyển ví", "Transfers") },
  ];

  const retry = () => {
    setError(null);
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  // Without this an unreachable server would read as "no transactions".
  const errorNotice = error ? (
    <Notice
      action={<TextLink onClick={retry}>{t("Thử lại", "Retry")}</TextLink>}
      className="mt-5"
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
        <div className="[&>*+*]:mt-3">
          {days.map((day) => (
            <TimelineDayGroup
              day={day}
              key={day.dayKey}
              onDelete={requestDelete}
              onEdit={(entry) => openQuickAdd({ editing: entry.source })}
            />
          ))}
        </div>
        {hasMore ? (
          <div className="flex flex-col items-center gap-2 border-t border-ledger-line pt-6">
            <Button disabled={loadingMore} onClick={loadMore} variant="outline">
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

  return (
    <div>
      <PageHeader
        actions={
          <>
            <div className="relative min-w-0 flex-1 sm:w-[260px] sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ledger-muted" />
              <input
                aria-label={t("Tìm trong ghi chú", "Search notes")}
                className="h-10 w-full rounded-[10px] border border-ledger-line bg-ledger-paper pl-9 pr-9 text-[14px] text-ledger-ink outline-none transition-colors placeholder:text-ledger-muted focus:border-ledger-accent"
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
          </>
        }
        subtitle={subtitle}
        title={t("Giao dịch", "Transactions")}
      />

      {/* One row of filters. It scrolls sideways on a phone, and the month's
          totals drop to their own line there instead of scrolling out of
          sight at the end of it. */}
      <div className="flex flex-col gap-3 border-b border-ledger-line py-3.5 lg:flex-row lg:items-center lg:gap-6">
        <div className="ledger-scroll-x -mx-1 flex min-w-0 items-center gap-2 px-1 lg:flex-1 lg:flex-wrap">
          {kinds.map((option) => (
            <Chip
              key={option.value}
              onClick={() => chooseKind(option.value)}
              selected={kind === option.value}
            >
              {option.label}
            </Chip>
          ))}

          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-ledger-line" />

          <div className="inline-flex h-9 shrink-0 items-center rounded-full border border-ledger-line bg-ledger-paper">
            <button
              aria-label={t("Tháng trước", "Previous month")}
              className="flex h-full w-9 items-center justify-center rounded-l-full text-ledger-ink-2 hover:bg-ledger-canvas hover:text-ledger-ink"
              onClick={() => setPeriod((current) => shiftMonth(current, -1))}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="ledger-num min-w-[96px] px-1 text-center text-[13px] font-medium text-ledger-ink">
              {isVietnamese
                ? monthLabel(period.month, period.year, true)
                : englishMonth(period, "short", true)}
            </span>
            <button
              aria-label={t("Tháng sau", "Next month")}
              className="flex h-full w-9 items-center justify-center rounded-r-full text-ledger-ink-2 hover:bg-ledger-canvas hover:text-ledger-ink"
              onClick={() => setPeriod((current) => shiftMonth(current, 1))}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <FilterSelect
            display={walletId ? selectedWalletName : t("Mọi ví", "All wallets")}
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
        </div>

        {!loading && !error ? <div className="shrink-0">{summaryLine}</div> : null}
      </div>

      <section className="pb-2">
        {errorNotice}
        {body}
      </section>

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
            <dl className="divide-y divide-ledger-line border-y border-ledger-line">
              {effects.map((effect) => (
                <div
                  className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]"
                  key={effect.id}
                >
                  <dt className="min-w-0 truncate text-ledger-ink-2">{effect.name}</dt>
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
