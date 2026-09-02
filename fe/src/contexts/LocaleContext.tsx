import React, {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

export type Language = "vi" | "en";
export type MoneyDisplayMode = "full" | "compact";
export type CurrencyCode = "VND" | "USD" | "EUR";
/** "auto" follows the language: Vietnamese uses VND, English uses USD. */
export type CurrencyPreference = "auto" | CurrencyCode;

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ["VND", "USD", "EUR"];

export const SUPPORTED_TIMEZONES = [
    { value: "Asia/Ho_Chi_Minh", vi: "Việt Nam (GMT+7)", en: "Vietnam (GMT+7)" },
    { value: "Asia/Bangkok", vi: "Bangkok (GMT+7)", en: "Bangkok (GMT+7)" },
    { value: "Asia/Singapore", vi: "Singapore (GMT+8)", en: "Singapore (GMT+8)" },
    { value: "Asia/Tokyo", vi: "Tokyo (GMT+9)", en: "Tokyo (GMT+9)" },
    { value: "Australia/Sydney", vi: "Sydney (GMT+10/11)", en: "Sydney (GMT+10/11)" },
    { value: "Europe/London", vi: "London (GMT+0/1)", en: "London (GMT+0/1)" },
    { value: "Europe/Paris", vi: "Paris (GMT+1/2)", en: "Paris (GMT+1/2)" },
    { value: "America/New_York", vi: "New York (GMT-5/4)", en: "New York (GMT-5/4)" },
    { value: "America/Los_Angeles", vi: "Los Angeles (GMT-8/7)", en: "Los Angeles (GMT-8/7)" },
    { value: "UTC", vi: "UTC (GMT+0)", en: "UTC (GMT+0)" },
] as const;

export const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

interface LocaleContextValue {
    language: Language;
    setLanguage: (language: Language) => void;
    moneyDisplayMode: MoneyDisplayMode;
    setMoneyDisplayMode: (mode: MoneyDisplayMode) => void;
    currencyPreference: CurrencyPreference;
    setCurrencyPreference: (preference: CurrencyPreference) => void;
    /** Currency used for new wallets and for totals with no wallet context. */
    defaultCurrency: CurrencyCode;
    timezone: string;
    setTimezone: (timezone: string) => void;
    /**
     * Offset of the selected timezone right now, in the same convention as
     * Date.prototype.getTimezoneOffset() (UTC+7 is -420). This is what the API
     * needs to decide which calendar day a transaction belongs to.
     */
    timezoneOffsetMinutes: number;
    isVietnamese: boolean;
}

const STORAGE_KEY = "tonfin-language";
const MONEY_DISPLAY_STORAGE_KEY = "tonfin-money-display";
const CURRENCY_STORAGE_KEY = "tonfin-currency";
const TIMEZONE_STORAGE_KEY = "tonfin-timezone";

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

/**
 * Offset of an IANA timezone at a given instant, without pulling in a date
 * library: format the instant as wall-clock time in that zone, read it back as
 * if it were UTC, and compare.
 */
export const getTimezoneOffsetMinutes = (
    timeZone: string,
    at: Date = new Date(),
): number => {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).formatToParts(at);

        const read = (type: string) =>
            Number(parts.find((part) => part.type === type)?.value || "0");

        const asUtc = Date.UTC(
            read("year"),
            read("month") - 1,
            read("day"),
            read("hour"),
            read("minute"),
            read("second"),
        );

        return -Math.round((asUtc - at.getTime()) / 60000);
    } catch {
        return at.getTimezoneOffset();
    }
};

const readInitialLanguage = (): Language => {
    if (typeof window === "undefined") {
        return "vi";
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "vi";
};

const readInitialMoneyDisplay = (): MoneyDisplayMode => {
    if (typeof window === "undefined") {
        return "full";
    }

    const stored = window.localStorage.getItem(MONEY_DISPLAY_STORAGE_KEY);
    return stored === "compact" ? "compact" : "full";
};

const readInitialCurrency = (): CurrencyPreference => {
    if (typeof window === "undefined") {
        return "auto";
    }

    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    return stored && SUPPORTED_CURRENCIES.includes(stored as CurrencyCode)
        ? (stored as CurrencyCode)
        : "auto";
};

const readInitialTimezone = (): string => {
    if (typeof window === "undefined") {
        return DEFAULT_TIMEZONE;
    }

    const stored = window.localStorage.getItem(TIMEZONE_STORAGE_KEY);
    return stored &&
        SUPPORTED_TIMEZONES.some((zone) => zone.value === stored)
        ? stored
        : DEFAULT_TIMEZONE;
};

export const LocaleProvider: React.FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [language, setLanguageState] = useState<Language>(readInitialLanguage);
    const [moneyDisplayMode, setMoneyDisplayModeState] =
        useState<MoneyDisplayMode>(readInitialMoneyDisplay);
    const [currencyPreference, setCurrencyPreferenceState] =
        useState<CurrencyPreference>(readInitialCurrency);
    const [timezone, setTimezoneState] = useState<string>(readInitialTimezone);

    const defaultCurrency: CurrencyCode =
        currencyPreference === "auto"
            ? language === "en"
                ? "USD"
                : "VND"
            : currencyPreference;

    useEffect(() => {
        document.documentElement.lang = language;
        window.localStorage.setItem(STORAGE_KEY, language);
    }, [language]);

    useEffect(() => {
        document.documentElement.dataset.moneyDisplay = moneyDisplayMode;
        window.localStorage.setItem(
            MONEY_DISPLAY_STORAGE_KEY,
            moneyDisplayMode,
        );
    }, [moneyDisplayMode]);

    useEffect(() => {
        // Mirrored onto the document so the plain formatter helpers, which are
        // not React components, can read the active settings.
        document.documentElement.dataset.currency = defaultCurrency;
        window.localStorage.setItem(CURRENCY_STORAGE_KEY, currencyPreference);
    }, [currencyPreference, defaultCurrency]);

    useEffect(() => {
        document.documentElement.dataset.timezone = timezone;
        window.localStorage.setItem(TIMEZONE_STORAGE_KEY, timezone);
    }, [timezone]);

    const value = useMemo<LocaleContextValue>(
        () => ({
            language,
            setLanguage: setLanguageState,
            moneyDisplayMode,
            setMoneyDisplayMode: setMoneyDisplayModeState,
            currencyPreference,
            setCurrencyPreference: setCurrencyPreferenceState,
            defaultCurrency,
            timezone,
            setTimezone: setTimezoneState,
            timezoneOffsetMinutes: getTimezoneOffsetMinutes(timezone),
            isVietnamese: language === "vi",
        }),
        [
            currencyPreference,
            defaultCurrency,
            language,
            moneyDisplayMode,
            timezone,
        ],
    );

    return (
        <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
    );
};

export const useLocale = () => {
    const context = useContext(LocaleContext);
    if (!context) {
        throw new Error("useLocale must be used within LocaleProvider");
    }
    return context;
};
