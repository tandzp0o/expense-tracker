import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "lib/utils";
import { useLocale } from "contexts/LocaleContext";
import type { TimelineDay, TimelineEntry } from "../lib/timeline";
import { CategoryIcon, Eyebrow, Money } from "./primitives";

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
    <span className="shrink-0 rounded-full bg-ledger-spend-wash px-2 py-0.5 text-[11px] font-semibold text-ledger-spend">
      {label}
    </span>
  );
};

export const TimelineRow: React.FC<{
  entry: TimelineEntry;
  onEdit?: (entry: TimelineEntry) => void;
  onDelete?: (entry: TimelineEntry) => void;
}> = ({ entry, onEdit, onDelete }) => {
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
      <CategoryIcon meta={entry.meta} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[14.5px] font-medium text-ledger-ink">
            {entry.title}
          </p>
          <StatusPill status={entry.status} />
        </div>
        <p className="truncate text-[12.5px] text-ledger-muted">{entry.subtitle}</p>
      </div>
      <Money
        amount={entry.amount}
        className={cn("shrink-0 text-[14.5px] font-semibold", planned && "opacity-60")}
        signed={entry.kind === "income" || entry.kind === "expense"}
        tone={tone}
      />
    </>
  );

  return (
    <div className="group border-b border-ledger-line last:border-b-0">
      <div className="flex min-h-[64px] items-center gap-3 py-3">
        {/* On a phone the icons would eat the title, so the row itself opens
            its actions; with a mouse they appear on hover instead. */}
        {hasActions ? (
          <button
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-3 text-left lg:cursor-default"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {body}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
        )}
        {hasActions ? (
          <div className="hidden w-[72px] shrink-0 items-center justify-end lg:flex lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
            {canEdit ? (
              <button
                aria-label={editLabel}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ledger-muted hover:bg-ledger-canvas hover:text-ledger-ink"
                onClick={() => onEdit?.(entry)}
                type="button"
              >
                <Pencil className="h-4 w-4" />
              </button>
            ) : null}
            {canDelete ? (
              <button
                aria-label={deleteLabel}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ledger-muted hover:bg-ledger-out-wash hover:text-ledger-out"
                onClick={() => onDelete?.(entry)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {hasActions && open ? (
        <div className="-mt-1 flex flex-wrap gap-2 pb-3 pl-[48px] lg:hidden">
          {canEdit ? (
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-ledger-line-strong px-3.5 text-[13px] font-semibold text-ledger-ink"
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
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-ledger-line-strong px-3.5 text-[13px] font-semibold text-ledger-out"
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
            <p className="self-center text-[12px] text-ledger-muted">
              {isVietnamese ? "Dòng này không sửa được, chỉ xoá." : "This row can only be deleted."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export const TimelineDayGroup: React.FC<{
  day: TimelineDay;
  onEdit?: (entry: TimelineEntry) => void;
  onDelete?: (entry: TimelineEntry) => void;
}> = ({ day, onEdit, onDelete }) => (
  <div>
    <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-ledger-line bg-ledger-paper py-2.5">
      <Eyebrow>{day.label}</Eyebrow>
      {day.net !== 0 ? (
        <Money amount={day.net} className="text-[12.5px] font-semibold" signed tone="auto" />
      ) : null}
    </div>
    {day.entries.map((entry) => (
      <TimelineRow entry={entry} key={entry.id} onDelete={onDelete} onEdit={onEdit} />
    ))}
  </div>
);
