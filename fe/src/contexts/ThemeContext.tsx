import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { theme as antdTheme } from "antd";

export type ThemeType = "light" | "dark" | "custom";

export interface CustomTheme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface ThemeContextType {
  theme: ThemeType;
  customTheme: CustomTheme;
  setTheme: (theme: ThemeType) => void;
  setCustomTheme: (customTheme: CustomTheme) => void;
  antdTheme: any;
}

const defaultCustomTheme: CustomTheme = {
  primaryColor: "#667eea",
  backgroundColor: "#ffffff",
  textColor: "#1e293b",
  secondaryColor: "#f1f5f9",
  accentColor: "#06b6d4",
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("app-theme");
    return (saved as ThemeType) || "light";
  });

  const [customTheme, setCustomTheme] = useState<CustomTheme>(() => {
    const saved = localStorage.getItem("app-custom-theme");
    return saved ? JSON.parse(saved) : defaultCustomTheme;
  });

  useEffect(() => {
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("app-custom-theme", JSON.stringify(customTheme));
  }, [customTheme]);

  const getAntdTheme = () => {
    const baseTheme =
      theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

    if (theme === "custom") {
      return {
        algorithm: baseTheme,
        token: {
          colorPrimary: customTheme.primaryColor,
          colorBgBase: customTheme.backgroundColor,
          colorTextBase: customTheme.textColor,
          colorBgContainer: customTheme.secondaryColor,
          colorBorderSecondary: customTheme.secondaryColor,
          colorPrimaryHover: customTheme.accentColor,
        },
      };
    }

    return {
      algorithm: baseTheme,
    };
  };

  const value: ThemeContextType = {
    theme,
    customTheme,
    setTheme,
    setCustomTheme,
    antdTheme: getAntdTheme(),
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
