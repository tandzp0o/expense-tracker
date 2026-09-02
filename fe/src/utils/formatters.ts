const MONEY_DISPLAY_STORAGE_KEY = "tonfin-money-display";

const getActiveLanguage = () => {
    if (typeof document === "undefined") {
        return "vi";
    }

    return document.documentElement.lang === "en" ? "en" : "vi";
};

const getMoneyDisplayMode = () => {
    if (typeof document !== "undefined") {
        return document.documentElement.dataset.moneyDisplay === "compact"
            ? "compact"
            : "full";
    }

    if (typeof window !== "undefined") {
        return window.localStorage.getItem(MONEY_DISPLAY_STORAGE_KEY) === "compact"
            ? "compact"
            : "full";
    }

    return "full";
};

const getLocale = () => (getActiveLanguage() === "en" ? "en-US" : "vi-VN");

/** Currency chosen in Settings; mirrored onto <html> by LocaleProvider. */
export const getActiveCurrency = () => {
    if (typeof document === "undefined") {
        return "VND";
    }

    return document.documentElement.dataset.currency || "VND";
};

/** Timezone chosen in Settings; dates are rendered as seen from there. */
const getActiveTimezone = () => {
    if (typeof document === "undefined") {
        return undefined;
    }

    return document.documentElement.dataset.timezone || undefined;
};

const formatNumericValue = (
    value: number,
    locale: string,
    maximumFractionDigits: number,
) =>
    new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits,
    }).format(value);

const formatCompactVietnameseCurrency = (amount: number, currency: string) => {
    const absolute = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";
    const units =
        currency === "VND"
            ? [
                  { value: 1e9, suffix: " tỷ" },
                  { value: 1e6, suffix: "tr" },
                  { value: 1e3, suffix: "k" },
              ]
            : [
                  { value: 1e9, suffix: "B" },
                  { value: 1e6, suffix: "M" },
                  { value: 1e3, suffix: "K" },
              ];

    const unit = units.find((entry) => absolute >= entry.value);
    if (!unit) {
        const base = formatNumericValue(
            absolute,
            "vi-VN",
            currency === "VND" ? 0 : 2,
        );
        return `${sign}${base}${currency === "VND" ? "đ" : ` ${currency}`}`;
    }

    const scaled = absolute / unit.value;
    const digits = scaled >= 10 ? 0 : 1;
    const formatted = formatNumericValue(scaled, "vi-VN", digits);
    return `${sign}${formatted}${unit.suffix}${currency === "VND" ? "" : ` ${currency}`}`;
};

const formatCompactEnglishCurrency = (amount: number, currency: string) => {
    const absolute = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";
    const units = [
        { value: 1e9, suffix: "B" },
        { value: 1e6, suffix: "M" },
        { value: 1e3, suffix: "K" },
    ];

    const unit = units.find((entry) => absolute >= entry.value);
    if (!unit) {
        const base = formatNumericValue(
            absolute,
            "en-US",
            currency === "VND" ? 0 : 2,
        );
        return `${sign}${base} ${currency}`;
    }

    const scaled = absolute / unit.value;
    const digits = scaled >= 10 ? 0 : 1;
    const formatted = formatNumericValue(scaled, "en-US", digits);
    return `${sign}${formatted}${unit.suffix} ${currency}`;
};

export const formatCurrency = (
    amount: number | null | undefined,
    currency: string = getActiveCurrency(),
    options?: { displayMode?: "full" | "compact" },
): string => {
    if (amount == null) {
        return getActiveLanguage() === "en" ? "N/A" : "Kh\u00f4ng c\u00f3 gi\u00e1";
    }

    const language = getActiveLanguage();
    const moneyDisplayMode = options?.displayMode || getMoneyDisplayMode();

    if (moneyDisplayMode === "compact") {
        return language === "vi"
            ? formatCompactVietnameseCurrency(amount, currency)
            : formatCompactEnglishCurrency(amount, currency);
    }

    const formattedNumber = formatNumericValue(
        amount,
        getLocale(),
        currency === "VND" ? 0 : 2,
    );

    if (language === "en") {
        return `${formattedNumber} ${currency}`;
    }

    return currency === "VND"
        ? `${formattedNumber}đ`
        : `${formattedNumber} ${currency}`;
};

export const formatCompactNumber = (
    num: number,
    digits: number = 1,
): string => {
    const lookup = [
        { value: 1, symbol: "" },
        { value: 1e3, symbol: "k" },
        { value: 1e6, symbol: "M" },
        { value: 1e9, symbol: "B" },
        { value: 1e12, symbol: "T" },
    ];

    const rx = /\.0+$|(\.\d*[1-9])0+$/;
    const item = [...lookup].reverse().find((entry) => num >= entry.value);

    return item
        ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol
        : "0";
};

/**
 * Dates are always rendered as dd/MM/yyyy, regardless of the active language:
 * toLocaleDateString would flip to M/D/YYYY on the English locale.
 */
export const formatDate = (date: string | number | Date): string => {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    const timeZone = getActiveTimezone();

    try {
        // en-GB gives dd/mm/yyyy in every language, and the timezone makes the
        // rendered day match the one the user actually recorded.
        return new Intl.DateTimeFormat("en-GB", {
            timeZone,
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(parsed);
    } catch {
        const day = String(parsed.getDate()).padStart(2, "0");
        const month = String(parsed.getMonth() + 1).padStart(2, "0");

        return `${day}/${month}/${parsed.getFullYear()}`;
    }
};

/**
 * yyyy-MM-dd for a <input type="date">, expressed in the given timezone offset
 * (getTimezoneOffset convention). Without the shift, "today" near midnight
 * resolves to the browser's day rather than the configured one.
 */
export const toDateInputValue = (
    date: string | number | Date,
    timezoneOffsetMinutes = 0,
): string => {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    return new Date(parsed.getTime() - timezoneOffsetMinutes * 60 * 1000)
        .toISOString()
        .slice(0, 10);
};

export const formatDateTime = (date: string | number | Date): string => {
    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return "";
    }

    return `${d.toLocaleTimeString(getLocale(), {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: getActiveTimezone(),
    })} ${formatDate(d)}`;
};

export const formatWholeNumberInput = (
    value: number | null | undefined,
): string => {
    if (!value || value <= 0) {
        return "";
    }

    return new Intl.NumberFormat(getLocale(), {
        maximumFractionDigits: 0,
    }).format(value);
};

export const parseWholeNumberInput = (value: string): number => {
    const digits = String(value || "").replace(/[^\d]/g, "");
    if (!digits) {
        return 0;
    }

    return Math.min(Number(digits), Number.MAX_SAFE_INTEGER);
};
