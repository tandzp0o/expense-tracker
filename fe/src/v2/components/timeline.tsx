import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "lib/utils";
import { useLocale } from "contexts/LocaleContext";
import type { TimelineDay, TimelineEntry } from "../lib/timeline";
import { CategoryIcon, Money } from "./primitives";

const StatusPill: React.FC<{ status: TimelineEntry["status"] }> = ({ status }) => {
  const { isVietnamese } = useLocale();

  if (status === "COMPLETED") {
    return null;
  }

  const label =
    status === "SCHEDULED"
      ? isVietnamese
        ? "Đã lên lịch"
        : "Scheduled"
      : status === "PENDING"
        ? isVietnamese
          ? "Đang chờ"
          : "Pending"
        : isVietnamese
          ? "Đã huỷ"
          : "Cancelled";

  return (
    <span className="shrink-0 rounded-full bg-ledger-spend-wash px-2 py-0.5 text-[11.5px] font-semibold text-ledger-spend">
      {label}
    </span>
  );
};

/**
 * One transaction. Clicking the row opens its actions underneath, on a phone
 * and with a mouse alike: icons that only appear on hover either eat the title
 * on a small screen or leave a hole beside every amount on a large one.
 *
 * With `columns`, a wide screen shows category and wallet as their own
 * columns, so a long list reads like a ledger instead of a column of names
 * with amounts floating far to the right.
 */
export const TimelineRow: React.FC<{
  entry: TimelineEntry;
  onEdit?: (entry: TimelineEntry) => void;
  onDelete?: (entry: TimelineEntry) => void;
  columns?: boolean;
}> = ({ entry, onEdit, onDelete, columns }) => {
  const { isVietnamese } = useLocale();
  const [open, setOpen] = React.useState(false);
  const tone =
    entry.kind === "income" ? "in" : entry.kind === "expense" ? "out" : "neutral";
  const planned = entry.status !== "COMPLETED";
  const canEdit = Boolean(onEdit && entry.editable);
  const canDelete = Boolean(onDelete);
  const hasActions = canEdit || canDelete;
  const editLabel = isVietnamese ? "Sửa" : "Edit";
  const deleteLabel = isVietnamese ? "Xoá" : "Delete";

  const body = (
    <>
      <CategoryIcon meta={entry.meta} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[15px] font-medium text-ledger-ink">{entry.title}</p>
          <span className="hidden sm:contents">
            <StatusPill status={entry.status} />
          </span>
        </div>
        {/* On a phone the status moves to the second line, so it never cuts
            the title short. */}
        <div className={cn("flex min-w-0 items-center gap-2", columns && "xl:hidden")}>
          <span className="contents sm:hidden">
            <StatusPill status={entry.status} />
          </span>
          <p className="truncate text-[13px] text-ledger-muted">{entry.subtitle}</p>
        </div>
      </div>
      {columns ? (
        <>
          <span className="hidden w-[180px] shrink-0 truncate text-[13.5px] text-ledger-ink-2 xl:block">
            {entry.categoryLabel}
          </span>
          <span className="hidden w-[220px] shrink-0 truncate text-[13.5px] text-ledger-ink-2 xl:block">
            {entry.walletLabel}
          </span>
        </>
      ) : null}
      <Money
        amount={entry.amount}
        className={cn(
          "shrink-0 text-right text-[15px] font-semibold",
          columns && "xl:w-[150px]",
          planned && "opacity-60",
        )}
        signed={entry.kind === "income" || entry.kind === "expense"}
        tone={tone}
      />
    </>
  );

  return (
    <div className="border-b border-ledger-line last:border-b-0">
      {hasActions ? (
        <button
          aria-expanded={open}
          className={cn(
            "-mx-2 flex w-[calc(100%+16px)] min-w-0 items-center gap-3 rounded-[12px] px-2 py-3 text-left transition-colors hover:bg-ledger-hover",
            open && "bg-ledger-hover",
          )}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-3 py-3">{body}</div>
      )}
      {hasActions && open ? (
        <div className="flex flex-wrap items-center gap-2 pb-3 pl-[52px] pt-1">
          {canEdit ? (
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-ledger-line-strong bg-ledger-paper px-3.5 text-[13px] font-semibold text-ledger-ink hover:bg-ledger-hover"
              onClick={() => {
                setOpen(false);
                onEdit?.(entry);
              }}
              type="button"
            >
              <Pencil className="h-3.5 w-3.5" />
              {editLabel}
            </button>
          ) : null}
          {canDelete ? (
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-ledger-line-strong bg-ledger-paper px-3.5 text-[13px] font-semibold text-ledger-out hover:bg-ledger-out-wash"
              onClick={() => {
                setOpen(false);
                onDelete?.(entry);
              }}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleteLabel}
            </button>
          ) : null}
          {!canEdit ? (
            <p className="text-[12.5px] text-ledger-muted">
              {isVietnamese
                ? "Loại giao dịch này không sửa trực tiếp được. Xoá rồi ghi lại nếu cần."
                : "This kind of entry cannot be edited. Delete it and record it again if needed."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

/** Column titles for the wide layout; hidden below xl. */
export const TimelineColumnsHeader: React.FC = () => {
  const { isVietnamese } = useLocale();
  const label = "text-[12px] font-semibold uppercase tracking-[0.06em] text-ledger-muted";

  return (
    <div className="mb-2 hidden items-center gap-3 border-b border-ledger-line pb-2.5 xl:flex">
      <span className={cn(label, "flex-1 pl-[52px]")}>
        {isVietnamese ? "Giao dịch" : "Transaction"}
      </span>
      <span className={cn(label, "w-[180px]")}>{isVietnamese ? "Danh mục" : "Category"}</span>
      <span className={cn(label, "w-[220px]")}>{isVietnamese ? "Ví" : "Wallet"}</span>
      <span className={cn(label, "w-[150px] text-right")}>
        {isVietnamese ? "Số tiền" : "Amount"}
      </span>
    </div>
  );
};

/**
 * A day of transactions: a tinted heading with the day's net, then its rows.
 * The heading is a filled bar rather than tiny caps on a hairline, so days
 * separate clearly when scanning a long list.
 */
export const TimelineDayGroup: React.FC<{
  day: TimelineDay;
  onEdit?: (entry: TimelineEntry) => void;
  onDelete?: (entry: TimelineEntry) => void;
  columns?: boolean;
  /** Keep the day heading in view while its rows scroll (long lists only). */
  sticky?: boolean;
}> = ({ day, onEdit, onDelete, columns, sticky }) => (
  <div className="mt-3 first:mt-0">
    <div
      className={cn(
        // Same inset as the rows (-mx-2 px-2), so the day total lines up with
        // the amounts under it.
        "-mx-2 flex items-center justify-between gap-3 rounded-[10px] bg-ledger-canvas px-2 py-2",
        sticky && "sticky top-0 z-[1]",
      )}
    >
      <span className="text-[13px] font-semibold text-ledger-ink-2">{day.label}</span>
      {day.net !== 0 ? (
        <Money amount={day.net} className="text-[13px] font-semibold" signed tone="auto" />
      ) : null}
    </div>
    {day.entries.map((entry) => (
      <TimelineRow
        columns={columns}
        entry={entry}
        key={entry.id}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    ))}
  </div>
);
