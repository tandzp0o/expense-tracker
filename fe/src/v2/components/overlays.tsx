import React, { useEffect, useRef } from "react";
import { Delete, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "lib/utils";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { Button, IconBadge } from "./primitives";

/** Locks page scroll while an overlay is open and hands focus back after. */
const useOverlayBehaviour = (open: boolean, onClose: () => void) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      previousFocus?.focus?.();
    };
  }, [open]);
};

/**
 * Where every form lives. On desktop it is a drawer that floats over the right
 * edge like one more card, so the list the user is working from stays in
 * view; on a phone it becomes a bottom sheet with the primary action pinned
 * under the thumb.
 */
export const Panel: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** A fixed drawer width. Left out, it is 480px, and 520px on wide screens. */
  width?: number;
  /** Lets the mobile sheet fill the screen, for forms with a keypad. */
  tall?: boolean;
}> = ({ open, onClose, title, children, footer, width, tall }) => {
  const isDesktop = useIsDesktop();
  useOverlayBehaviour(open, onClose);

  if (!open) {
    return null;
  }

  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-50">
        {/* Lightly tinted: the page behind stays readable, but the drawer is
            clearly on top, and a click on the page still closes it the way
            people expect. */}
        <button
          aria-label="Đóng"
          className="ledger-backdrop absolute inset-0 h-full w-full cursor-default bg-[rgba(13,18,32,0.16)] dark:bg-[rgba(0,0,0,0.5)]"
          onClick={onClose}
          tabIndex={-1}
          type="button"
        />
        <aside
          aria-label={title}
          aria-modal="true"
          className={cn(
            "ledger-drawer absolute bottom-3 right-3 top-3 flex max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-[20px] border border-ledger-line bg-ledger-paper shadow-float",
            width === undefined && "w-[480px] 2xl:w-[520px]",
          )}
          role="dialog"
          style={width === undefined ? undefined : { width }}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ledger-line px-6 py-4">
            <h2 className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.01em] text-ledger-ink">
              {title}
            </h2>
            <button
              aria-label="Đóng"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-ledger-line text-ledger-ink-2 transition-colors hover:bg-ledger-canvas hover:text-ledger-ink"
              onClick={onClose}
              type="button"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-ledger-line px-6 py-4">
              {footer}
            </div>
          ) : null}
        </aside>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Đóng"
        className="ledger-backdrop absolute inset-0 h-full w-full cursor-default bg-black/40 dark:bg-black/60"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-label={title}
        aria-modal="true"
        className={cn(
          "ledger-sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-[24px] border-t border-ledger-line bg-ledger-paper shadow-float",
          tall ? "h-[94dvh]" : "max-h-[90dvh]",
        )}
        role="dialog"
      >
        <div className="flex shrink-0 justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-ledger-line-strong" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-1.5">
          <h2 className="min-w-0 truncate text-[17px] font-semibold text-ledger-ink">{title}</h2>
          <button
            aria-label="Đóng"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ledger-canvas text-ledger-ink-2 active:bg-ledger-line"
            onClick={onClose}
            type="button"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-ledger-line px-5 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * Small centred dialog, kept for the one case that deserves interrupting:
 * confirming something destructive.
 */
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}> = ({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  busy,
  tone = "danger",
  onConfirm,
  onClose,
}) => {
  useOverlayBehaviour(open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        aria-label="Đóng"
        className="ledger-backdrop absolute inset-0 h-full w-full cursor-default bg-black/40"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-label={title}
        aria-modal="true"
        className="ledger-sheet relative w-full max-w-[440px] rounded-[20px] border border-ledger-line bg-ledger-paper p-5 shadow-float sm:p-6"
        role="alertdialog"
      >
        {/* The badge says what kind of question this is before a word is
            read: rose for something that removes or changes money. */}
        <div className="flex items-start gap-3.5">
          <IconBadge
            icon={tone === "danger" ? TriangleAlert : Info}
            size="md"
            tone={tone === "danger" ? "out" : "accent"}
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ledger-ink [overflow-wrap:anywhere]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 text-[14px] leading-relaxed text-ledger-ink-2">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
        {/* Side by side and equally wide on a phone, so the thumb has two
            clear targets; right-aligned on a wider screen. */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={onClose}
            variant="outline"
          >
            {cancelLabel}
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={onConfirm}
            variant={tone === "danger" ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * A number pad for money on phones. The OS keyboard covers half the form and
 * offers letters nobody needs here; "000" is there because VND amounts end in
 * zeros far more often than not.
 */
export const Keypad: React.FC<{
  onDigits: (digits: string) => void;
  onBackspace: () => void;
}> = ({ onDigits, onBackspace }) => {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0"];

  // Raised keys on a sunken tray, like a phone's own number pad: each key is
  // its own target instead of a cell in a hairline grid.
  return (
    <div className="grid grid-cols-3 gap-1.5 rounded-[16px] bg-ledger-canvas p-1.5">
      {keys.map((key) => (
        <button
          className="ledger-num h-12 rounded-[11px] bg-ledger-paper text-[22px] font-medium text-ledger-ink shadow-card transition-colors active:bg-ledger-line"
          key={key}
          onClick={() => onDigits(key)}
          type="button"
        >
          {key}
        </button>
      ))}
      <button
        aria-label="Xoá một số"
        className="flex h-12 items-center justify-center rounded-[11px] text-ledger-ink-2 transition-colors active:bg-ledger-line"
        onClick={onBackspace}
        type="button"
      >
        <Delete className="h-6 w-6" />
      </button>
    </div>
  );
};
