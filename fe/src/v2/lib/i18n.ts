import { useCallback } from "react";
import { useLocale } from "contexts/LocaleContext";

/**
 * `t("Lưu", "Save")`. The app keeps both languages inline next to the markup
 * rather than in a catalogue; this only shortens the ternary it already uses.
 */
export const useT = () => {
  const { isVietnamese } = useLocale();
  return useCallback(
    (vi: string, en: string) => (isVietnamese ? vi : en),
    [isVietnamese],
  );
};
