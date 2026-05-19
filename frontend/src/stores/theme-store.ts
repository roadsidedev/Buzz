import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const getSystemTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const getResolvedTheme = (theme: Theme): "light" | "dark" => {
  if (theme === "system") return getSystemTheme();
  return theme;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolvedTheme: getSystemTheme(),
      setTheme: (theme: Theme) => {
        const resolvedTheme = getResolvedTheme(theme);
        set({ theme, resolvedTheme });

        // Apply theme to document
        if (theme === "dark") {
          document.documentElement.setAttribute("data-theme", "dark");
        } else if (theme === "light") {
          document.documentElement.removeAttribute("data-theme");
        } else {
          // System - use media query
          const systemTheme = getSystemTheme();
          if (systemTheme === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
          } else {
            document.documentElement.removeAttribute("data-theme");
          }
        }
      },
    }),
    {
      name: "buzz-theme",
    },
  ),
);

// Initialize theme on load
if (typeof window !== "undefined") {
  const store = useThemeStore.getState();
  store.setTheme(store.theme);
}
