/**
 * AuthStore: Global authentication state management
 * 
 * Manages:
 * - User authentication state
 * - Token storage and refresh
 * - Login/register/logout operations
 * - Token validation on app load
 * 
 * Persists tokens to localStorage for session recovery.
 */

import React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AuthUser,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
} from "@/types/auth";
import { apiClient } from "@/services/api-client";
import logger from "@/utils/logger";

/**
 * AuthStore: Global auth state
 */
interface AuthStore {
  // State
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  validateToken: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  clearError: () => void;
  setError: (error: string) => void;
}

/**
 * Create Zustand store with persistence
 * 
 * Persists to localStorage with key "clawhouse-auth"
 * Only persists tokens and user, not loading state
 */
export const useAuth = create<AuthStore>()(
  persist(
    (set, get) => ({
      // ========================================
      // Initial State
      // ========================================
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true, // Start as loading to validate token on mount
      error: null,

      // ========================================
      // Actions
      // ========================================

      /**
       * Login user with email and password
       * 
       * Process:
       * 1. Validate email and password provided
       * 2. Call POST /auth/login
       * 3. Store tokens and user in state
       * 4. Inject token into API client
       * 5. Redirect on success (handled by component)
       * 
       * @throws Error if login fails (caught and stored in error state)
       */
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<AuthResponse>(
            "/auth/login",
            { email, password }
          );

          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Inject token into future API requests
          apiClient.setAuthToken(response.accessToken);

          logger.info("User logged in", { email: response.user.email });
        } catch (err: any) {
          const errorMessage =
            err.response?.data?.error || "Login failed";
          set({
            error: errorMessage,
            isLoading: false,
            isAuthenticated: false,
          });
          logger.error("Login failed", { error: errorMessage });
          throw err;
        }
      },

      /**
       * Register new user
       * 
       * Process:
       * 1. Validate all fields provided
       * 2. Call POST /auth/register
       * 3. Store tokens and user in state
       * 4. Inject token into API client
       * 5. Redirect on success (handled by component)
       * 
       * @throws Error if registration fails
       */
      register: async (data: RegisterRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<AuthResponse>(
            "/auth/register",
            data
          );

          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Inject token into future API requests
          apiClient.setAuthToken(response.accessToken);

          logger.info("User registered", { email: response.user.email });
        } catch (err: any) {
          const errorMessage =
            err.response?.data?.error || "Registration failed";
          set({
            error: errorMessage,
            isLoading: false,
          });
          logger.error("Registration failed", { error: errorMessage });
          throw err;
        }
      },

      /**
       * Logout user
       * 
       * Clears all auth state and tokens.
       * Does not make API call (stateless logout).
       */
      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
        apiClient.clearAuthToken();
        logger.info("User logged out");
      },

      /**
       * Validate token on app load
       * 
       * Process:
       * 1. Check if accessToken in localStorage
       * 2. If found, inject into API client
       * 3. Call GET /auth/validate to verify
       * 4. If valid, mark as authenticated
       * 5. If invalid/expired, try to refresh
       * 6. If refresh fails, logout
       * 
       * Called once on app initialization
       */
      validateToken: async () => {
        const { accessToken, refreshAccessToken } = get();

        // No token found - not authenticated
        if (!accessToken) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          // Inject token for this request
          apiClient.setAuthToken(accessToken);

          // Verify token is still valid
          const response = await apiClient.get<{ user: AuthUser }>(
            "/auth/validate"
          );

          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });

          logger.info("Token validated on app load", {
            userId: response.user.id,
          });
        } catch (err) {
          // Token might be expired - try to refresh
          logger.warn("Token validation failed, attempting refresh", {
            error: err,
          });

          const refreshed = await refreshAccessToken();

          if (!refreshed) {
            // Refresh failed - clear auth state
            set({
              user: null,
              accessToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        }
      },

      /**
       * Refresh access token using refresh token
       * 
       * Process:
       * 1. Check if refreshToken available
       * 2. Call POST /auth/refresh
       * 3. Store new token pair
       * 4. Update API client token
       * 5. Return success status
       * 
       * Called when access token expires or validation fails.
       * 
       * @returns True if refresh successful, false otherwise
       */
      refreshAccessToken: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          return false;
        }

        try {
          const response = await apiClient.post<AuthResponse>(
            "/auth/refresh",
            { refreshToken }
          );

          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            user: response.user,
            isAuthenticated: true,
          });

          // Update API client token
          apiClient.setAuthToken(response.accessToken);

          logger.info("Token refreshed successfully");
          return true;
        } catch (err) {
          // Refresh failed - clear auth state
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          logger.error("Token refresh failed", { error: err });
          return false;
        }
      },

      /**
       * Clear error message
       * 
       * Called when user dismisses error or starts new action
       */
      clearError: () => set({ error: null }),

      /**
       * Set error message
       * 
       * Called when operation fails
       */
      setError: (error: string) => set({ error }),
    }),
    {
      name: "clawhouse-auth", // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);

/**
 * Hook to initialize auth on app load
 * 
 * Call this once in App.tsx useEffect to validate token
 * and recover session from localStorage.
 * 
 * Usage:
 * ```tsx
 * function App() {
 *   useInitializeAuth();
 *   return <AppRouter />;
 * }
 * ```
 */
export const useInitializeAuth = () => {
  const validateToken = useAuth((state) => state.validateToken);

  React.useEffect(() => {
    validateToken();
  }, [validateToken]);
};
