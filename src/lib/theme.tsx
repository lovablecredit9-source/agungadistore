import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

export type Theme = "light" | "dark" | "gold" | "diamond" | "custom" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: "light" | "dark" | "gold" | "diamond" | "custom";
  customBgUrl: string;
  setCustomBgUrl: (url: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  resolvedTheme: "light",
  customBgUrl: "",
  setCustomBgUrl: () => {},
});

const VALID_THEMES: Theme[] = ["light", "dark", "gold", "diamond", "custom", "system"];

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("app_theme") as Theme | null;
    return stored && VALID_THEMES.includes(stored) ? stored : "light";
  });

  const [customBgUrl, setCustomBgUrlState] = useState<string>(() => {
    return localStorage.getItem("app_custom_bg") || "";
  });

  const resolvedTheme: "light" | "dark" | "gold" | "diamond" | "custom" =
    theme === "system" ? getSystemTheme() : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "gold", "diamond", "custom-bg");
    if (resolvedTheme === "dark") root.classList.add("dark");
    else if (resolvedTheme === "gold") root.classList.add("gold");
    else if (resolvedTheme === "diamond") root.classList.add("diamond");
    else if (resolvedTheme === "custom") root.classList.add("custom-bg");
    localStorage.setItem("app_theme", theme);
  }, [theme, resolvedTheme]);

  // Apply custom background image
  useEffect(() => {
    const body = document.body;
    if (resolvedTheme === "custom" && customBgUrl) {
      body.style.backgroundImage = `
        linear-gradient(to bottom, hsla(0,0%,0%,0.3), hsla(0,0%,0%,0.15)),
        url(${customBgUrl})`;
      body.style.backgroundSize = "cover";
      body.style.backgroundPosition = "center";
      body.style.backgroundAttachment = "fixed";
    } else {
      // Reset to default CSS background
      body.style.backgroundImage = "";
      body.style.backgroundSize = "";
      body.style.backgroundPosition = "";
      body.style.backgroundAttachment = "";
    }
  }, [resolvedTheme, customBgUrl]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setThemeState("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  
  const setCustomBgUrl = useCallback((url: string) => {
    setCustomBgUrlState(url);
    localStorage.setItem("app_custom_bg", url);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, customBgUrl, setCustomBgUrl }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
