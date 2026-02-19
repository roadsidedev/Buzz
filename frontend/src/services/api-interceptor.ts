/**
 * API Interceptor Service
 *
 * Handles:
 * - Automatic token refresh before expiry
 * - 401 response handling (token expired)
 * - Token injection into all requests
 * - Error response standardization
 * - Preventing multiple simultaneous refresh calls
 *
 * Integration with Zustand auth store for state management.
 */

import { useAuthStore } from "@/stores/auth-store";
import { logger } from "@/utils/logger";

/**
 * Token expiry buffer (refresh 2 minutes before expiry)
 * Prevents "token expired" errors during active use
 */
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

/**
 * Stores the refresh promise to prevent multiple simultaneous refresh attempts
 * This is a "thundering herd" prevention mechanism
 */
let refreshPromise: Promise<boolean> | null = null;

/**
 * Stores timeout ID for scheduled refresh
 * Can be cancelled if user logs out
 */
let refreshTimeoutId: NodeJS.Timeout | null = null;

/**
 * Intercepts API responses and handles 401 Unauthorized errors
 *
 * When a 401 is detected:
 * 1. Attempt to refresh access token using refresh token
 * 2. If refresh succeeds: Retry original request with new token
 * 3. If refresh fails: Clear auth state and redirect to login
 *
 * @param response - The original fetch response
 * @param retryFn - Function to retry the original request
 * @returns The retried response or original if not 401
 *
 * @example
 * ```typescript
 * const response = await fetch(url, options);
 * const finalResponse = await handleApiResponse(response, () =>
 *   fetch(url, options)
 * );
 * ```
 */
export async function handleApiResponse(
  response: Response,
  retryFn: () => Promise<Response>
): Promise<Response> {
  // Only handle 401 Unauthorized
  if (response.status !== 401) {
    return response;
  }

  logger.warn("Received 401 Unauthorized, attempting token refresh");

  // Prevent multiple simultaneous refresh attempts
  // If another request is already refreshing, wait for it
  if (!refreshPromise) {
    const { refreshAccessToken } = useAuthStore.getState();
    refreshPromise = refreshAccessToken();
  }

  const success = await refreshPromise;
  refreshPromise = null;

  if (success) {
    // Token refreshed successfully - retry original request with new token
    logger.info("Token refreshed, retrying original request");
    return retryFn();
  } else {
    // Refresh failed - clear auth state and redirect to login
    logger.error("Token refresh failed, logging out and redirecting to login");
    const { logout } = useAuthStore.getState();
    logout();

    // Redirect to login page (will happen on next component render)
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }

    return response;
  }
}

/**
 * Schedule automatic token refresh before expiry
 *
 * Calculates time until expiry, subtracts buffer, then schedules
 * a token refresh via POST /auth/refresh.
 *
 * This prevents "token expired" errors during normal usage.
 *
 * @param expiresIn - Token expiry time in seconds
 * @returns Function to cancel the scheduled refresh
 *
 * @example
 * ```typescript
 * // In login action:
 * const cancel = scheduleTokenRefresh(response.expiresIn);
 *
 * // Token will refresh 2 minutes before expiry
 * // On logout, call cancel() to clear the timer
 * ```
 */
export function scheduleTokenRefresh(expiresIn: number): () => void {
  // Cancel any existing timer
  if (refreshTimeoutId !== null) {
    clearTimeout(refreshTimeoutId);
  }

  // Calculate time until refresh (expiry - buffer)
  const timeUntilRefresh = expiresIn * 1000 - TOKEN_REFRESH_BUFFER_MS;

  if (timeUntilRefresh <= 0) {
    logger.warn("Token expires too soon, refreshing immediately", {
      expiresInSeconds: expiresIn,
    });

    // Refresh immediately
    const { refreshAccessToken } = useAuthStore.getState();
    refreshAccessToken();

    return () => {}; // No timer to cancel
  }

  logger.info("Scheduling token refresh", {
    expiresInSeconds: expiresIn,
    refreshInSeconds: Math.round(timeUntilRefresh / 1000),
  });

  // Schedule refresh before expiry
  refreshTimeoutId = setTimeout(async () => {
    logger.info("Token refresh timer triggered");

    const { refreshAccessToken } = useAuthStore.getState();
    const success = await refreshAccessToken();

    if (success) {
      // Refresh successful - reschedule for next token
      // Typically 1 hour for new access tokens
      logger.info("Token refreshed successfully, rescheduling next refresh");
      scheduleTokenRefresh(3600);
    } else {
      // Refresh failed - user will be logged out on next 401
      logger.error(
        "Scheduled token refresh failed, user will be logged out on next request"
      );
    }
  }, timeUntilRefresh);

  // Return cancel function for cleanup
  return () => {
    if (refreshTimeoutId !== null) {
      clearTimeout(refreshTimeoutId);
      refreshTimeoutId = null;
      logger.info("Cancelled scheduled token refresh");
    }
  };
}

/**
 * Cancel any pending token refresh
 *
 * Called on logout to clean up timers
 */
export function cancelTokenRefresh(): void {
  if (refreshTimeoutId !== null) {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
    logger.info("Token refresh timer cancelled");
  }
}

/**
 * Global error handler for API errors
 *
 * Transforms fetch/network errors into consistent format
 *
 * @param error - Error from fetch or processing
 * @param context - Additional context (endpoint, method, etc.)
 * @returns Structured error object
 */
export function handleApiError(
  error: unknown,
  context: Record<string, unknown> = {}
): {
  message: string;
  code: string;
  statusCode: number;
  context: Record<string, unknown>;
} {
  if (error instanceof TypeError) {
    // Network error
    return {
      message: "Network error - check your connection",
      code: "NETWORK_ERROR",
      statusCode: 0,
      context,
    };
  }

  if (error instanceof SyntaxError) {
    // JSON parse error
    return {
      message: "Invalid server response",
      code: "INVALID_RESPONSE",
      statusCode: 500,
      context,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: "UNKNOWN_ERROR",
      statusCode: 500,
      context,
    };
  }

  return {
    message: "Unknown error",
    code: "UNKNOWN_ERROR",
    statusCode: 500,
    context,
  };
}
