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

interface LocaleContextValue {
    language: Language;
    setLanguage: (language: Language) => void;
    moneyDisplayMode: MoneyDisplayMode;
    setMoneyDisplayMode: (mode: MoneyDisplayMode) => void;
    isVietnamese: boolean;
}

const STORAGE_KEY = "fintrack-language";
const MONEY_DISPLAY_STORAGE_KEY = "fintrack-money-display";

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

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

export const LocaleProvider: React.FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [language, setLanguageState] = useState<Language>(readInitialLanguage);
    const [moneyDisplayMode, setMoneyDisplayModeState] =
        useState<MoneyDisplayMode>(readInitialMoneyDisplay);

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

    const value = useMemo<LocaleContextValue>(
        () => ({
            language,
            setLanguage: setLanguageState,
            moneyDisplayMode,
            setMoneyDisplayMode: setMoneyDisplayModeState,
            isVietnamese: language === "vi",
        }),
        [language, moneyDisplayMode],
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
