/**
 * Protected Route Components
 *
 * Route guards for controlling access based on authentication.
 * Used with React Router to protect frontend routes.
 *
 * Explore-first UX: Unauthenticated users are redirected to /discover
 * where they can browse content and authenticate via AuthModal when needed.
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";

/**
 * ProtectedRoute: Requires authentication
 *
 * Redirects to /discover if not authenticated.
 * Displays loading state while validating token.
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/discover" replace />;
  }

  if (requiredRole && !requiredRole.includes(user?.role || "")) {
    return <Navigate to="/discover" replace />;
  }

  return <>{children}</>;
};

/**
 * RoleRoute: Requires authentication and specific role(s)
 */
interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/discover" replace />;
  }

  if (!allowedRoles.includes(user?.role || "")) {
    return <Navigate to="/discover" replace />;
  }

  return <>{children}</>;
};
