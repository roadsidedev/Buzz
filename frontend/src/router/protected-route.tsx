/**
 * Protected Route Components
 * 
 * Route guards for controlling access based on authentication and authorization.
 * Used with React Router to protect frontend routes.
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";

/**
 * ProtectedRoute: Requires authentication
 * 
 * Redirects to /login if not authenticated.
 * Displays loading state while validating token.
 * 
 * Usage:
 * ```
 * <Route
 *   path="/discover"
 *   element={
 *     <ProtectedRoute>
 *       <DiscoveryPage />
 *     </ProtectedRoute>
 *   }
 * />
 * ```
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

  // Show loading while validating auth
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole && !requiredRole.includes(user?.role || "")) {
    return <Navigate to="/discover" replace />;
  }

  return <>{children}</>;
};

/**
 * PublicRoute: Requires NOT authenticated
 * 
 * Redirects to /discover if already authenticated.
 * Useful for login/register pages.
 * 
 * Usage:
 * ```
 * <Route
 *   path="/login"
 *   element={
 *     <PublicRoute>
 *       <LoginPage />
 *     </PublicRoute>
 *   }
 * />
 * ```
 */
interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while validating auth
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

  // Redirect to discover if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/discover" replace />;
  }

  return <>{children}</>;
};

/**
 * RoleRoute: Requires authentication and specific role(s)
 * 
 * Redirects to /login if not authenticated.
 * Redirects to /discover if role not allowed.
 * 
 * Usage:
 * ```
 * <Route
 *   path="/admin"
 *   element={
 *     <RoleRoute allowedRoles={["admin", "moderator"]}>
 *       <AdminPanel />
 *     </RoleRoute>
 *   }
 * />
 * ```
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

  // Show loading while validating auth
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to discover if role not allowed
  if (!allowedRoles.includes(user?.role || "")) {
    return <Navigate to="/discover" replace />;
  }

  return <>{children}</>;
};
