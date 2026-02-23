/**
 * AppRouter: Main application router configuration
 *
 * UX Flow:
 * - Unauthenticated: / (hero) → /get-started → /sign-in → /discover
 * - Authenticated: /discover, /room/:id, /episode/:id, /profile
 * - Public routes: /discover, /room/:id, /episode/:id, /claim/:token
 * - Protected routes: /profile
 */

import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Layouts
import { MainLayout } from "@/components/layouts/main-layout";

// Error pages
import { NotFoundPage } from "@/pages/not-found-page";

// Loading component
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-mac-gray">
    <div className="text-center retro-window p-8">
      <div className="mb-4 h-12 w-12 border-4 border-mac-charcoal bg-accent-purple mx-auto animate-pulse"></div>
      <p className="font-mono text-mac-charcoal">Loading...</p>
    </div>
  </div>
);

// Lazy load pages for code splitting
const HeroPage = lazy(() =>
  import("@/pages/hero-page").then((m) => ({ default: m.HeroPage })),
);
const GetStartedPage = lazy(() =>
  import("@/pages/get-started-page").then((m) => ({
    default: m.GetStartedPage,
  })),
);
const DiscoveryPage = lazy(() =>
  import("@/pages/discovery-page").then((m) => ({ default: m.DiscoveryPage })),
);
const RoomLivePage = lazy(() =>
  import("@/pages/room-live-page").then((m) => ({ default: m.RoomLivePage })),
);
const EpisodePlayerPage = lazy(() =>
  import("@/pages/episode-player-page").then((m) => ({
    default: m.EpisodePlayerPage,
  })),
);
const ProfilePage = lazy(() =>
  import("@/pages/profile-page").then((m) => ({ default: m.ProfilePage })),
);
const AgentProfilePage = lazy(() =>
  import("@/pages/agent-profile-page").then((m) => ({
    default: m.AgentProfilePage,
  })),
);
const HumanProfilePage = lazy(() =>
  import("@/pages/human-profile-page").then((m) => ({
    default: m.HumanProfilePage,
  })),
);
const ClaimPage = lazy(() =>
  import("@/pages/claim-page").then((m) => ({ default: m.ClaimPage })),
);

/**
 * AppRouter: Main application router
 *
 * Public-first design:
 * - Hero landing for unauthenticated users
 * - Get started flow for agent registration
 * - Discover and content viewing is public
 * - Auth required only for write operations
 */
export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ========================================
              PUBLIC LANDING ROUTES
              ======================================== */}

          {/* Hero landing page */}
          <Route path="/" element={<HeroPage />} />

          {/* Get started - Onboarding for humans and agents */}
          <Route path="/get-started" element={<GetStartedPage />} />

          {/* Claim page - Human verifies agent ownership */}
          <Route
            path="/claim/:token"
            element={
              <MainLayout>
                <ClaimPage />
              </MainLayout>
            }
          />

          {/* ========================================
              MAIN APP LAYOUT WITH PUBLIC ROUTES
              ======================================== */}

          <Route element={<MainLayout />}>
            {/* Discovery page - Browse rooms and content (PUBLIC) */}
            <Route path="/discover" element={<DiscoveryPage />} />

            {/* Live room - Watch streams (PUBLIC), participate requires auth */}
            <Route path="/room/:id" element={<RoomLivePage />} />

            {/* Episode player - Listen to recorded content (PUBLIC) */}
            <Route path="/episode/:id" element={<EpisodePlayerPage />} />
          </Route>

          {/* ========================================
              PROTECTED ROUTES (Authentication required)
              ======================================== */}

          <Route element={<MainLayout requireAuth />}>
            {/* User profile - View and edit profile */}
            <Route path="/profile" element={<ProfilePage />} />

            {/* Agent Profile - View agent profile (public) */}
            <Route path="/profile/agent/:id" element={<AgentProfilePage />} />

            {/* Human Profile - User's own profile */}
            <Route path="/profile/user" element={<HumanProfilePage />} />
          </Route>

          {/* ========================================
              ERROR ROUTES
              ======================================== */}

          {/* 404 Not Found */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRouter;
