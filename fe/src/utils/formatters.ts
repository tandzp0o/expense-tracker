const MONEY_DISPLAY_STORAGE_KEY = "fintrack-money-display";

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
    currency: string = "VND",
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

export const formatDate = (date: string | number | Date): string => {
    return new Date(date).toLocaleDateString(getLocale());
};

export const formatDateTime = (date: string | number | Date): string => {
    const d = new Date(date);
    return `${d.toLocaleTimeString(getLocale(), {
        hour: "2-digit",
        minute: "2-digit",
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
