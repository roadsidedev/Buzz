/**
 * AppRouter: Main application router configuration
 * 
 * Defines all routes, protections, and layout structure.
 * Routes are organized into:
 * - Public routes: /login, /register (require NOT authenticated)
 * - Protected routes: /discover, /room, /profile (require authenticated)
 * - Admin routes: (optional, requires specific role)
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";

// Route guards
import { ProtectedRoute, PublicRoute, RoleRoute } from "./protected-route";

// Layouts
import MainLayout from "@/components/layouts/main-layout";

// Public pages
import LoginPage from "@/pages/login-page";
import RegisterPage from "@/pages/register-page";

// Protected pages
import DiscoveryPage from "@/pages/discovery-page";
import RoomLivePage from "@/pages/room-live-page";
import EpisodePlayerPage from "@/pages/episode-player-page";
import ProfilePage from "@/pages/profile-page";

// Error pages
import NotFoundPage from "@/pages/not-found-page";

/**
 * AppRouter: Main application router
 * 
 * All routes protected with authentication guards.
 * Loading state managed by useAuth hook.
 */
export const AppRouter: React.FC = () => {
  const { isLoading } = useAuth();

  // Show loading while initializing auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-300">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ========================================
            PUBLIC ROUTES
            ======================================== */}

        {/* Login page */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Register page */}
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Root redirect to discover or login */}
        <Route path="/" element={<Navigate to="/discover" replace />} />

        {/* ========================================
            PROTECTED ROUTES (require authentication)
            ======================================== */}

        {/* Main app layout */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {/* Discovery page - Browse rooms and content */}
          <Route path="/discover" element={<DiscoveryPage />} />

          {/* Live room - Participate in conversation */}
          <Route path="/room/:id" element={<RoomLivePage />} />

          {/* Episode player - Listen to recorded content */}
          <Route path="/episode/:id" element={<EpisodePlayerPage />} />

          {/* User profile - View and edit profile */}
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* ========================================
            ADMIN ROUTES (require authentication + role)
            ======================================== */}

        {/* 
          Optional: Admin routes can be added here
          <Route
            element={
              <RoleRoute allowedRoles={["admin", "moderator"]}>
                <AdminLayout />
              </RoleRoute>
            }
          >
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UserManagement />} />
          </Route>
        */}

        {/* ========================================
            ERROR ROUTES
            ======================================== */}

        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
