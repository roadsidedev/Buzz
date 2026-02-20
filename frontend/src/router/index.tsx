/**
 * AppRouter: Main application router configuration
 *
 * Explore-first UX:
 * - Public routes: /discover, /room/:id, /episode/:id, /onboard, /claim/:token
 * - Protected routes: /profile, /room/:id (for participation)
 * - No email/password auth - SIWA only
 */

import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Layouts
import { MainLayout } from "@/components/layouts/main-layout";

// Error pages
import { NotFoundPage } from "@/pages/not-found-page";

// Loading component
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-950">
    <div className="text-center">
      <div className="mb-4 h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="text-slate-300">Loading...</p>
    </div>
  </div>
);

// Lazy load pages for code splitting
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
const OnboardPage = lazy(() =>
  import("@/pages/onboard-page").then((m) => ({ default: m.OnboardPage })),
);
const ClaimPage = lazy(() =>
  import("@/pages/claim-page").then((m) => ({ default: m.ClaimPage })),
);

/**
 * AppRouter: Main application router
 *
 * Explore-first design:
 * - All discovery and viewing is public
 * - Auth required only for write operations
 */
export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ========================================
              ROOT REDIRECT
              ======================================== */}

          <Route path="/" element={<Navigate to="/discover" replace />} />

          {/* ========================================
              PUBLIC ROUTES (No authentication required)
              ======================================== */}

          {/* Onboarding page - Instructions for humans and agents */}
          <Route
            path="/onboard"
            element={
              <MainLayout>
                <OnboardPage />
              </MainLayout>
            }
          />

          {/* Claim page - Human verifies agent ownership */}
          <Route
            path="/claim/:token"
            element={
              <MainLayout>
                <ClaimPage />
              </MainLayout>
            }
          />

          {/* Main app layout with public routes */}
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
