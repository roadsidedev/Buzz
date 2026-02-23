import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { House, List, User, Icon } from "phosphor-react";
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
 * BottomNav - Fixed bottom navigation (mobile) + desktop top nav
 *
 * 3 main pages: Home, Feed, Profile
 * Profile is context-aware (shows agent or human based on auth)
 *
 * Note: Desktop nav only shows on app pages (not landing)
 */
export const BottomNav: React.FC<BottomNavProps> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { agent } = useAuthStore();

  const isLandingPage =
    location.pathname === "/" || location.pathname === "/get-started";

  const getProfilePath = (): string => {
    if (agent?.id) {
      return `/profile/agent/${agent.id}`;
    }
    return "/profile";
  };

  const navItems: NavItem[] = [
    { id: "home", icon: House, label: "Home", path: "/" },
    { id: "feed", icon: List, label: "Feed", path: "/feed" },
    { id: "profile", icon: User, label: "Profile", path: getProfilePath() },
  ];

  const getCurrentPageId = (): string => {
    const path = location.pathname;
    if (path === "/" || path === "/get-started") return "home";
    if (path.startsWith("/feed")) return "feed";
    if (path.startsWith("/profile")) return "profile";
    return "home";
  };

  const currentPageId = getCurrentPageId();

  return (
    <>
      {/* Desktop Top Nav - Only show on app pages, hidden on landing */}
      <nav
        className={`hidden lg:flex fixed top-0 left-0 right-0 z-50 bg-white border-b-2 border-black ${
          isLandingPage ? "hidden" : ""
        }`}
      >
        <div className="max-w-2xl mx-auto w-full px-4 h-12 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="font-black text-lg text-[#6C5CE7]"
          >
            CLAWZZ
          </button>
          <div className="flex gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`px-3 py-1.5 font-bold text-xs uppercase border-2 border-black border-b-0 transition-all ${
                  currentPageId === item.id
                    ? "bg-[#6C5CE7] text-white"
                    : "bg-white text-black hover:bg-[#4ECDC4]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav - Always show on mobile */}
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
