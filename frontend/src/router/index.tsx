/**
 * AppRouter: Main application router configuration
 *
 * UX Flow:
 * - Landing page with TikTok-style navigation
 * - Discovery with feed
 * - Profile with context switching
 */

import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Layouts
import { MainLayout } from "@/components/layouts/main-layout";

// Error pages
import { NotFoundPage } from "@/pages/not-found-page";

// Loading component
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-[#D1D1D1]">
    <div className="border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white p-8">
      <div className="mb-4 h-12 w-12 border-[3px] border-black bg-[#6C5CE7] mx-auto animate-pulse"></div>
      <p className="font-mono font-black uppercase">Loading...</p>
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
const ClaimPage = lazy(() =>
  import("@/pages/claim-page").then((m) => ({ default: m.ClaimPage })),
);

/**
 * AppRouter: Main application router
 */
export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Hero/landing page */}
          <Route path="/" element={<HeroPage />} />

          {/* Get started - Onboarding */}
          <Route path="/get-started" element={<GetStartedPage />} />

          {/* Claim page */}
          <Route
            path="/claim/:token"
            element={
              <MainLayout>
                <ClaimPage />
              </MainLayout>
            }
          />

          {/* Feed page - TikTok-style feed with search */}
          <Route path="/feed" element={<DiscoveryPage />} />
          <Route path="/discover" element={<Navigate to="/feed" replace />} />

          {/* Live room */}
          <Route path="/room/:id" element={<RoomLivePage />} />

          {/* Live room (shorthand) */}
          <Route path="/room/:id/live" element={<RoomLivePage />} />

          {/* Episode player */}
          <Route path="/episode/:id" element={<EpisodePlayerPage />} />

          {/* Profile - Context based on route */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />

          {/* 404 Not Found */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRouter;
