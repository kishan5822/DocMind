"use client";

import * as React from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined
);


export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");

  // Re-apply the theme from localStorage after hydration, before the browser
  // paints. React's hydration removes the `dark` class the boot script added
  // (server HTML never has it), so useLayoutEffect puts it back before paint.
  React.useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem("docmind-theme") as Theme | null;
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const resolved: Theme = stored ?? (systemDark ? "dark" : "light");
      setThemeState(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    } catch {
      /* storage unavailable in private mode */
    }
  }, []);

  const applyTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("docmind-theme", next);
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }, []);

  const toggleTheme = React.useCallback(
    () => applyTheme(theme === "dark" ? "light" : "dark"),
    [theme, applyTheme]
  );

  const value = React.useMemo(
    () => ({ theme, toggleTheme, setTheme: applyTheme }),
    [theme, toggleTheme, applyTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/**
 * Inline script injected before paint to set the theme class and avoid a
 * flash of the wrong theme on first load.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('docmind-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;
