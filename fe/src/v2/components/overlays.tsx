import React, { useEffect, useRef } from "react";
import { Delete, X } from "lucide-react";
import { cn } from "lib/utils";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { Button } from "./primitives";

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
 * Where every form lives. On desktop it is a drawer on the right edge, so the
 * list the user is working from stays in view; on a phone it becomes a bottom
 * sheet with the primary action pinned under the thumb.
 */
export const Panel: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  /** Lets the mobile sheet fill the screen, for forms with a keypad. */
  tall?: boolean;
}> = ({ open, onClose, title, children, footer, width = 480, tall }) => {
  const isDesktop = useIsDesktop();
  useOverlayBehaviour(open, onClose);

  if (!open) {
    return null;
  }

  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-50">
        {/* Barely tinted: the page behind stays readable, but a click on it
            still closes the drawer the way people expect. */}
        <button
          aria-label="Đóng"
          className="ledger-backdrop absolute inset-0 h-full w-full cursor-default bg-[rgba(13,18,32,0.06)]"
          onClick={onClose}
          tabIndex={-1}
          type="button"
        />
        <aside
          aria-label={title}
          aria-modal="true"
          className="ledger-drawer absolute bottom-0 right-0 top-0 flex max-w-full flex-col border-l border-ledger-line bg-ledger-paper shadow-float"
          role="dialog"
          style={{ width }}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-ledger-line px-6">
            <h2 className="text-[17px] font-semibold text-ledger-ink">{title}</h2>
            <button
              aria-label="Đóng"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ledger-ink-2 hover:bg-ledger-canvas hover:text-ledger-ink"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" />
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
        className="ledger-backdrop absolute inset-0 h-full w-full cursor-default bg-black/40"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-label={title}
        aria-modal="true"
        className={cn(
          "ledger-sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-[24px] bg-ledger-paper shadow-float",
          tall ? "h-[94dvh]" : "max-h-[90dvh]",
        )}
        role="dialog"
      >
        <div className="flex shrink-0 justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-ledger-line-strong" />
        </div>
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-2">
          <h2 className="text-[17px] font-semibold text-ledger-ink">{title}</h2>
          <button
            aria-label="Đóng"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ledger-ink-2 hover:bg-ledger-canvas"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">{children}</div>
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
        aria-modal="true"
        className="ledger-sheet relative w-full max-w-[420px] rounded-[18px] bg-ledger-paper p-6 shadow-float"
        role="alertdialog"
      >
        <h2 className="text-[17px] font-semibold text-ledger-ink">{title}</h2>
        {description ? (
          <p className="mt-2 text-[14px] leading-relaxed text-ledger-ink-2">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button disabled={busy} onClick={onClose} variant="ghost">
            {cancelLabel}
          </Button>
          <Button
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

  return (
    <div className="grid grid-cols-3 border-t border-ledger-line">
      {keys.map((key) => (
        <button
          className="ledger-num h-[52px] border-b border-r border-ledger-line text-[22px] font-medium text-ledger-ink active:bg-ledger-canvas [&:nth-child(3n)]:border-r-0"
          key={key}
          onClick={() => onDigits(key)}
          type="button"
        >
          {key}
        </button>
      ))}
      <button
        aria-label="Xoá một số"
        className="flex h-[52px] items-center justify-center border-b border-ledger-line text-ledger-ink-2 active:bg-ledger-canvas"
        onClick={onBackspace}
        type="button"
      >
        <Delete className="h-6 w-6" />
      </button>
    </div>
  );
};
