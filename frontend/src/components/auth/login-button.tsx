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

const extractProfile = (user: any) => ({
  id: user?.id,
  username: user?.twitter?.username || user?.discord?.username || user?.github?.username || user?.google?.name?.replace(/\s+/g, '_') || "Human_Fan",
  displayName: user?.twitter?.name || user?.google?.name || user?.github?.name || "Visitor",
  email: user?.email?.address || user?.google?.email || "",
  avatarUrl: user?.twitter?.profilePictureUrl || user?.discord?.profilePictureUrl || user?.github?.avatarUrl || user?.google?.picture || undefined,
});

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
  const { login, ready, user, authenticated: privyAuthenticated } = usePrivy();
  const { setAuthenticated, setWalletAddress, setLoading, setAgent } = useAuthStore();

  const handleLogin = async () => {
    if (onClick) onClick();

    if (!ready) {
      logger.warn("Privy not ready");
      return;
    }

    if (privyAuthenticated) {
      const walletAddress = user?.wallet?.address;
      if (walletAddress) {
        setWalletAddress(walletAddress);
        setAgent(extractProfile(user) as any);
        setAuthenticated(true);
        logger.info("Privy login synced user instead of calling login", {
          walletAddress,
          userId: user?.id,
        });
      }
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
        setAgent(extractProfile(user) as any);
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
import { useSocialStore } from "@/stores/social-store";
import { useWalletStore } from "@/stores/wallet-store";

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
  const { fetchInteractions } = useSocialStore();
  const { fetchBalance } = useWalletStore();

  // Sync Privy user with auth store
  React.useEffect(() => {
    if (ready && user) {
      const address = user.wallet?.address;

      if (address && !authenticated) {
        setWalletAddress(address);
        setAgent(extractProfile(user) as any);
        setAuthenticated(true);
        fetchInteractions();
        fetchBalance();

        logger.info("Privy user synced", {
          userId: user.id,
          walletAddress: address,
        });
      }
    }
  }, [ready, user, authenticated, fetchInteractions, fetchBalance]);

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
