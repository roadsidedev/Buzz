import React, { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

// Layouts
import { MainLayout } from "@/components/layouts/main-layout"

// Error pages
import { NotFoundPage } from "@/pages/not-found-page"

// Loading component
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-mac-gray">
    <div className="border-2 border-mac-charcoal shadow-retro-sm bg-mac-white p-8 text-center flex flex-col items-center">
      <div className="mb-4 h-12 w-12 border-2 border-mac-charcoal bg-accent-purple animate-spin"></div>
      <p className="font-sans font-bold uppercase tracking-widest text-mac-charcoal">Loading Interface...</p>
    </div>
  </div>
)

// View Components (Lazy Loaded)
const HomeView = lazy(() => import("@/pages/home-page"))
const RoomsView = lazy(() => import("@/pages/discovery-page"))
const RoomDetailsView = lazy(() => import("@/pages/room-page"))
const RoomLiveView = lazy(() => import("@/pages/room-live-page"))
const PodcastsView = lazy(() => import("@/pages/podcasts-page"))
const EpisodePlayerPage = lazy(() => import("@/pages/episode-player-page").then(m => ({ default: m.EpisodePlayerPage })))
const LiveFeedView = lazy(() => import("@/pages/live-feed-page"))
const ProfileView = lazy(() => import("@/pages/profile-page"))
const OnboardingView = lazy(() => import("@/pages/get-started-page"))
const ClaimPage = lazy(() => import("@/pages/claim-page"))
const DocsPage = lazy(() => import("@/pages/docs-page"))
const NotFoundView = lazy(() => import("@/pages/not-found-page"))
const AgentProfilePage = lazy(() => import("@/pages/agent-profile-page"))
const SearchPage = lazy(() => import("@/pages/search-page"))

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

          {/* Main Application Routes wrapped in MainLayout */}
          <Route path="/" element={<MainLayout><HomeView /></MainLayout>} />
          <Route path="/home" element={<MainLayout><HomeView /></MainLayout>} />
          <Route path="/feed" element={<MainLayout><HomeView /></MainLayout>} />
          <Route path="/trending" element={<MainLayout><HomeView /></MainLayout>} />
          
          <Route path="/rooms" element={<MainLayout><RoomsView /></MainLayout>} />
          <Route path="/room/:id" element={<MainLayout><RoomDetailsView /></MainLayout>} />
          <Route path="/room/:id/live" element={<MainLayout><RoomLiveView /></MainLayout>} />
          
          <Route path="/podcasts" element={<MainLayout><PodcastsView /></MainLayout>} />
          <Route path="/podcasts/:id" element={<MainLayout><EpisodePlayerPage /></MainLayout>} />
          
          <Route path="/live" element={<MainLayout><LiveFeedView /></MainLayout>} />
          <Route path="/live/:id" element={<MainLayout><LiveFeedView /></MainLayout>} />
          
          <Route path="/profile" element={<MainLayout><ProfileView /></MainLayout>} />
          <Route path="/profile/:id" element={<MainLayout><ProfileView /></MainLayout>} />

          {/* Agent Public Profile (used by /agents/:uuid links) */}
          <Route path="/agents/:id" element={<MainLayout><AgentProfilePage /></MainLayout>} />

          {/* Search Result Page */}
          <Route path="/search" element={<MainLayout><SearchPage /></MainLayout>} />

          {/* 404 */}
          <Route path="*" element={<MainLayout><NotFoundPage /></MainLayout>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default AppRouter
