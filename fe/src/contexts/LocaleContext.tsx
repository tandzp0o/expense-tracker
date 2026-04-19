import React, {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

export type Language = "vi" | "en";

interface LocaleContextValue {
    language: Language;
    setLanguage: (language: Language) => void;
    isVietnamese: boolean;
}

const STORAGE_KEY = "fintrack-language";

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const readInitialLanguage = (): Language => {
    if (typeof window === "undefined") {
        return "vi";
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "vi";
};

export const LocaleProvider: React.FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [language, setLanguageState] = useState<Language>(readInitialLanguage);

    useEffect(() => {
        document.documentElement.lang = language;
        window.localStorage.setItem(STORAGE_KEY, language);
    }, [language]);

    const value = useMemo<LocaleContextValue>(
        () => ({
            language,
            setLanguage: setLanguageState,
            isVietnamese: language === "vi",
        }),
        [language],
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
