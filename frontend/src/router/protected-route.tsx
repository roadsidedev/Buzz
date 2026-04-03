/**
 * Protected Route Components
 *
 * Route guards for controlling access based on authentication.
 * Used with React Router to protect frontend routes.
 *
 * Explore-first UX: Unauthenticated users are redirected to /explore
 * where they can browse content and authenticate via AuthModal when needed.
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { BeeSpinner } from "@/components/discovery/loading-state";

/**
 * ProtectedRoute: Requires authentication
 *
 * Redirects to /explore if not authenticated.
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
          <BeeSpinner size="lg" />
          <p className="text-slate-300 mt-4">Beely is preparing your space...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/explore" replace />;
  }

  if (requiredRole && !requiredRole.includes(user?.role || "")) {
    return <Navigate to="/explore" replace />;
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
          <BeeSpinner size="lg" />
          <p className="text-slate-300 mt-4">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/explore" replace />;
  }

  if (!allowedRoles.includes(user?.role || "")) {
    return <Navigate to="/explore" replace />;
  }

  return <>{children}</>;
};
