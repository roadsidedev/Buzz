import React, { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

// Layouts
import { MainLayout } from "@/components/layouts/main-layout"
import { BeeSpinner } from "@/components/discovery/loading-state"

// Error pages
import { NotFoundPage } from "@/pages/not-found-page"

// Loading component
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-mac-gray">
    <div className="border-2 border-mac-charcoal shadow-retro-sm bg-mac-white p-8 text-center flex flex-col items-center">
      <BeeSpinner size="lg" className="mb-4" />
      <p className="font-sans font-bold uppercase tracking-widest text-mac-charcoal">Loading Interface...</p>
    </div>
  </div>
)

// View Components (Lazy Loaded)
const LiveView = lazy(() => import("@/pages/discovery-page"))
const ExploreView = lazy(() => import("@/pages/explore-page"))
const RoomDetailsView = lazy(() => import("@/pages/room-page"))
const RoomLiveView = lazy(() => import("@/pages/room-live-page"))
const ProfileView = lazy(() => import("@/pages/profile-page"))
const OnboardingView = lazy(() => import("@/pages/get-started-page"))
const ClaimPage = lazy(() => import("@/pages/claim-page"))
const DocsPage = lazy(() => import("@/pages/docs-page"))
const NotFoundView = lazy(() => import("@/pages/not-found-page"))
const AgentProfilePage = lazy(() => import("@/pages/agent-profile-page"))

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Developer Documentation */}
          <Route path="/doc" element={<DocsPage />} />

          {/* Public / Onboarding */}
          <Route path="/get-started" element={<OnboardingView />} />
          <Route path="/claim/:token" element={<MainLayout><ClaimPage /></MainLayout>} />

          {/* Root redirects to Live discovery */}
          <Route path="/" element={<Navigate to="/rooms" replace />} />
          <Route path="/home" element={<Navigate to="/rooms" replace />} />
          <Route path="/feed" element={<Navigate to="/rooms" replace />} />
          <Route path="/trending" element={<Navigate to="/rooms" replace />} />

          {/* Podcast routes removed — extracted to standalone product */}
          <Route path="/podcasts" element={<Navigate to="/rooms" replace />} />
          <Route path="/podcasts/:id" element={<Navigate to="/rooms" replace />} />

          {/* Search redirects to Explore */}
          <Route path="/search" element={<Navigate to="/explore" replace />} />

          {/* Main Application Routes */}
          <Route path="/rooms" element={<MainLayout><LiveView /></MainLayout>} />
          <Route path="/room/:id" element={<MainLayout><RoomDetailsView /></MainLayout>} />
          <Route path="/room/:id/live" element={<MainLayout><RoomLiveView /></MainLayout>} />

          <Route path="/explore" element={<MainLayout><ExploreView /></MainLayout>} />

          <Route path="/live" element={<Navigate to="/rooms" replace />} />
          <Route path="/live/:id" element={<Navigate to="/rooms" replace />} />

          <Route path="/profile" element={<MainLayout><ProfileView /></MainLayout>} />
          <Route path="/profile/:id" element={<MainLayout><ProfileView /></MainLayout>} />

          {/* Agent Public Profile */}
          <Route path="/agents/:id" element={<MainLayout><AgentProfilePage /></MainLayout>} />

          {/* 404 */}
          <Route path="*" element={<MainLayout><NotFoundPage /></MainLayout>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default AppRouter
