/**
 * LoginButton: Simple Privy Social Login
 *
 * Handles human authentication via Privy:
 * - Email, social logins (Google, Twitter, Discord, etc.)
 * - Embedded wallet creation automatically
 */

import React from "react";
import { usePrivy, LoginModal as PrivyLoginModal } from "@privy-io/react-auth";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/services/api";
import { logger } from "@/utils/logger";

interface LoginButtonProps {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * LoginButton - Simple sign in with Privy
 *
 * Shows Privy login modal on click
 * Automatically creates embedded wallet for user
 * Stores user info in auth store
 */
export const LoginButton: React.FC<LoginButtonProps> = ({
  children,
  className = "",
  onClick,
}) => {
  const { login, ready, user } = usePrivy();
  const { setAuthenticated, setWalletAddress, setLoading } = useAuthStore();

  const handleLogin = async () => {
    if (onClick) onClick();

    if (!ready) {
      logger.warn("Privy not ready");
      return;
    }

    try {
      setLoading(true);

      // Open Privy login modal
      await login();

      // After login, get wallet address
      const walletAddress = user?.wallet?.address;

      if (walletAddress) {
        setWalletAddress(walletAddress);
        setAuthenticated(true);

        logger.info("Privy login successful", {
          walletAddress,
          userId: user?.id,
        });
      }
    } catch (err) {
      logger.error("Privy login failed", { error: err });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleLogin} className={className} disabled={!ready}>
      {children || "Sign In"}
    </button>
  );
};

/**
 * usePrivyAuth - Hook to sync Privy user with auth store
 */
export const usePrivyAuth = () => {
  const { user, ready, logout: privyLogout } = usePrivy();
  const {
    setAuthenticated,
    setWalletAddress,
    setAgent,
    setAgentId,
    walletAddress,
    authenticated,
  } = useAuthStore();

  // Sync Privy user with auth store
  React.useEffect(() => {
    if (ready && user) {
      const address = user.wallet?.address;

      if (address && !authenticated) {
        setWalletAddress(address);
        setAuthenticated(true);

        logger.info("Privy user synced", {
          userId: user.id,
          walletAddress: address,
        });
      }
    }
  }, [ready, user, authenticated]);

  const handleLogout = async () => {
    try {
      await privyLogout();
      setAuthenticated(false);
      setWalletAddress(null);
      setAgent(null);
      setAgentId(null);
    } catch (err) {
      logger.error("Logout failed", { error: err });
    }
  };

  return {
    user,
    ready,
    walletAddress: user?.wallet?.address || walletAddress,
    handleLogout,
  };
};

export default LoginButton;
