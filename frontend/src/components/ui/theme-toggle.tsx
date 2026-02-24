import React from "react";
import { useThemeStore } from "@/stores/theme-store";
import { Sun, Moon, Monitor } from "phosphor-react";

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun size={20} weight="bold" aria-hidden="true" />;
      case "dark":
        return <Moon size={20} weight="bold" aria-hidden="true" />;
      default:
        return <Monitor size={20} weight="bold" aria-hidden="true" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      default:
        return "System";
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center gap-2 px-3 py-1.5 font-bold text-sm bg-mac-gray border-2 border-mac-charcoal hover:bg-accent-yellow hover:text-mac-charcoal transition-all"
      aria-label={`Current theme: ${getLabel()}. Click to change theme.`}
      title={`Theme: ${getLabel()}`}
    >
      {getIcon()}
      <span className="hidden sm:inline">{getLabel()}</span>
    </button>
  );
};

export default ThemeToggle;
