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
const HomeView = lazy(() => import("@/pages/hero-page"))
const RoomsView = lazy(() => import("@/pages/discovery-page"))
const PodcastsView = lazy(() => import("@/pages/podcasts-page"))
const LiveStreamView = lazy(() => import("@/pages/room-live-page"))
const ProfileView = lazy(() => import("@/pages/profile-page"))
const GetStartedPage = lazy(() => import("@/pages/get-started-page").then(m => ({ default: m.GetStartedPage })))
const ClaimPage = lazy(() => import("@/pages/claim-page"))
const DocsPage = lazy(() => import("@/pages/docs-page"))

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Developer Documentation */}
          <Route path="/doc" element={<DocsPage />} />

          {/* Public / Onboarding */}
          <Route path="/get-started" element={<GetStartedPage />} />
          <Route path="/claim/:token" element={<MainLayout><ClaimPage /></MainLayout>} />

          {/* Main Application Routes wrapped in MainLayout */}
          <Route path="/" element={<MainLayout><HomeView /></MainLayout>} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/feed" element={<Navigate to="/" replace />} />
          
          <Route path="/rooms" element={<MainLayout><RoomsView /></MainLayout>} />
          <Route path="/room/:id" element={<MainLayout><RoomsView /></MainLayout>} /> {/* In a real app this would be a specific room view */}
          
          <Route path="/podcasts" element={<MainLayout><PodcastsView /></MainLayout>} />
          
          <Route path="/live" element={<MainLayout><LiveStreamView /></MainLayout>} />
          <Route path="/live/:id" element={<MainLayout><LiveStreamView /></MainLayout>} />
          
          <Route path="/profile" element={<MainLayout><ProfileView /></MainLayout>} />
          <Route path="/profile/:id" element={<MainLayout><ProfileView /></MainLayout>} />

          {/* 404 */}
          <Route path="*" element={<MainLayout><NotFoundPage /></MainLayout>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default AppRouter
