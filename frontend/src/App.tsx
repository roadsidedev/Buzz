/**
 * Buzz Frontend Root Component
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
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import "./styles/globals.css";
import { AppRouter } from "@/router";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuthStore } from "@/stores/auth-store";
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

import { usePrivyAuth } from "@/components/auth/login-button";

/**
 * Main App Component
 *
 * Initializes authentication and renders router.
 * Uses error boundary for fault tolerance.
 * Wrapped with PrivyProvider for wallet connections.
 */
function App(): React.ReactElement {
  // Sync Privy state globally
  usePrivyAuth();
  
  return <AppRouter />;
}

import { Toaster } from "@/components/ui/sonner";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";

export default function AppWithErrorBoundary() {
  const { solanaEnabled, setSolanaEnabled } = useAuthStore();
  
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="buzz-theme">
        <PrivyProvider
          appId={import.meta.env.VITE_PRIVY_APP_ID || ""}
          config={{
            loginMethods: ["email", "google", "twitter", "discord", "github"],
            appearance: {
              theme: "light",
              accentColor: "#676FFF",
              showWalletLoginFirst: false,
            },
            externalWallets: solanaEnabled ? {
              solana: {
                connectors: toSolanaWalletConnectors(),
              },
            } : undefined,
          }}
        >
          <SolanaAutoDetector />
          <App />
          <Toaster position="top-right" closeButton richColors />
        </PrivyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

/**
 * Automagically enables Solana connectors if the user has a linked Solana wallet
 * or explicitly triggers a Solana-related action.
 */
function SolanaAutoDetector() {
  const { user } = usePrivy();
  const { solanaEnabled, setSolanaEnabled } = useAuthStore();

  useEffect(() => {
    if (!solanaEnabled && user) {
      // Check if user has a linked Solana wallet
      const hasSolana = user.linkedAccounts.some(
        (acc) => acc.type === 'wallet' && acc.chainType === 'solana'
      );
      
      if (hasSolana) {
        console.log("[INFO] Solana wallet detected, enabling connectors lazily");
        setSolanaEnabled(true);
      }
    }
  }, [user, solanaEnabled, setSolanaEnabled]);

  return null;
}
