/**
 * Development-only switch that lets a headless browser render the v2 screens
 * with fixture data and no login, so layouts can be checked by screenshot.
 * The NODE_ENV guard is resolved at build time: production bundles drop it.
 */
export const isLedgerPreview = () =>
  process.env.NODE_ENV === "development" &&
  typeof window !== "undefined" &&
  (window as unknown as { __LEDGER_PREVIEW__?: boolean }).__LEDGER_PREVIEW__ === true;
