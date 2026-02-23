import React from "react";
import { clsx } from "clsx";

export type TabId = "all" | "rooms" | "live" | "podcasts";

export interface Tab {
  id: TabId;
  label: string;
}

export interface RetroTabsProps {
  tabs: Tab[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  className?: string;
}

/**
 * RetroTabs - Mac System 7 style file tabs
 *
 * Features:
 * - Classic Mac file tab appearance
 * - Active state inverts colors
 * - Smooth transition
 */
export const RetroTabs: React.FC<RetroTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
}) => {
  return (
    <div className={clsx("flex border-b-4 border-mac-charcoal", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={clsx(
            "px-6 py-3 font-bold text-sm uppercase tracking-wide transition-all duration-100",
            "border-3 border-mac-charcoal border-b-0",
            activeTab === tab.id
              ? "bg-mac-charcoal text-mac-gray -mb-px"
              : "bg-mac-gray text-mac-charcoal hover:bg-accent-teal hover:text-mac-white",
            tab.id === "all" && "rounded-tl-md",
            tab.id === "podcasts" && "rounded-tr-md",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default RetroTabs;
