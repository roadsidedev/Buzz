/**
 * ClawHouse Frontend Root Component
 * Main React application entry point
 *
 * Phase 4: Authentication Complete
 *
 * Responsibilities:
 * - Initialize authentication state on app load
 * - Render main router with protected routes
 * - Handle error boundaries
 * - Manage app-level state recovery
 */

import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import "./styles/globals.css";
import { AppRouter } from "@/router";
import { ThemeProvider } from "@/components/theme-provider";
import { logger } from "@/utils/logger";

/**
 * Error Boundary Component
 *
 * Catches React errors and displays fallback UI
 * Prevents white screen of death
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("React error boundary caught error", {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-base-white">
          <div className="border-2 border-base-black p-8 max-w-md">
            <h1 className="text-4xl font-bold mb-4 uppercase">Error</h1>
            <p className="text-base-gray-700 mb-6">
              Something went wrong. Please refresh the page.
            </p>
            <details className="mb-6 text-sm text-base-gray-600">
              <summary className="cursor-pointer font-bold mb-2">
                Error Details
              </summary>
              <pre className="bg-base-gray-100 p-2 overflow-auto text-xs">
                {this.state.error?.message}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-base-black text-base-white px-6 py-3 font-bold border-2 border-base-black hover:bg-base-white hover:text-base-black transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Main App Component
 *
 * Initializes authentication and renders router.
 * Uses error boundary for fault tolerance.
 * Wrapped with PrivyProvider for wallet connections.
 */
function App(): React.ReactElement {
  return <AppRouter />;
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="clawzz-theme">
        <PrivyProvider appId={import.meta.env.VITE_PRIVY_APP_ID || ""}>
          <App />
        </PrivyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
