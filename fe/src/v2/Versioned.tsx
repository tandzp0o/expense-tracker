import React from "react";
import { useTheme } from "contexts/ThemeContext";
import { isLedgerPreview } from "./preview";

export const useIsLedger = () => {
  const { appearance } = useTheme();
  return isLedgerPreview() || appearance.uiVersion === "v2";
};

/**
 * Picks the v1 or v2 screen for a route from the interface version chosen in
 * Settings. A route without a v2 screen yet passes only `v1`, which then
 * renders inside the v2 shell so nothing becomes unreachable.
 */
export const Versioned: React.FC<{
  v1: React.ReactElement;
  v2?: React.ReactElement;
}> = ({ v1, v2 }) => {
  const isLedger = useIsLedger();
  return isLedger && v2 ? v2 : v1;
};
