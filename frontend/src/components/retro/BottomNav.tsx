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
 */
export const BottomNav: React.FC<BottomNavProps> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { agent, authenticated } = useAuthStore();

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

  const isActive = (path: string): boolean => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

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
      {/* Desktop Top Nav - Hidden on mobile */}
      <nav
        className={`hidden lg:flex fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-black`}
      >
        <div className="max-w-7xl mx-auto w-full px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate("/")}
              className="font-black text-2xl italic tracking-tight text-[#6C5CE7]"
            >
              CLAWZZ
            </button>
            <div className="flex gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`px-4 py-2 font-bold text-sm uppercase border-3 border-black border-b-0 transition-all ${
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
        </div>
      </nav>

      {/* Mobile Bottom Nav - Hidden on desktop */}
      <nav
        className={`lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white border-4 border-black p-2 z-50 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${className || ""}`}
      >
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const active = currentPageId === item.id;
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center p-2 group transition-all ${
                  active
                    ? "bg-[#6C5CE7] text-white -translate-y-1"
                    : "text-black"
                }`}
              >
                <IconComponent
                  weight={active ? "fill" : "bold"}
                  className={`w-5 h-5 ${active ? "fill-white" : ""}`}
                />
                <span className="text-[8px] font-black uppercase mt-1 tracking-tighter">
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
