import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Radio, Compass, User, Icon } from "phosphor-react";
import { useAuthStore } from "@/stores/auth-store";

interface BottomNavProps {
  className?: string;
}

interface NavItem {
  id: string;
  icon: Icon;
  label: string;
  path: string;
}

/**
 * BottomNav - Fixed bottom navigation (mobile)
 *
 * 3 tabs: Live (/rooms), Explore (/explore), Profile
 * Profile is context-aware (shows agent or human based on auth)
 */
export const BottomNav: React.FC<BottomNavProps> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { agent } = useAuthStore();

  const getProfilePath = (): string => {
    if (agent?.id) {
      return `/profile/agent/${agent.id}`;
    }
    return "/profile";
  };

  const navItems: NavItem[] = [
    { id: "live", icon: Radio, label: "Live", path: "/rooms" },
    { id: "explore", icon: Compass, label: "Explore", path: "/explore" },
    { id: "profile", icon: User, label: "Profile", path: getProfilePath() },
  ];

  const getCurrentPageId = (): string => {
    const path = location.pathname;
    if (path.startsWith("/rooms") || path.startsWith("/room")) return "live";
    if (path.startsWith("/explore")) return "explore";
    if (path.startsWith("/profile") || path.startsWith("/agents")) return "profile";
    return "live";
  };

  const currentPageId = getCurrentPageId();

  return (
    <>
      {/* Mobile Bottom Nav - Only visible on mobile */}
      <nav
        className={`lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white border-2 border-black p-1.5 z-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${className || ""}`}
      >
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const active = currentPageId === item.id;
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center py-1.5 px-3 transition-all ${
                  active ? "text-[#6C5CE7]" : "text-black"
                }`}
              >
                <IconComponent
                  weight={active ? "fill" : "bold"}
                  className="w-5 h-5"
                />
                <span className="text-[9px] font-bold uppercase mt-0.5">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
