import { auth } from "lib/firebase/config";
import { isLedgerPreview } from "../preview";

/** A fresh ID token, or an error the caller can show as-is. */
export const getIdToken = async () => {
  if (isLedgerPreview()) {
    return "ledger-preview";
  }
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Phiên đăng nhập đã hết, vui lòng đăng nhập lại.");
  }
  return token;
};

export interface ServerWarning {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Non-blocking notices the server attaches to a save (wallet went negative,
 * budget exceeded, date moved to scheduled...). Create and update both return
 * them at the top level; `data.warnings` is read too in case a caller passes
 * an unwrapped payload.
 */
export const extractWarnings = (response: unknown): ServerWarning[] => {
  const candidate =
    (response as { warnings?: unknown })?.warnings ??
    (response as { data?: { warnings?: unknown } })?.data?.warnings;

  return Array.isArray(candidate)
    ? candidate.filter(
        (item): item is ServerWarning =>
          Boolean(item) && typeof (item as ServerWarning).message === "string",
      )
    : [];
};
