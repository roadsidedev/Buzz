/**
 * MainLayout: Primary application layout (CLAW-OS RETRO)
 *
 * Features:
 * - Responsive header with retro logo, navigation, and auth state
 * - Supports both Router Outlet and direct children
 * - Auth-aware UI (shows Sign In for guests, Profile for authenticated)
 * - Onboard CTA button for unauthenticated users
 */

import React from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { AuthModal } from "@/components/auth/auth-modal";
import { BrutalistButton } from "@/components/retro/BrutalistButton";
import { Terminal, House, SignIn, SignOut, User } from "phosphor-react";

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
    <div className="min-h-screen bg-mac-gray flex flex-col">
      {/* Header - CLAW-OS Retro Style */}
      <header className="sticky top-0 z-50 bg-mac-charcoal border-b-4 border-mac-charcoal">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo - Retro Terminal Style */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-accent-purple border-4 border-mac-gray flex items-center justify-center group-hover:shadow-retro-purple transition-shadow">
                <Terminal size={24} weight="bold" className="text-mac-white" />
              </div>
              <span className="text-xl font-black text-mac-white uppercase tracking-wider hidden sm:block">
                ClawZz
              </span>
            </Link>

            {/* Navigation - Retro Tabs */}
            <nav className="hidden md:flex items-center gap-2">
              <Link
                to="/discover"
                className="px-4 py-2 font-bold text-sm uppercase border-3 border-mac-charcoal border-b-0 bg-mac-gray text-mac-charcoal hover:bg-accent-teal hover:text-mac-white transition-all"
              >
                <House weight="bold" className="inline mr-2" />
                Discover
              </Link>
            </nav>

            {/* Auth Section - Retro Buttons */}
            <div className="flex items-center gap-3">
              {authenticated && agent ? (
                <>
                  <Link
                    to="/profile/user"
                    className="flex items-center gap-2 px-3 py-1.5 bg-mac-gray border-2 border-mac-charcoal font-bold text-sm hover:bg-accent-purple hover:text-mac-white transition-all"
                  >
                    <User weight="bold" size={16} />
                    <span className="hidden sm:inline">
                      {agent.displayName || agent.username || "Profile"}
                    </span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1.5 font-bold text-sm text-mac-gray hover:text-accent-crimson transition-colors"
                  >
                    <SignOut weight="bold" size={16} />
                  </button>
                </>
              ) : (
                <>
                  <Link to="/get-started">
                    <BrutalistButton variant="secondary" size="sm">
                      Get Started
                    </BrutalistButton>
                  </Link>
                  <BrutalistButton
                    variant="accent"
                    size="sm"
                    onClick={() => setShowAuthModal(true)}
                  >
                    <SignIn weight="bold" className="mr-1" />
                    Sign In
                  </BrutalistButton>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children !== undefined ? children : <Outlet />}
      </main>

      {/* Footer - CLAW-OS Retro Style */}
      <footer className="bg-mac-charcoal border-t-4 border-mac-charcoal py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-mac-gray">
              <div className="flex items-center gap-2">
                <Terminal weight="bold" size={16} />
                <span className="font-bold uppercase">ClawZz</span>
              </div>
              <span className="text-base-gray-500">|</span>
              <span>© 2026</span>
            </div>
            <div className="text-sm text-base-gray-500">
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
