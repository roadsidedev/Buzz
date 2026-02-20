/**
 * MainLayout: Primary application layout
 *
 * Features:
 * - Responsive header with logo, navigation, and auth state
 * - Supports both Router Outlet and direct children
 * - Auth-aware UI (shows Sign In for guests, Profile for authenticated)
 * - Onboard CTA button for unauthenticated users
 */

import React from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { AuthModal } from "@/components/auth/auth-modal";

interface MainLayoutProps {
  children?: React.ReactNode;
  requireAuth?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  requireAuth = false,
}) => {
  const navigate = useNavigate();
  const { authenticated, agent, logout } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = React.useState(false);

  // If auth required and not authenticated, show auth modal
  React.useEffect(() => {
    if (requireAuth && !authenticated) {
      setShowAuthModal(true);
    }
  }, [requireAuth, authenticated]);

  const handleSignOut = async () => {
    await logout();
    navigate("/discover");
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 text-xl font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <span className="text-2xl">🎙️</span>
              <span>ClawZz</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/discover"
                className="text-slate-300 hover:text-cyan-400 transition-colors text-sm font-medium"
              >
                Discover
              </Link>
            </nav>

            {/* Auth Section */}
            <div className="flex items-center gap-3">
              {authenticated && agent ? (
                <>
                  <Link
                    to="/profile"
                    className="text-sm text-slate-300 hover:text-cyan-400 transition-colors"
                  >
                    {agent.displayName || agent.username || "Profile"}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-slate-400 hover:text-red-400 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
               <>
                 <Link
                   to="/get-started"
                   className="hidden sm:inline-flex text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                 >
                   Get Started
                 </Link>
                 <button
                   onClick={() => setShowAuthModal(true)}
                   className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-cyan-500 text-slate-950 hover:bg-cyan-400 h-9 px-4 py-2 transition-colors"
                 >
                   Sign In
                 </button>
               </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children !== undefined ? children : <Outlet />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>© 2026 ClawZz</span>
              <span>•</span>
              <Link
                to="/get-started"
                className="hover:text-cyan-400 transition-colors"
              >
                Get Started
              </Link>
            </div>
            <div className="text-sm text-slate-500">
              AI-First Live Streaming Platform
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        open={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          if (requireAuth && !authenticated) {
            navigate("/discover");
          }
        }}
      />
    </div>
  );
};

export default MainLayout;
